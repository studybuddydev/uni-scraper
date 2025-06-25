import fs from 'fs';
import path from 'path';
import { ScrapingConfig, CourseData, ExamData, Checkpoint } from '../types';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../utils/ConfigManager';
import { ProgressTracker } from '../utils/ProgressTracker';
import { ErrorReporter } from './ErrorReporter';
import { DataValidator } from './DataValidator';
import { CourseDiscovery } from './CourseDiscovery';
import { CourseDataProcessor } from './CourseDataProcessor';
import { ExamExtractorNew } from './ExamExtractorNew';

export class ScrapingOrchestrator {
  private config: ScrapingConfig;
  private logger: Logger;
  private progressTracker: ProgressTracker;
  private errorReporter: ErrorReporter;
  private dataValidator: DataValidator;
  private sessionId: string;
  private startTime: string;

  constructor(configPath?: string) {
    this.startTime = new Date().toISOString();
    
    // Load configuration first
    const configManager = ConfigManager.getInstance();
    this.config = configManager.loadConfig(configPath);
    
    // Generate session ID after config is loaded
    this.sessionId = this.generateSessionId();
    
    // Initialize utilities
    this.logger = new Logger(this.config.output.logsDir, this.sessionId);
    this.progressTracker = new ProgressTracker();
    this.errorReporter = new ErrorReporter(this.config, this.logger, this.sessionId);
    this.dataValidator = new DataValidator(this.logger);
    
    this.logger.info(`Starting new scraping session: ${this.sessionId}`);
    this.ensureDirectories();
  }

  public async runFullPipeline(): Promise<void> {
    this.logger.info('Starting full scraping pipeline');
    
    try {
      // Step 1: Discover courses
      this.logger.info('Step 1: Course Discovery');
      const courseDiscovery = new CourseDiscovery(this.config, this.logger, this.progressTracker);
      const courseResult = await courseDiscovery.discoverCourses();
      
      if (!courseResult.success) {
        throw new Error(`Course discovery failed: ${courseResult.error?.message}`);
      }
      
      const courses = courseResult.data!;
      this.logger.info(`Discovered ${courses.length} course paths`);
      
      // Save course discovery results
      const rawCourseDataPath = await this.saveCourseData(courses);
      
      // Create checkpoint
      if (this.config.recovery.enableCheckpoints) {
        await this.createCheckpoint('course-discovery', { courses });
      }

      // Step 1.5: Process raw course data into structured format
      this.logger.info('Step 1.5: Processing Course Data');
      const courseProcessor = new CourseDataProcessor(this.config, this.logger);
      const processedCourseData = courseProcessor.processRawCourseData(rawCourseDataPath, this.sessionId);
      this.logger.info(`Processed course data: ${Object.keys(processedCourseData.courses).length} courses, ${Object.keys(processedCourseData.pathsyears).length} course paths`);

      // Step 2: Extract exams from course data
      this.logger.info('Step 2: Exam Extraction from Course Data');
      const examExtractor = new ExamExtractorNew(this.config, this.logger, this.progressTracker, this.sessionId);
      const processedDataPath = path.join(this.getSessionDataDir(), `${this.sessionId}-courses-processed.json`);
      const examResult = await examExtractor.extractExamsFromCourseData(processedDataPath);
      
      if (!examResult.success) {
        throw new Error(`Exam extraction failed: ${examResult.error?.message}`);
      }
      
      const exams = examResult.data!;
      this.logger.info(`Extracted ${exams.length} exams`);
      
      // Convert exam data to proper ExamData format
      const examDataList = exams.map(e => this.convertToExamData(e));
      
      // Save exam data
      await this.saveExamData(examDataList);
      
      // Step 3: Validate data
      this.logger.info('Step 3: Data Validation');
      await this.validateAllData(courses, examDataList);
      
      // Generate final report
      await this.generateFinalReport(courses, examDataList);
      
      this.logger.info('Full pipeline completed successfully');
      
    } catch (error) {
      this.logger.error('Pipeline failed:', error);
      await this.generateErrorReport();
      throw error;
    } finally {
      this.progressTracker.stop();
    }
  }

  public async reScrapeCourse(courseId: string): Promise<void> {
    this.logger.info(`Re-scraping course: ${courseId}`);
    
    // Implementation for re-scraping a specific course
    // This would find the course URL and re-run the discovery for that course
  }

  public async reScrapeExam(examId: string): Promise<void> {
    this.logger.info(`Re-scraping exam: ${examId}`);
    
    // Implementation for re-scraping a specific exam
    // This would find the exam URL and re-run the extraction for that exam
  }

  public async retryFailedItems(sessionId: string = 'latest'): Promise<void> {
    this.logger.info(`Retrying failed items from session: ${sessionId}`);
    
    // Load failed items from previous session
    const failedItems = await this.loadFailedItems(sessionId);
    
    if (failedItems.courses.length > 0) {
      this.logger.info(`Retrying ${failedItems.courses.length} failed courses`);
      // Re-scrape failed courses
    }
    
    if (failedItems.exams.length > 0) {
      this.logger.info(`Retrying ${failedItems.exams.length} failed exams`);
      // Re-scrape failed exams
    }
  }

  public async reScrapeItems(items: { courses?: string[]; exams?: string[] }): Promise<void> {
    this.logger.info('Re-scraping specified items');
    
    if (items.courses) {
      for (const courseId of items.courses) {
        await this.reScrapeCourse(courseId);
      }
    }
    
    if (items.exams) {
      for (const examId of items.exams) {
        await this.reScrapeExam(examId);
      }
    }
  }

  // Helper method to convert ExamInfo to ExamData
  private convertToExamData(examInfo: any): ExamData {
    return {
      id: examInfo.id,
      universityId: this.config.university.id,
      course: examInfo.courseName || 'Unknown',
      courseId: examInfo.courseId || '',
      name: examInfo.name,
      url: examInfo.url,
      lastUpdated: new Date().toISOString(),
      deleted: null,
      metadata: {
        scrapingSession: this.sessionId,
        scrapingTimestamp: new Date().toISOString(),
        sourceUrl: examInfo.url,
        hasModules: false,
        hasFractions: false
      }
    };
  }

  private async saveCourseData(courses: any[]): Promise<string> {
    const dataDir = this.getSessionDataDir();
    const coursesFile = path.join(dataDir, `${this.sessionId}-courses.json`);
    
    fs.writeFileSync(coursesFile, JSON.stringify(courses, null, 2));
    this.logger.info(`Course data saved to: ${coursesFile}`);
    
    return coursesFile;
  }

  private async saveExamData(exams: ExamData[]): Promise<void> {
    const dataDir = this.getSessionDataDir();
    
    // Save JSON format
    const examsJsonFile = path.join(dataDir, `${this.sessionId}-exams.json`);
    fs.writeFileSync(examsJsonFile, JSON.stringify(exams, null, 2));
    
    // Save JSONL format
    const examsJsonlFile = path.join(dataDir, `${this.sessionId}-exams.jsonl`);
    const jsonlContent = exams.map(exam => JSON.stringify(exam)).join('\n');
    fs.writeFileSync(examsJsonlFile, jsonlContent);
    
    this.logger.info(`Exam data saved to: ${examsJsonFile} and ${examsJsonlFile}`);
  }

  private async validateAllData(courses: any[], exams: ExamData[]): Promise<void> {
    this.logger.info('Validating scraped data');
    
    // Validate courses
    const courseValidation = this.dataValidator.validateBatch(courses);
    this.logger.info(`Course validation: ${courseValidation.validItems}/${courseValidation.totalItems} valid`);
    
    // Validate exams
    const examValidation = this.dataValidator.validateBatch(exams);
    this.logger.info(`Exam validation: ${examValidation.validItems}/${examValidation.totalItems} valid`);
    
    // Save validation reports
    const validationDir = path.join(this.config.output.reportsDir, this.sessionId);
    if (!fs.existsSync(validationDir)) {
      fs.mkdirSync(validationDir, { recursive: true });
    }
    
    const courseValidationReport = this.dataValidator.generateValidationReport(courseValidation.errors);
    fs.writeFileSync(path.join(validationDir, 'course-validation.txt'), courseValidationReport);
    
    const examValidationReport = this.dataValidator.generateValidationReport(examValidation.errors);
    fs.writeFileSync(path.join(validationDir, 'exam-validation.txt'), examValidationReport);
  }

  private async generateFinalReport(courses: any[], exams: ExamData[]): Promise<void> {
    const endTime = new Date().toISOString();
    const successful = courses.length + exams.length;
    const failed = this.errorReporter.getErrorCount();
    
    const report = this.errorReporter.generateSessionReport(
      this.startTime,
      endTime,
      successful + failed,
      successful,
      failed,
      0,
      {
        discovered: courses.length,
        successful: courses.length,
        failed: 0,
        failedItems: []
      },
      {
        extracted: exams.length,
        successful: exams.length,
        failed: 0,
        failedItems: []
      }
    );
    
    await this.errorReporter.saveReport(report);
    this.progressTracker.printFinalSummary();
  }

  private async generateErrorReport(): Promise<void> {
    const endTime = new Date().toISOString();
    const failed = this.errorReporter.getErrorCount();
    
    const report = this.errorReporter.generateSessionReport(
      this.startTime,
      endTime,
      failed,
      0,
      failed
    );
    
    await this.errorReporter.saveReport(report);
  }

  private async createCheckpoint(step: string, data: any): Promise<void> {
    const checkpointDir = path.join(this.config.output.dataDir, 'checkpoints');
    if (!fs.existsSync(checkpointDir)) {
      fs.mkdirSync(checkpointDir, { recursive: true });
    }
    
    const checkpoint: Checkpoint = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      step,
      progress: this.progressTracker.getCurrentStatus(),
      processedItems: [],
      pendingItems: [],
      failedItems: []
    };
    
    const checkpointFile = path.join(checkpointDir, `${this.sessionId}-${step}.json`);
    fs.writeFileSync(checkpointFile, JSON.stringify({ checkpoint, data }, null, 2));
    
    this.logger.debug(`Checkpoint created: ${checkpointFile}`);
  }

  private async loadFailedItems(sessionId: string): Promise<{ courses: string[]; exams: string[] }> {
    // Implementation to load failed items from previous session
    return { courses: [], exams: [] };
  }

  private generateSessionId(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${this.config.output.sessionPrefix}-${timestamp}`;
  }

  private getSessionDataDir(): string {
    const sessionDir = path.join(this.config.output.dataDir, this.sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  private ensureDirectories(): void {
    const dirs = [
      this.config.output.dataDir,
      this.config.output.logsDir,
      this.config.output.reportsDir,
      this.config.output.backupDir
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getConfig(): ScrapingConfig {
    return this.config;
  }
}

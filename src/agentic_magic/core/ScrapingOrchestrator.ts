import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { ScrapingConfig, ScrapingResult, CourseData, ExamData, Checkpoint } from '../types';
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

  // Key mapping from descrapper 31-analysis-exams.ts
  private readonly keyMapping: { [key: string]: string } = {
    'Tipo di corso': 'courseType',
    'Anno di offerta': 'offerYear',
    'Tipo Attività Formativa': 'activityType',
    'Ambito': 'field',
    'Lingua di erogazione': 'language',
    'Tipo attività didattica': 'teachingActivityType',
    'Valutazione': 'evaluation',
    'Periodo didattico': 'teachingPeriod',
    'Modalita didattica': 'teachingMode',
    'Settore scientifico disciplinare': 'disciplinarySector',
    'Sede': 'location',
    'Attività correlate': 'relatedActivities',
    'Altri Percorsi': 'otherPaths',
    'Tipologia interclasse': 'interclassType',
    'Ambito Interclasse': 'interclassField',

    'Contenuti': 'chapters',
    'Contenuti  per il gruppo studenti': 'chapters',
    'Contenuti/Programma del corso': 'chapters',

    'Testi': 'books',
    'Testi  per il gruppo studenti': 'books',
    'Libri di testo/Libri consigliati': 'books',

    'Obiettivi formativi': 'goals',
    'Obiettivi formativi e risultati di apprendimento attesi': 'goals',
    'Obiettivi formativi  per il gruppo studenti': 'goals',

    'Prerequisiti': 'requirements',
    'Prerequisiti  per il gruppo studenti': 'requirements',

    'Metodi didattici': 'teachingMethods',
    'Metodi didattici  per il gruppo studenti': 'teachingMethods',
    'Metodi didattici utilizzati e attività di apprendimento richieste allo studente': 'teachingMethods',

    "Verifica dell'apprendimento": 'learningAssessment',
    "Verifica dell'apprendimento  per il gruppo studenti": 'learningAssessment',
    "Metodi di accertamento e criteri di valutazione": 'learningAssessment',

    'Programma esteso': 'extendedProgram',
    'Programma esteso  per il gruppo studenti': 'extendedProgram',

    'Testi disponibili nel catalogo delle biblioteche': 'libraryTexts',
    'Testi disponibili nel catalogo delle biblioteche  per il gruppo studenti': 'libraryTexts',

    'Risorse online': 'onlineResources',
    'Risorse online  per il gruppo studenti': 'onlineResources',
    
    'Altro': 'other',
    'Altre informazioni': 'other',
    'Altro  per il gruppo studenti': 'other',
  };

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
    this.logger.info('🎯 STARTING UNIVERSITY SCRAPER PIPELINE');
    this.logger.info('========================================');
    this.logger.info('This pipeline follows a clear 2-step process:');
    this.logger.info('📚 STEP 1: Create dataCourses.json (complete course data)');
    this.logger.info('📝 STEP 2: Create dataExams.json (detailed exam data)');
    this.logger.info('');
    
    try {
      // ===================================================================
      // STEP 1: CREATE DATACOURSES.JSON
      // ===================================================================
      this.logger.info('📚 ========================================');
      this.logger.info('📚 STEP 1: CREATING DATACOURSES.JSON');
      this.logger.info('📚 ========================================');
      this.logger.info('This step discovers all courses and creates the complete dataCourses.json file');
      this.logger.info('');

      // 1.1: Discover courses
      this.logger.info('🔍 1.1: Discovering courses and their structure...');
      const courseDiscovery = new CourseDiscovery(this.config, this.logger, this.progressTracker);
      const courseResult = await courseDiscovery.discoverCourses();
      
      if (!courseResult.success) {
        throw new Error(`Course discovery failed: ${courseResult.error?.message}`);
      }
      
      const courses = courseResult.data!;
      this.logger.info(`✓ Discovered ${courses.length} course paths`);
      
      // 1.2: Process and structure course data
      this.logger.info('🔧 1.2: Processing course data structure...');
      const rawCourseDataPath = await this.saveCourseData(courses);
      const courseProcessor = new CourseDataProcessor(this.config, this.logger);
      const processedCourseData = courseProcessor.processRawCourseData(rawCourseDataPath, this.sessionId);
      this.logger.info(`✓ Processed ${Object.keys(processedCourseData.courses).length} courses`);

      // 1.3: Extract exam URLs from course pages
      this.logger.info('� 1.3: Extracting exam URLs from course pages...');
      const examExtractor = new ExamExtractorNew(this.config, this.logger, this.progressTracker, this.sessionId);
      const processedDataPath = path.join(this.getSessionDataDir(), `${this.sessionId}-2-courses-processed.json`);
      const examResult = await examExtractor.extractExamsFromCourseData(processedDataPath);
      
      if (!examResult.success) {
        throw new Error(`Exam extraction failed: ${examResult.error?.message}`);
      }
      
      const exams = examResult.data!;
      this.logger.info(`✓ Found ${exams.length} exam URLs`);

      // 1.4: Generate final dataCourses.json
      this.logger.info('📋 1.4: Generating final dataCourses.json...');
      const dataCourses = await this.generateDataCourses(processedCourseData, exams);
      await this.saveDataCourses(dataCourses);
      
      // Generate visualization automatically
      await this.generateDataCoursesVisualization();
      
      this.logger.info(`✅ STEP 1 COMPLETE: dataCourses.json created with ${dataCourses.length} courses`);
      this.logger.info('');

      // ===================================================================
      // STEP 2: CREATE DATAEXAMS.JSON  
      // ===================================================================
      this.logger.info('📝 ========================================');
      this.logger.info('📝 STEP 2: CREATING DATAEXAMS.JSON');
      this.logger.info('📝 ========================================');
      this.logger.info('This step scrapes detailed syllabus information for all exams');
      this.logger.info('');

      // 2.1: Extract detailed syllabus information
      this.logger.info('📖 2.1: Scraping detailed syllabus information...');
      this.logger.info('     (This includes modules, fractions, and all content fields)');
      const detailedExams = await this.extractDetailedSyllabusInfo(exams);
      this.logger.info(`✓ Enhanced ${detailedExams.length} exams with detailed information`);

      // 2.2: Generate final dataExams.json
      this.logger.info('📋 2.2: Generating final dataExams.json...');
      const dataExams = await this.generateDataExams(detailedExams, processedCourseData);
      await this.saveDataExams(dataExams);
      this.logger.info(`✅ STEP 2 COMPLETE: dataExams.json created with ${dataExams.length} exams`);
      this.logger.info('');

      // ===================================================================
      // FINAL VALIDATION AND REPORTING
      // ===================================================================
      this.logger.info('🔍 Final validation and reporting...');
      
      // Create checkpoint
      if (this.config.recovery.enableCheckpoints) {
        await this.createCheckpoint('pipeline-complete', { courses, exams: detailedExams });
      }

      // Convert exam data for legacy validation
      const examDataList = exams.map(e => this.convertToExamData(e));
      await this.saveExamData(examDataList);
      
      // Validate data
      await this.validateAllData(courses, examDataList);
      
      // Generate final report
      await this.generateFinalReport(courses, examDataList);
      
      this.logger.info('');
      this.logger.info('🎉 ==========================================');
      this.logger.info('🎉 PIPELINE COMPLETED SUCCESSFULLY!');
      this.logger.info('🎉 ==========================================');
      this.logger.info('✅ 2-Step Process Complete:');
      this.logger.info(`   📚 Step 1: dataCourses.json → ${this.sessionId}-dataCourses.json`);
      this.logger.info(`   📝 Step 2: dataExams.json → ${this.sessionId}-dataExams.json`);
      this.logger.info(`   📝 Step 2: dataExams → ${this.sessionId}-4-dataExams.json`);
      this.logger.info('');
      this.logger.info('🎯 Key Output Files for Your Use:');
      this.logger.info(`   • ${this.sessionId}-5-dataCourses.json - Complete course information`);
      this.logger.info(`   • ${this.sessionId}-4-dataExams.json - Complete exam information with syllabi`);
      this.logger.info('');
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
      year: this.extractYearLevelFromExam(examInfo),  // Extract numeric year level
      semester: examInfo.semester || undefined,
      hours: examInfo.hours || undefined,
      cfu: examInfo.cfu || undefined,
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

  private extractYearLevelFromExam(exam: any): number {
    // Try to extract year level from different sources
    
    // If exam has yearLevel directly (from CourseDiscovery)
    if (exam.yearLevel && typeof exam.yearLevel === 'number') {
      return exam.yearLevel;
    }
    
    // Try to extract from year text (e.g., "Primo Anno" -> 1, "Secondo Anno" -> 2)
    if (exam.year && typeof exam.year === 'string') {
      const yearText = exam.year.toLowerCase();
      if (yearText.includes('primo') || yearText.includes('first')) return 1;
      if (yearText.includes('secondo') || yearText.includes('second')) return 2;
      if (yearText.includes('terzo') || yearText.includes('third')) return 3;
      if (yearText.includes('quarto') || yearText.includes('fourth')) return 4;
      if (yearText.includes('quinto') || yearText.includes('fifth')) return 5;
      if (yearText.includes('sesto') || yearText.includes('sixth')) return 6;
    }
    
    // Try to extract from URL parameters
    if (exam.url && typeof exam.url === 'string') {
      // Look for patterns like "coorte=2025" and compare with offering year
      const coorteMatch = exam.url.match(/coorte=(\d{4})/);
      const currentYear = new Date().getFullYear();
      
      if (coorteMatch) {
        const coorteYear = parseInt(coorteMatch[1]);
        // Calculate year level based on the difference from current academic year
        const yearLevel = currentYear - coorteYear + 1;
        if (yearLevel >= 1 && yearLevel <= 6) {
          return yearLevel;
        }
      }
    }
    
    // Default to 1 if we can't determine the year level
    return 1;
  }

  private async saveCourseData(courses: any[]): Promise<string> {
    const dataDir = this.getSessionDataDir();
    const coursesFile = path.join(dataDir, `${this.sessionId}-1-courses-raw.json`);
    
    fs.writeFileSync(coursesFile, JSON.stringify(courses, null, 2));
    this.logger.info(`✓ Step 1 - Raw course data saved to: ${coursesFile}`);
    
    return coursesFile;
  }

  private async saveExamData(exams: ExamData[]): Promise<void> {
    const dataDir = this.getSessionDataDir();
    
    // Save JSON format (step 3 - detailed exam data)
    const examsJsonFile = path.join(dataDir, `${this.sessionId}-3-exams.json`);
    fs.writeFileSync(examsJsonFile, JSON.stringify(exams, null, 2));
    
    // Save JSONL format
    const examsJsonlFile = path.join(dataDir, `${this.sessionId}-3-exams.jsonl`);
    const jsonlContent = exams.map(exam => JSON.stringify(exam)).join('\n');
    fs.writeFileSync(examsJsonlFile, jsonlContent);
    
    this.logger.info(`✓ Step 3 - Detailed exam data saved to: ${examsJsonFile} and ${examsJsonlFile}`);
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
    
    // Generate the basic session report
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
    
    // Generate the detailed course and exam report
    await this.generateDetailedCourseExamReport();
    
    // Print comprehensive file summary
    await this.printGeneratedFilesSummary();
    
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

  private async generateDetailedCourseExamReport(): Promise<void> {
    try {
      this.logger.info('Generating detailed course and exam report...');
      
      const dataDir = this.getSessionDataDir();
      const reportsDir = path.join(this.config.output.reportsDir, this.sessionId);
      
      // Read the data files
      const coursesProcessedPath = path.join(dataDir, `${this.sessionId}-2-courses-processed.json`);
      const examsJsonlPath = path.join(dataDir, `${this.sessionId}-3-exams.jsonl`);
      const reportPath = path.join(reportsDir, `${this.sessionId}-dashboard.html`);
      
      if (!fs.existsSync(coursesProcessedPath) || !fs.existsSync(examsJsonlPath)) {
        this.logger.warn('Required data files not found for detailed report generation');
        return;
      }
      
      // Parse courses data
      const coursesData = JSON.parse(fs.readFileSync(coursesProcessedPath, 'utf8'));
      
      // Parse exams data
      const examsData: ExamData[] = [];
      const examsContent = fs.readFileSync(examsJsonlPath, 'utf8');
      const lines = examsContent.trim().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            examsData.push(JSON.parse(line));
          } catch (e) {
            this.logger.warn('Failed to parse exam line:', line.substring(0, 100));
          }
        }
      }
      
      // Analyze data
      const courseStats = this.analyzeCourseExamData(coursesData, examsData);
      
      // Generate detailed HTML section
      const detailedSection = this.generateDetailedHtml(courseStats);
      
      // Update existing report if it exists
      if (fs.existsSync(reportPath)) {
        let reportHtml = fs.readFileSync(reportPath, 'utf8');
        
        // Insert detailed section before the error distribution
        const insertPosition = reportHtml.indexOf('<div class="chart-container">');
        if (insertPosition !== -1) {
          reportHtml = reportHtml.slice(0, insertPosition) + 
                      detailedSection + '\n\n    ' + 
                      reportHtml.slice(insertPosition);
        } else {
          // Fallback: insert before closing body tag
          reportHtml = reportHtml.replace('</body>', detailedSection + '\n</body>');
        }
        
        fs.writeFileSync(reportPath, reportHtml);
      } else {
        // Create a standalone detailed report
        const standaloneHtml = this.createStandaloneDetailedReport(detailedSection, courseStats);
        fs.writeFileSync(reportPath, standaloneHtml);
      }
      
      this.logger.info(`✓ Updated detailed report: ${reportPath}`);
      this.logger.info(`📊 Found ${Object.keys(courseStats).length} courses with ${examsData.length} total exams`);
      
    } catch (error) {
      this.logger.error('Failed to generate detailed course exam report:', error);
    }
  }

  private analyzeCourseExamData(coursesData: any, examsData: ExamData[]): Record<string, any> {
    const courseStats: Record<string, any> = {};
    
    // Initialize course stats from courses data
    for (const [courseName, courseUrl] of Object.entries(coursesData.courses)) {
      courseStats[courseName] = {
        name: courseName,
        examCount: 0,
        paths: {},
        totalExams: 0
      };
      
      // Initialize paths from pathsyears data
      if (coursesData.pathsyears[courseName]) {
        for (const [pathName, years] of Object.entries(coursesData.pathsyears[courseName])) {
          courseStats[courseName].paths[pathName] = {};
          for (const yearName of Object.keys(years as Record<string, any>)) {
            courseStats[courseName].paths[pathName][yearName] = 0;
          }
        }
      }
    }
    
    // Count exams per course/path/year
    for (const exam of examsData) {
      const courseKey = `[${exam.courseId}] ${exam.course}`;
      
      if (courseStats[courseKey]) {
        courseStats[courseKey].totalExams++;
        
        // Try to extract path and year from URL
        if (exam.metadata && exam.metadata.sourceUrl) {
          const url = exam.metadata.sourceUrl;
          const pathMatch = url.match(/schemaid=(\d+)/);
          const yearMatch = url.match(/coorte=(\d+)/);
          
          if (pathMatch && yearMatch) {
            const schemaId = pathMatch[1];
            
            // Find matching path
            for (const [pathName, years] of Object.entries(courseStats[courseKey].paths)) {
              for (const [yearName, pathUrl] of Object.entries(coursesData.pathsyears[courseKey]?.[pathName] || {})) {
                if ((pathUrl as string).includes(`schemaid=${schemaId}`)) {
                  if (!courseStats[courseKey].paths[pathName]) {
                    courseStats[courseKey].paths[pathName] = {};
                  }
                  if (!courseStats[courseKey].paths[pathName][yearName]) {
                    courseStats[courseKey].paths[pathName][yearName] = 0;
                  }
                  courseStats[courseKey].paths[pathName][yearName]++;
                  break;
                }
              }
            }
          }
        }
      }
    }
    
    return courseStats;
  }

  private generateDetailedHtml(courseStats: Record<string, any>): string {
    const totalCourses = Object.keys(courseStats).length;
    const totalExams = Object.values(courseStats).reduce((sum: number, course: any) => sum + course.totalExams, 0);
    
    let html = `
      <div class="chart-container">
          <h3>Course and Exam Details</h3>
          <div style="margin-bottom: 20px;">
              <p><strong>Total Courses:</strong> ${totalCourses}</p>
              <p><strong>Total Exams:</strong> ${totalExams}</p>
          </div>
          
          <div style="max-height: 600px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                      <tr style="background-color: #f8f9fa; position: sticky; top: 0;">
                          <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">Course</th>
                          <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: bold;">Total Exams</th>
                          <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">Paths & Years</th>
                      </tr>
                  </thead>
                  <tbody>`;
    
    // Sort courses by total exams (descending)
    const sortedCourses = Object.entries(courseStats).sort((a: any, b: any) => b[1].totalExams - a[1].totalExams);
    
    for (const [courseName, stats] of sortedCourses) {
      const courseDisplayName = courseName.replace(/^\[[^\]]+\]\s*/, ''); // Remove course code for display
      
      let pathsHtml = '';
      const pathEntries = Object.entries(stats.paths);
      
      if (pathEntries.length > 0) {
        pathsHtml = '<div style="font-size: 0.9em;">';
        for (const [pathName, years] of pathEntries) {
          const yearEntries = Object.entries(years as Record<string, number>);
          if (yearEntries.length > 0) {
            const pathDisplayName = pathName || 'Default Path';
            pathsHtml += `<div style="margin-bottom: 8px;"><strong>${pathDisplayName}:</strong><br>`;
            
            for (const [yearName, examCount] of yearEntries) {
              if (examCount > 0) {
                pathsHtml += `<span style="margin-left: 15px; color: #666;">• ${yearName}: ${examCount} exams</span><br>`;
              }
            }
            pathsHtml += '</div>';
          }
        }
        pathsHtml += '</div>';
      } else {
        pathsHtml = '<span style="color: #999; font-style: italic;">No path details available</span>';
      }
      
      html += `
                      <tr>
                          <td style="border: 1px solid #ddd; padding: 12px; vertical-align: top;">
                              <strong>${courseDisplayName}</strong>
                          </td>
                          <td style="border: 1px solid #ddd; padding: 12px; text-align: center; vertical-align: top;">
                              <span style="font-size: 1.2em; font-weight: bold; color: #007cba;">${stats.totalExams}</span>
                          </td>
                          <td style="border: 1px solid #ddd; padding: 12px; vertical-align: top;">
                              ${pathsHtml}
                          </td>
                      </tr>`;
    }
    
    html += `
                  </tbody>
              </table>
          </div>
      </div>`;
    
    return html;
  }

  private createStandaloneDetailedReport(detailedSection: string, courseStats: Record<string, any>): string {
    const totalCourses = Object.keys(courseStats).length;
    const totalExams = Object.values(courseStats).reduce((sum: number, course: any) => sum + course.totalExams, 0);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Course and Exam Details - ${this.sessionId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .chart-container { margin: 20px 0; }
        h1 { color: #333; }
        h3 { color: #007cba; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
    </style>
</head>
<body>
    <div class="header">
        <h1>University Course and Exam Details</h1>
        <p>Session: <strong>${this.sessionId}</strong></p>
        <p>Generated: <strong>${new Date().toLocaleString()}</strong></p>
        <p>Total Courses: <strong>${totalCourses}</strong> | Total Exams: <strong>${totalExams}</strong></p>
    </div>
    
    ${detailedSection}
</body>
</html>`;
  }

  private async extractDetailedSyllabusInfo(exams: any[]): Promise<any[]> {
    this.logger.info(`Starting detailed syllabus extraction for ${exams.length} exams`);
    
    const browser = await this.initializeBrowser();
    const detailedExams: any[] = [];
    
    try {
      // Process exams in batches to avoid overwhelming the server
      const batchSize = this.config.scraping.concurrency || 3;
      
      for (let i = 0; i < exams.length; i += batchSize) {
        const batch = exams.slice(i, i + batchSize);
        this.logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(exams.length / batchSize)} (${batch.length} exams)`);
        
        const batchPromises = batch.map(async (exam) => {
          return await this.extractSingleExamDetails(browser, exam);
        });
        
        const batchResults = await Promise.all(batchPromises);
        detailedExams.push(...batchResults);
        
        // Add delay between batches
        if (i + batchSize < exams.length) {
          await this.sleep(this.config.scraping.delayBetweenRequests || 1000);
        }
      }
      
    } finally {
      await browser.close();
    }
    
    this.logger.info(`✓ Enhanced ${detailedExams.length} exams with detailed syllabus information`);
    return detailedExams;
  }

  private async initializeBrowser() {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    return browser;
  }

  private async extractSingleExamDetails(browser: any, exam: any): Promise<any> {
    try {
      // Extract detailed exam data using descrapper logic, including modules/fractions
      const detailedData = await this.extractExamsFromUrl(exam.url, browser);
      
      // If we got multiple results (due to modules/fractions), flatten them
      const examResults = Array.isArray(detailedData) ? detailedData : [detailedData];
      
      // Merge with existing exam data for each result
      const enhancedExams = examResults.map(examData => ({
        ...exam,
        ...examData,
        syllabusExtracted: true,
        extractionTimestamp: new Date().toISOString()
      }));
      
      this.logger.debug(`✓ Extracted detailed info for: ${exam.name} (${enhancedExams.length} variants)`);
      
      // Return single exam if only one variant, otherwise return the main one
      return enhancedExams.length === 1 ? enhancedExams[0] : enhancedExams[0];
      
    } catch (error) {
      this.logger.warn(`Failed to extract detailed info for ${exam.name}: ${error}`);
      return {
        ...exam,
        syllabusExtracted: false,
        extractionError: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Main extraction method similar to descrapper's extractExams function
  private async extractExamsFromUrl(url: string, browser: any): Promise<any[]> {
    if (!url) return [];
    
    const page = await browser.newPage();
    
    try {
      // Set user agent and configure page
      await page.setUserAgent(this.config.scraping.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: this.config.scraping.timeout || 30000
      });
      
      await this.sleep(1000); // Wait as in descrapper
      
      // Check for modules and fractions like descrapper does
      const modulesAndFractions = await page.evaluate((baseUrl: string) => {
        const sections = document.querySelectorAll('.insegnamento-links');
        if (sections.length !== 2) {
          return null;
        }
        
        const [moduli, frazioni] = Array.from(sections).map((section: any) =>
          Array.from(section.querySelectorAll('a')).map((a: any) => {
            const name = a.textContent?.trim() || '';
            const href = a.getAttribute('href') || '#';
            const url = href.startsWith('http') ? href : `${baseUrl}${href}`;
            return { name, url };
          })
        );
        
        return { moduli, frazioni };
      }, new URL(url).origin);

      if (!modulesAndFractions) {
        this.logger.warn(`Problem extracting modules/fractions from: ${url}`);
        return [];
      }

      // If no modules or fractions, extract single exam
      if (modulesAndFractions.moduli.length === 0 && modulesAndFractions.frazioni.length === 0) {
        const examData = await this.extractExamDataFromPage(page);
        return [{
          code: examData.code,
          title: examData.title,
          url: url,
          data: examData.data
        }];
      }

      const results: any[] = [];

      // Process modules
      if (modulesAndFractions.moduli.length > 0) {
        for (const module of modulesAndFractions.moduli) {
          const moduleResults = await this.extractExamsFromUrl(module.url, browser);
          await this.sleep(1000);
          moduleResults.forEach((exam: any) => {
            exam.module = module.name;
          });
          results.push(...moduleResults);
        }
      }

      // Process fractions
      if (modulesAndFractions.frazioni.length > 0) {
        for (const fraction of modulesAndFractions.frazioni) {
          const fractionResults = await this.extractExamsFromUrl(fraction.url, browser);
          await this.sleep(1000);
          fractionResults.forEach((exam: any) => {
            exam.fraction = fraction.name;
          });
          results.push(...fractionResults);
        }
      }

      return results;
      
    } finally {
      await page.close();
    }
  }

  private async extractExamDataFromPage(page: any): Promise<any> {
    return await page.evaluate(() => {
      const results: any = {};

      // Extract exam code and title from the main header
      const codeTitle = document.querySelector('.corso-title')?.textContent?.trim() || '';
      const code = codeTitle.split(']')[0].replace('[', '').trim();
      const title = codeTitle.split('] - ')[1]?.trim() || '';

      if (code) results.examCode = code;
      if (title) results.examTitle = title;

      // Extract accordion sections - using exact logic from descrapper
      const titleElements = document.querySelectorAll('.insegnamento-accordion .accordion > dt');
      const descriptionElements = document.querySelectorAll('.insegnamento-accordion .accordion > dd');

      const titles = Array.from(titleElements).map((t: any) => t.textContent?.trim() || '');
      const descriptions = Array.from(descriptionElements).map((d: any) => d.textContent?.trim() || '');

      // Process main content sections (starting from index 1, skip general info)
      for (let i = 1; i < titles.length; i++) {
        const sectionTitle = titles[i];
        const sectionDescription = descriptions[i];
        if (sectionTitle && sectionDescription) {
          results[sectionTitle] = sectionDescription;
        }
      }

      // Extract general information table (first section - index 0)
      if (titles.length > 0) {
        const tableTitle = titles[0] || 'Informazioni generali';
        results[tableTitle] = {};
        
        const tableHeaders = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dt');
        const tableValues = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dd');

        const headerTexts = Array.from(tableHeaders).map((h: any) => h.textContent?.trim() || '');
        const valueTexts = Array.from(tableValues).map((v: any) => v.textContent?.trim() || '');

        for (let i = 0; i < headerTexts.length; i++) {
          const header = headerTexts[i];
          const value = valueTexts[i];
          if (header && value) {
            results[tableTitle][header] = value;
          }
        }

        // Extract additional table lines (dl elements)
        const tableLines = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dl');
        tableLines.forEach((line: any) => {
          const lineTitle = line.querySelector('dt')?.textContent?.trim() || '';
          const lineValues = Array.from(line.querySelectorAll('dd')).map((d: any) => d.textContent?.trim() || '');
          if (lineTitle && lineValues.length > 0) {
            results[lineTitle] = lineValues;
          }
        });
      }

      return { data: results, code, title };
    });
  }

  private async convertToFinalFormat(exams: any[], processedCourseData: any): Promise<{ dataExams: any[], dataCourses: any[] }> {
    const dataExams: any[] = [];
    const dataCourses: any[] = [];
    
    // Group exams by course
    const examsByCourse: Record<string, any[]> = {};
    
    for (const exam of exams) {
      const courseKey = `[${exam.courseId}] ${exam.courseName}`;
      if (!examsByCourse[courseKey]) {
        examsByCourse[courseKey] = [];
      }
      examsByCourse[courseKey].push(exam);
    }
    
    // Generate dataCourses
    for (const [courseKey, courseExams] of Object.entries(examsByCourse)) {
      // Extract course ID from the key (remove brackets and clean)
      const courseIdMatch = courseKey.match(/\[([^\]]+)\]/);
      const courseId = courseIdMatch ? courseIdMatch[1] : `course${dataCourses.length + 1}`;
      
      // Clean course name (remove course ID in brackets)
      const courseName = courseKey.replace(/\[[^\]]+\]\s*/, '').trim() || 'Unknown Course';
      
      const course = {
        _id: courseId,
        id: `${this.config.university.id}${courseId}`,
        universityId: this.config.university.id,
        name: courseName,
        lastUpdated: new Date().toISOString(),
        deleted: null,
        exams: courseExams.map(exam => {
          // Use the extracted academic year from the exam data
          const academicYear = exam.academicYear || new Date().getFullYear().toString();
          
          // Extract study year from academic year (e.g., "2025/2026" -> study year based on current year)
          const currentYear = new Date().getFullYear();
          let studyYear = 1;
          if (exam.academicYear) {
            const yearMatch = exam.academicYear.match(/(\d{4})/);
            if (yearMatch) {
              const examYear = parseInt(yearMatch[1], 10);
              studyYear = Math.max(1, Math.min(6, examYear - currentYear + 1));
            }
          }
          
          // Use the extracted semester information
          let semester = "1";
          if (exam.semester) {
            if (exam.semester.toLowerCase().includes('secondo') || exam.semester.toLowerCase().includes('second')) {
              semester = "2";
            }
          }
          
          // Use the actual exam ID from the scraped data
          const examId = `${this.config.university.id}${exam.id}`;
          
          return {
            examId: examId,
            parentExam: examId,
            year: studyYear.toString(),
            semester: semester
          };
        })
      };
      dataCourses.push(course);
    }
    
    // Generate dataExams using actual exam IDs
    for (const exam of exams) {
      const examId = `${this.config.university.id}${exam.id}`;  // Use actual exam ID
      
      // Use the extracted academic year from exam data
      const academicYear = exam.academicYear ? parseInt(exam.academicYear.split('/')[0]) : new Date().getFullYear();
      
      // Use the extracted semester information
      let semester = 1;
      if (exam.semester) {
        if (exam.semester.toLowerCase().includes('secondo') || exam.semester.toLowerCase().includes('second')) {
          semester = 2;
        }
      }
      
      const dataExam = {
        id: examId,
        parentExam: examId,
        universityId: this.config.university.id,
        course: exam.courseName || 'Unknown Course',
        courseId: exam.courseId || "unknown",
        name: exam.name || 'Unknown Exam',
        lastUpdated: new Date().toISOString(),
        deleted: null,
        goals: "", // Will be filled when we implement syllabus scraping
        chapters: [], // Will be filled when we implement syllabus scraping
        urls: [
          {
            name: "Syllabus",
            url: exam.url || ""
          }
        ],
        icon: "book",
        color: this.generateRandomColor(),
        examMode: "", // Will be filled when we implement syllabus scraping
        requirements: "", // Will be filled when we implement syllabus scraping
        cfu: exam.cfu ? exam.cfu.toString() : "", // Use extracted CFU
        language: "ITALIANO",
        teachers: [], // Will be filled when we implement syllabus scraping
        books: {
          books: [] // Will be filled when we implement syllabus scraping
        },
        metadata: {
          scrapingSession: this.sessionId,
          scrapingTimestamp: new Date().toISOString(),
          sourceUrl: exam.url,
          hasModules: false,
          hasFractions: false,
          academicYear: academicYear,
          semester: semester,
          hours: exam.hours || 0
        }
      };
      dataExams.push(dataExam);
    }
    
    return { dataExams, dataCourses };
  }

  private async saveFinalDataFiles(dataExams: any[], dataCourses: any[]): Promise<void> {
    const sessionDir = this.getSessionDataDir();
    
    // Save dataExams (step 4 - final exam data)
    const dataExamsJsonPath = path.join(sessionDir, `${this.sessionId}-4-dataExams.json`);
    const dataExamsJsonlPath = path.join(sessionDir, `${this.sessionId}-4-dataExams.jsonl`);
    
    fs.writeFileSync(dataExamsJsonPath, JSON.stringify(dataExams, null, 2));
    this.logger.info(`✓ Step 4 - Final dataExams saved to: ${dataExamsJsonPath}`);
    
    const dataExamsJsonl = dataExams.map(exam => JSON.stringify(exam)).join('\n');
    fs.writeFileSync(dataExamsJsonlPath, dataExamsJsonl);
    this.logger.info(`✓ Step 4 - Final dataExams JSONL saved to: ${dataExamsJsonlPath}`);
    
    // Save dataCourses (step 5 - final course data)
    const dataCoursesJsonPath = path.join(sessionDir, `${this.sessionId}-5-dataCourses.json`);
    const dataCoursesJsonlPath = path.join(sessionDir, `${this.sessionId}-5-dataCourses.jsonl`);
    
    fs.writeFileSync(dataCoursesJsonPath, JSON.stringify(dataCourses, null, 2));
    this.logger.info(`✓ Step 5 - Final dataCourses saved to: ${dataCoursesJsonPath}`);
    
    const dataCoursesJsonl = dataCourses.map(course => JSON.stringify(course)).join('\n');
    fs.writeFileSync(dataCoursesJsonlPath, dataCoursesJsonl);
    this.logger.info(`✓ Step 5 - Final dataCourses JSONL saved to: ${dataCoursesJsonlPath}`);
  }

  private generateRandomColor(): string {
    const colors = [
      '#FFD1DC', '#AEC6CF', '#77DD77', '#FDFD96', '#CBAACB', '#FFB347',
      '#FF6961', '#99C5C4', '#E3E4FA', '#AAF0D1', '#FFDAB9', '#CFCFC4',
      '#B2FFFF', '#F49AC2', '#BDFCC9', '#D7BDE2', '#F9E79F', '#A9DFBF',
      '#AED6F1', '#F5CBA7', '#FADBD8', '#D5F5E3', '#FDEBD0', '#E8DAEF',
      '#D6EAF8', '#FCF3CF', '#D1F2EB', '#F6DDCC', '#EBDEF0', '#D4E6F1',
      '#FAD7A0', '#E5E8E8', '#F5B7B1', '#D2B4DE', '#A3E4D7', '#F7DC6F'
    ];
    const randomIndex = Math.floor(Math.random() * colors.length);
    return colors[randomIndex];
  }

  // Parse exam data using descrapper logic from step 31
  private parseExamData(baseUrl: string, exam: any): any {
    const codeMapping: { [key: string]: number } = {};
    const codeN = codeMapping[exam.code] ?? 1;
    codeMapping[exam.code] = codeN + 1;

    const result: any = {
      baseUrl,
      url: exam.url,
      universityId: this.config.university.id,
      groupCode: `${this.config.university.id}-${exam.code}`,
      code: `${this.config.university.id}-${exam.code}-${codeN}`,
      courseId: 'TODO',
      name: exam.title,
      lastUpdated: new Date().toISOString(),
      deleted: null,
      fraction: exam.fraction ?? null,
      module: exam.module ?? null,
      color: this.generateRandomColor(),
      cfu: parseInt(exam.data['Crediti']?.[0]?.split(' ')[0] || '0'),
      hours: parseInt(exam.data['Durata']?.[0]?.split(' ')[0] || '0'),
      teachers: [
        ...(exam.data['Informazioni generali']?.['Docenti']?.split(',') ?? []),
        ...(exam.data['Informazioni generali']?.['Responsabili']?.split(',') ?? []),
        ...(exam.data['Informazioni generali']?.['Assistenti']?.split(',') ?? []),
      ].filter((x: any) => !!x).map(x => x.trim()),
      courseName: exam.data['Informazioni generali']?.['Corso di studi'] ?? null,
      coursePath: exam.data['Informazioni generali']?.['Percorso'] ?? null,
      year: +(exam.data['Anno di corso']?.[0] ?? null),
    };

    // Dynamically parse and rename keys using the mapping
    for (const [originalKey, newKey] of Object.entries(this.keyMapping)) {
      if (exam.data[originalKey]) {
        if (Array.isArray(exam.data[originalKey])) {
          result[newKey] = exam.data[originalKey][0];
        } else {
          result[newKey] = exam.data[originalKey];
        }
      }
    }

    return result;
  }

  private async printGeneratedFilesSummary(): Promise<void> {
    this.logger.info('=== GENERATED FILES SUMMARY ===');
    
    const sessionDir = this.getSessionDataDir();
    const files = fs.readdirSync(sessionDir)
      .filter(f => f.startsWith(this.sessionId))
      .sort();
    
    for (const file of files) {
      const filePath = path.join(sessionDir, file);
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(2);
      this.logger.info(`✓ ${file} (${size} KB)`);
    }
    
    this.logger.info(`Total files generated: ${files.length}`);
  }

  // ===================================================================
  // STEP 1 METHODS: DATACOURSES GENERATION
  // ===================================================================

  private async generateDataCourses(processedCourseData: any, exams: any[]): Promise<any[]> {
    this.logger.info('Generating dataCourses from exam-intermediate data with separate exam arrays by academic year...');
    
    // Read the exams-intermediate data directly to preserve year structure
    const sessionDataDir = this.getSessionDataDir();
    const examsIntermediatePath = path.join(sessionDataDir, `${this.sessionId}-exams-intermediate.json`);
    
    if (!fs.existsSync(examsIntermediatePath)) {
      throw new Error(`Exams intermediate file not found: ${examsIntermediatePath}`);
    }
    
    const examsIntermediateData = JSON.parse(fs.readFileSync(examsIntermediatePath, 'utf8'));
    
    const dataCourses: any[] = [];
    const courseMap = new Map<string, any>();
    
    // Function to normalize semester names
    const normalizeSemester = (semester: string): string => {
      if (!semester) return "Unknown";
      
      const lowerSemester = semester.toLowerCase().trim();

      
      
      // First semester variations
      if (lowerSemester.includes('primo') || 
          lowerSemester.includes('first') || 
          lowerSemester === '1' ||
          lowerSemester.includes('i semestre')) {
        return "First Semester";
      }
      
      // Second semester variations  
      if (lowerSemester.includes('secondo') || 
          lowerSemester.includes('second') || 
          lowerSemester === '2' ||
          lowerSemester.includes('ii semestre')) {
        return "Second Semester";
      }
      
      // Annual course
      if (lowerSemester.includes('annual') || 
          lowerSemester.includes('annuale')) {
        return "Annual";
      }
      
      // Return original if no match
      return semester;
    };
    
    // Process the hierarchical exam data
    for (const courseName in examsIntermediateData) {
      // Extract course ID from course name [ID] FORMAT
      const courseIdMatch = courseName.match(/\[([^\]]+)\]/);
      const courseId = `${this.config.university.id}${courseIdMatch ? courseIdMatch[1] : 'unknown'}`;
      const cleanCourseName = courseName.replace(/\[[^\]]+\]\s*/, '').trim();
      
      if (!courseMap.has(courseId)) {
        courseMap.set(courseId, {
          id: courseId,
          universityId: this.config.university.id,
          name: cleanCourseName,
          lastUpdated: new Date().toISOString(),
          deleted: null,
          // Instead of single 'exams' array, we'll have exams2025, exams2024, etc.
          type: this.config.university.type || "ciclounico"
        });
      }
      
      const course = courseMap.get(courseId);
      
      // Process each path in the course
      for (const pathName in examsIntermediateData[courseName]) {
        // Process each academic year
        for (const academicYear in examsIntermediateData[courseName][pathName]) {
          const yearData = examsIntermediateData[courseName][pathName][academicYear];
          
          // Extract just the first year from academic year (e.g., "2025" from "2025/2026")
          const yearOnly = academicYear.split('/')[0];
          
          // Create exam array for this academic year if it doesn't exist
          const examArrayKey = `exams${yearOnly}`;
          if (!course[examArrayKey]) {
            course[examArrayKey] = [];
            course[`${examArrayKey}Ids`] = new Set(); // Track unique exam IDs for this year
          }
          
          // Process each study year (1, 2, 3, etc.)
          for (const studyYear in yearData.exams) {
            const examsInYear = yearData.exams[studyYear];
            
            for (const exam of examsInYear) {
              const examId = `${this.config.university.id}${exam.id}`;
              
              // Check if we already have this exam in this academic year
              const existingExamIndex = course[examArrayKey].findIndex((e: any) => e.examId === examId);
              
              const newExam = {
                examId: examId,
                name: exam.name,
                year: studyYear, // Use the actual study year from the structure
                semester: normalizeSemester(exam.semester),
                CFU: exam.cfu || null,
                parentExamId: exam.parentExamId ? `${this.config.university.id}${exam.parentExamId}` : null,
                parentExamName: exam.parentExamName || null,
                isSubexam: exam.isSubexam || false
              };
              
              if (existingExamIndex === -1) {
                // No duplicate, add the exam
                course[`${examArrayKey}Ids`].add(examId);
                course[examArrayKey].push(newExam);
              } else {
                // Duplicate found, check which one has better data
                const existingExam = course[examArrayKey][existingExamIndex];
                
                // Calculate "completeness score" for both exams
                const existingScore = this.calculateExamCompleteness(existingExam);
                const newScore = this.calculateExamCompleteness(newExam);
                
                // Replace if new exam has better data
                if (newScore > existingScore) {
                  this.logger.debug(`Replacing exam ${examId} in ${academicYear} with more complete data (score: ${existingScore} -> ${newScore})`);
                  course[examArrayKey][existingExamIndex] = newExam;
                }
              }
            }
          }
        }
      }
    }
    
    // Convert map to array and remove the tracking sets
    courseMap.forEach(course => {
      // Remove all tracking sets
      Object.keys(course).forEach(key => {
        if (key.endsWith('Ids')) {
          delete course[key];
        }
      });
      dataCourses.push(course);
    });
    
    // Log summary of academic years found
    const academicYears = new Set();
    dataCourses.forEach(course => {
      Object.keys(course).forEach(key => {
        if (key.startsWith('exams') && key !== 'exams') {
          academicYears.add(key.replace('exams', ''));
        }
      });
    });
    
    this.logger.info(`Generated ${dataCourses.length} course records with separate exam arrays for academic years: ${Array.from(academicYears).sort().join(', ')}`);
    return dataCourses;
  }

  private calculateExamCompleteness(exam: any): number {
    let score = 0;
    
    // Basic info (always present)
    score += 1; // examId
    score += 1; // name
    
    // Year info (should always be present now)
    if (exam.year && exam.year !== 'Unknown') {
      score += 2;
    }
    
    // Semester info (very important)
    if (exam.semester && exam.semester !== 'Unknown') {
      score += 3;
    }
    
    // CFU info (very important)
    if (exam.CFU && exam.CFU > 0) {
      score += 3;
    }
    
    // Parent/subexam relationship info (bonus points)
    if (exam.parentExamId) {
      score += 1; // This is a subexam with proper parent reference
    }
    
    return score;
  }

  private async saveDataCourses(dataCourses: any[]): Promise<void> {
    const outputPath = path.join(this.getSessionDataDir(), `${this.sessionId}-dataCourses.json`);
    const outputPathJsonl = path.join(this.getSessionDataDir(), `${this.sessionId}-dataCourses.jsonl`);
    
    // Save JSON format
    fs.writeFileSync(outputPath, JSON.stringify(dataCourses, null, 2));
    
    // Save JSONL format
    const jsonlContent = dataCourses.map(course => JSON.stringify(course)).join('\n');
    fs.writeFileSync(outputPathJsonl, jsonlContent);
    
    this.logger.info(`✓ dataCourses.json saved: ${outputPath}`);
    this.logger.info(`✓ dataCourses.jsonl saved: ${outputPathJsonl}`);
  }

  // ===================================================================
  // STEP 2 METHODS: DATAEXAMS GENERATION
  // ===================================================================

  private async generateDataExams(detailedExams: any[], processedCourseData: any): Promise<any[]> {
    this.logger.info('Generating dataExams from detailed exam data...');
    
    const dataExams: any[] = [];
    const codeMapping: { [key: string]: number } = {};

    for (const exam of detailedExams) {
      // Generate unique code
      const codeN = codeMapping[exam.code] ?? 1;
      codeMapping[exam.code] = codeN + 1;

      const examRecord: any = {
        id: `${this.config.university.id}-${exam.code}-${codeN}`,
        parentExam: `${this.config.university.id}-${exam.code}`,
        universityId: this.config.university.id,
        course: exam.courseName || 'Unknown',
        courseId: exam.courseId || 'Unknown',
        name: exam.title || exam.name,
        lastUpdated: new Date().toISOString(),
        deleted: null,
        
        // Module and fraction info
        module: exam.module || null,
        fraction: exam.fraction || null,
        hasModules: !!exam.module,
        hasFractions: !!exam.fraction,
        
        // Basic info
        cfu: this.parseNumber(exam.data?.['Crediti']?.[0]) || null,
        hours: this.parseNumber(exam.data?.['Durata']?.[0]) || null,
        year: this.parseNumber(exam.data?.['Anno di corso']?.[0]) || null,
        
        // Teachers
        teachers: this.extractTeachers(exam.data),
        
        // URL info
        urls: [{
          name: 'Syllabus',
          url: exam.url
        }],
        
        // Visual
        icon: 'book',
        color: this.generateRandomColor(),
        
        // Content fields (mapped from Italian)
        goals: this.extractMappedField(exam.data, ['Obiettivi formativi', 'Obiettivi formativi e risultati di apprendimento attesi', 'Obiettivi formativi per il gruppo studenti']) || '',
        chapters: this.extractMappedField(exam.data, ['Contenuti', 'Contenuti per il gruppo studenti', 'Contenuti/Programma del corso']) || '',
        books: this.extractMappedField(exam.data, ['Testi', 'Testi per il gruppo studenti', 'Libri di testo/Libri consigliati']) || '',
        requirements: this.extractMappedField(exam.data, ['Prerequisiti', 'Prerequisiti per il gruppo studenti']) || '',
        teachingMethods: this.extractMappedField(exam.data, ['Metodi didattici', 'Metodi didattici per il gruppo studenti', 'Metodi didattici utilizzati e attività di apprendimento richieste allo studente']) || '',
        learningAssessment: this.extractMappedField(exam.data, ["Verifica dell'apprendimento", "Verifica dell'apprendimento per il gruppo studenti", "Metodi di accertamento e criteri di valutazione"]) || '',
        extendedProgram: this.extractMappedField(exam.data, ['Programma esteso', 'Programma esteso per il gruppo studenti']) || '',
        onlineResources: this.extractMappedField(exam.data, ['Risorse online', 'Risorse online per il gruppo studenti']) || '',
        other: this.extractMappedField(exam.data, ['Altro', 'Altre informazioni', 'Altro per il gruppo studenti']) || '',
        
        // Academic fields
        courseType: this.extractMappedField(exam.data, ['Tipo di corso']),
        activityType: this.extractMappedField(exam.data, ['Tipo Attività Formativa']),
        field: this.extractMappedField(exam.data, ['Ambito']),
        language: this.extractMappedField(exam.data, ['Lingua di erogazione']),
        evaluation: this.extractMappedField(exam.data, ['Valutazione']),
        teachingPeriod: this.extractMappedField(exam.data, ['Periodo didattico']),
        disciplinarySector: this.extractMappedField(exam.data, ['Settore scientifico disciplinare']),
        location: this.extractMappedField(exam.data, ['Sede'])
      };

      dataExams.push(examRecord);
    }

    this.logger.info(`Generated ${dataExams.length} exam records`);
    return dataExams;
  }

  private async saveDataExams(dataExams: any[]): Promise<void> {
    const outputPath = path.join(this.getSessionDataDir(), `${this.sessionId}-dataExams.json`);
    const outputPathJsonl = path.join(this.getSessionDataDir(), `${this.sessionId}-dataExams.jsonl`);
    
    // Save JSON format
    fs.writeFileSync(outputPath, JSON.stringify(dataExams, null, 2));
    
    // Save JSONL format
    const jsonlContent = dataExams.map(exam => JSON.stringify(exam)).join('\n');
    fs.writeFileSync(outputPathJsonl, jsonlContent);
    
    this.logger.info(`✓ dataExams.json saved: ${outputPath}`);
    this.logger.info(`✓ dataExams.jsonl saved: ${outputPathJsonl}`);
  }

  // ===================================================================
  // INDIVIDUAL EXAM PROCESSING
  // ===================================================================

  public async runIndividualExamProcessing(sessionId?: string): Promise<void> {
    this.logger.info('🔍 STARTING INDIVIDUAL EXAM PROCESSING');
    this.logger.info('=====================================');
    
    const targetSessionId = sessionId || this.sessionId;
    
    // Check if intermediate exam file exists
    const sessionDir = path.join(process.cwd(), this.config.output.dataDir, targetSessionId);
    const intermediateFile = path.join(sessionDir, `${targetSessionId}-exams-intermediate.json`);
    
    if (!fs.existsSync(intermediateFile)) {
      throw new Error(`Intermediate exam file not found: ${intermediateFile}`);
    }
    
    this.logger.info(`📄 Found intermediate file: ${intermediateFile}`);
    
    // Import and create processor
    const { IndividualExamProcessor } = await import('./IndividualExamProcessor');
    const processor = new IndividualExamProcessor(this.config, this.logger, this.progressTracker, targetSessionId);
    
    try {
      // Process all exams individually
      await processor.processAllExamsFromIntermediate(intermediateFile);
      
      // Generate final dataExams file
      await processor.generateFinalDataExams();
      
      this.logger.info('✅ Individual exam processing completed successfully!');
      
    } catch (error) {
      this.logger.error('Individual exam processing failed', error);
      throw error;
    }
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private parseNumber(value: string | undefined): number | null {
    if (!value) return null;
    const match = value.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private extractTeachers(data: any): string[] {
    const teachers: string[] = [];
    
    if (data?.['Informazioni generali']) {
      const generalInfo = data['Informazioni generali'];
      
      // Extract from various teacher fields
      const teacherFields = ['Docenti', 'Responsabili', 'Assistenti'];
      
      for (const field of teacherFields) {
        if (generalInfo[field]) {
          const teacherString = generalInfo[field];
          if (typeof teacherString === 'string') {
            teachers.push(...teacherString.split(',').map(t => t.trim()).filter(t => t));
          }
        }
      }
    }
    
    return [...new Set(teachers)]; // Remove duplicates
  }

  private extractMappedField(data: any, fieldNames: string[]): string | null {
    if (!data) return null;
    
    for (const fieldName of fieldNames) {
      if (data[fieldName]) {
        const value = data[fieldName];
        if (Array.isArray(value)) {
          return value[0] || null;
        }
        return value || null;
      }
    }
    
    return null;
  }

  private async generateDataCoursesVisualization(): Promise<void> {
    try {
      this.logger.info('Generating dataCourses visualization...');
      
      const sessionDir = this.getSessionDataDir();
      const dataCoursesPath = path.join(sessionDir, `${this.sessionId}-dataCourses.json`);
      
      if (!fs.existsSync(dataCoursesPath)) {
        this.logger.warn('dataCourses.json not found, skipping visualization');
        return;
      }
      
      const dataCourses = JSON.parse(fs.readFileSync(dataCoursesPath, 'utf8'));
      
      // Create visualization HTML
      const visualizationHtml = this.createDataCoursesVisualizationHtml(dataCourses);
      
      // Save to reports directory
      const reportsDir = path.join(this.config.output.reportsDir, this.sessionId);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const visualizationPath = path.join(reportsDir, `${this.sessionId}-dataCourses-visualization.html`);
      fs.writeFileSync(visualizationPath, visualizationHtml);
      
      this.logger.info(`✓ dataCourses visualization saved: ${visualizationPath}`);
      
    } catch (error) {
      this.logger.error('Failed to generate dataCourses visualization:', error);
    }
  }

  private createDataCoursesVisualizationHtml(dataCourses: any[]): string {
    const totalCourses = dataCourses.length;
    let totalExams = 0;
    const academicYears = new Set<string>();
    
    // Calculate statistics
    dataCourses.forEach(course => {
      Object.keys(course).forEach(key => {
        if (key.startsWith('exams') && key !== 'exams' && Array.isArray(course[key])) {
          totalExams += course[key].length;
          academicYears.add(key.replace('exams', ''));
        }
      });
    });
    
    // Create course table HTML
    let courseTableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Course Name</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Total Exams</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Academic Years</th>
          </tr>
        </thead>
        <tbody>`;
    
    dataCourses.forEach(course => {
      const courseExamCount = Object.keys(course)
        .filter(key => key.startsWith('exams') && key !== 'exams' && Array.isArray(course[key]))
        .reduce((sum, key) => sum + course[key].length, 0);
      
      const courseAcademicYears = Object.keys(course)
        .filter(key => key.startsWith('exams') && key !== 'exams' && Array.isArray(course[key]))
        .map(key => key.replace('exams', ''))
        .sort()
        .join(', ');
      
      courseTableHtml += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 12px;">${course.name}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${courseExamCount}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${courseAcademicYears}</td>
        </tr>`;
    });
    
    courseTableHtml += `
        </tbody>
      </table>`;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>dataCourses Visualization - ${this.sessionId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: flex; justify-content: space-around; margin-bottom: 30px; }
        .stat-box { text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 8px; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007cba; }
        .stat-label { font-size: 1.2em; color: #666; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
    </style>
</head>
<body>
    <div class="header">
        <h1>dataCourses Visualization</h1>
        <p>Session: <strong>${this.sessionId}</strong></p>
        <p>Generated: <strong>${new Date().toLocaleString()}</strong></p>
    </div>
    
    <div class="stats">
        <div class="stat-box">
            <div class="stat-number">${totalCourses}</div>
            <div class="stat-label">Total Courses</div>
        </div>
        <div class="stat-box">
            <div class="stat-number">${totalExams}</div>
            <div class="stat-label">Total Exams</div>
        </div>
        <div class="stat-box">
            <div class="stat-number">${academicYears.size}</div>
            <div class="stat-label">Academic Years</div>
        </div>
    </div>
    
    <h2>Course Details</h2>
    <p><strong>Academic Years Found:</strong> ${Array.from(academicYears).sort().join(', ')}</p>
    
    ${courseTableHtml}
</body>
</html>`;
  }
}

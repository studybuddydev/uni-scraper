import { Config } from './core/Config';
import { Session } from './core/Session';
import { Logger } from './utils/Logger';
import { ProgressTracker } from './utils/ProgressTracker';
import { Validator } from './utils/Validator';
import { CourseDiscoveryScraper } from './scrapers/CourseDiscoveryScraper';
import { ExamDetailScraper } from './scrapers/ExamDetailScraper';
import { DataProcessor } from './processors/DataProcessor';
import { 
  ScrapingConfig, 
  ScrapingResult, 
  Course, 
  Exam, 
  DataExam, 
  DataCourse,
  ScrapingSession 
} from './types';

/**
 * Main Agentic Scraper v2
 * 
 * Orchestrates the complete university data scraping process with:
 * - Course discovery
 * - Exam extraction  
 * - Detailed syllabus scraping
 * - Data processing and validation
 * - Output generation
 */

export class AgenticScraper {
  private config: Config;
  private session: Session;
  private logger: Logger;
  private progressTracker: ProgressTracker;
  private validator: Validator;
  
  private courseDiscovery: CourseDiscoveryScraper;
  private examDetailScraper: ExamDetailScraper;
  private dataProcessor: DataProcessor;

  constructor(customConfig?: Partial<ScrapingConfig>, sessionId?: string) {
    // Initialize configuration
    this.config = new Config(customConfig);
    
    // Validate configuration
    const configValidation = this.config.validate();
    if (!configValidation.isValid) {
      throw new Error(`Invalid configuration: ${configValidation.errors.join(', ')}`);
    }

    // Initialize session
    this.session = new Session(this.config.get(), sessionId);
    
    // Initialize utilities
    this.logger = new Logger(
      this.config.getOutputConfig().logsDir, 
      this.session.getId()
    );
    this.progressTracker = new ProgressTracker(this.logger);
    this.validator = new Validator();

    // Initialize scrapers
    const scrapingConfig = this.config.get();
    this.courseDiscovery = new CourseDiscoveryScraper(scrapingConfig, this.logger);
    this.examDetailScraper = new ExamDetailScraper(scrapingConfig, this.logger);
    this.dataProcessor = new DataProcessor(scrapingConfig, this.logger, this.session);

    this.logger.info(`AgenticScraper v2 initialized with session: ${this.session.getId()}`);
  }

  /**
   * Run the complete scraping pipeline
   */
  public async scrapeAll(): Promise<ScrapingResult<{ 
    courses: Course[], 
    exams: Exam[], 
    dataExams: DataExam[], 
    dataCourses: DataCourse[] 
  }>> {
    const startTime = Date.now();
    
    try {
      this.session.updateStatus('running');
      this.session.setStep(1, 5);
      
      // Step 1: Discover Courses
      this.logger.separator('COURSE DISCOVERY');
      const coursesResult = await this.discoverCourses();
      if (!coursesResult.success) {
        throw new Error(`Course discovery failed: ${coursesResult.error?.message}`);
      }
      const courses = coursesResult.data!;
      this.session.incrementProgress('coursesDiscovered');
      this.session.setOutput('courses', this.session.saveToFile('1-courses.json', courses));

      // Step 2: Extract Basic Exam Data
      this.logger.separator('BASIC EXAM EXTRACTION');
      this.session.setStep(2, 5);
      const basicExamsResult = await this.extractBasicExams(courses);
      if (!basicExamsResult.success) {
        throw new Error(`Basic exam extraction failed: ${basicExamsResult.error?.message}`);
      }
      const basicExams = basicExamsResult.data!;
      this.session.incrementProgress('examsExtracted');
      this.session.setOutput('exams', this.session.saveToFile('2-basic-exams.json', basicExams));

      // Step 3: Scrape Detailed Syllabus Information
      this.logger.separator('DETAILED SYLLABUS SCRAPING');
      this.session.setStep(3, 5);
      const detailedExamsResult = await this.scrapeDetailedSyllabus(basicExams);
      if (!detailedExamsResult.success) {
        throw new Error(`Detailed syllabus scraping failed: ${detailedExamsResult.error?.message}`);
      }
      const detailedExams = detailedExamsResult.data!;
      this.session.incrementProgress('syllabusScraped');
      this.session.saveToFile('3-detailed-exams.json', detailedExams);
      
      // Step 4: Process and Convert Data
      this.logger.separator('DATA PROCESSING');
      this.session.setStep(4, 5);
      const processedDataResult = await this.processData(courses, detailedExams);
      if (!processedDataResult.success) {
        throw new Error(`Data processing failed: ${processedDataResult.error?.message}`);
      }
      const { dataExams, dataCourses } = processedDataResult.data!;
      this.session.setOutput('dataExams', this.session.saveToFile('4-dataExams.json', dataExams));
      this.session.setOutput('dataCourses', this.session.saveToFile('5-dataCourses.json', dataCourses));

      // Step 5: Validation
      this.logger.separator('VALIDATION');
      this.session.setStep(5, 5);
      await this.validateResults(courses, detailedExams);

      // Generate final report
      await this.generateReport();

      const duration = Date.now() - startTime;
      this.session.updateStatus('completed');
      
      this.logger.separator('SCRAPING COMPLETED');
      this.logger.info(`Total duration: ${Math.round(duration / 1000)}s`);
      this.progressTracker.printSummary();

      return {
        success: true,
        data: {
          courses,
          exams: detailedExams,
          dataExams,
          dataCourses
        },
        metadata: {
          duration,
          attempts: 1,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      this.session.updateStatus('failed');
      this.logger.error('Scraping pipeline failed', error);
      
      return {
        success: false,
        error: {
          type: 'course_discovery',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          attempts: 1
        }
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Discover courses only
   */
  public async discoverCourses(): Promise<ScrapingResult<Course[]>> {
    try {
      this.logger.info('Starting course discovery...');
      return await this.courseDiscovery.scrape({});
    } catch (error) {
      this.logger.error('Course discovery failed', error);
      return {
        success: false,
        error: {
          type: 'course_discovery',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          attempts: 1
        }
      };
    }
  }

  /**
   * Extract basic exam data from courses
   */
  public async extractBasicExams(courses: Course[]): Promise<ScrapingResult<Exam[]>> {
    try {
      this.logger.info(`Extracting basic exam data from ${courses.length} courses...`);
      
      // Convert courses to basic exams
      const basicExams: Exam[] = [];
      
      for (const course of courses) {
        // This would be implemented to extract exam URLs from course pages
        // For now, we'll create a placeholder structure
        const courseExams = await this.extractExamsFromCourse(course);
        basicExams.push(...courseExams);
      }

      return {
        success: true,
        data: basicExams
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'exam_extraction',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          attempts: 1
        }
      };
    }
  }

  /**
   * Scrape detailed syllabus information
   */
  public async scrapeDetailedSyllabus(basicExams: Exam[]): Promise<ScrapingResult<Exam[]>> {
    try {
      this.logger.info(`Scraping detailed syllabus for ${basicExams.length} exams...`);
      this.progressTracker.start(basicExams.length);
      
      return await this.examDetailScraper.scrape(basicExams);
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'syllabus_scraping',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          attempts: 1
        }
      };
    }
  }

  /**
   * Process data into final formats
   */
  public async processData(courses: Course[], exams: Exam[]): Promise<ScrapingResult<{ 
    dataExams: DataExam[], 
    dataCourses: DataCourse[] 
  }>> {
    try {
      this.logger.info('Processing data into final formats...');
      return await this.dataProcessor.processToFinalFormat(courses, exams);
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'data_processing',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          attempts: 1
        }
      };
    }
  }

  /**
   * Validate all results
   */
  public async validateResults(courses: Course[], exams: Exam[]): Promise<void> {
    this.logger.info('Validating results...');
    
    const courseValidation = this.validator.validateCourses(courses);
    const examValidation = this.validator.validateExams(exams);
    const consistencyValidation = this.validator.validateDataConsistency(courses, exams);

    // Log validation results
    this.logger.info(`Course validation: ${courseValidation.summary.validItems}/${courseValidation.summary.totalItems} valid`);
    this.logger.info(`Exam validation: ${examValidation.summary.validItems}/${examValidation.summary.totalItems} valid`);
    
    if (courseValidation.errors.length > 0) {
      this.logger.warn(`Found ${courseValidation.errors.length} course validation errors`);
    }
    
    if (examValidation.errors.length > 0) {
      this.logger.warn(`Found ${examValidation.errors.length} exam validation errors`);
    }

    if (consistencyValidation.errors.length > 0) {
      this.logger.warn(`Found ${consistencyValidation.errors.length} consistency errors`);
    }

    // Save validation reports
    this.session.saveToFile('validation-courses.json', courseValidation);
    this.session.saveToFile('validation-exams.json', examValidation);
    this.session.saveToFile('validation-consistency.json', consistencyValidation);
  }

  /**
   * Generate comprehensive report
   */
  public async generateReport(): Promise<void> {
    this.logger.info('Generating final report...');
    
    const sessionData = this.session.getSession();
    const fileSummary = this.session.getFileSummary();
    
    const report = {
      session: sessionData,
      files: fileSummary,
      generatedAt: new Date().toISOString()
    };
    
    this.session.saveToFile('final-report.json', report);
    this.logger.info('Final report generated');
  }

  /**
   * Get session information
   */
  public getSession(): ScrapingSession {
    return this.session.getSession();
  }

  /**
   * Get session directory
   */
  public getSessionDir(): string {
    return this.session.getSessionDir();
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      await this.courseDiscovery.cleanup();
      await this.examDetailScraper.cleanup();
      this.logger.info('Cleanup completed');
    } catch (error) {
      this.logger.warn('Cleanup failed', error);
    }
  }

  // Private helper methods
  private async extractExamsFromCourse(course: Course): Promise<Exam[]> {
    // This is a placeholder - would be implemented to extract exam data from course pages
    // For now, return empty array
    return [];
  }

  // Static methods for session management
  public static listSessions(dataDir?: string): Array<{ id: string; status: string; startTime: string; endTime?: string }> {
    const dir = dataDir || './data';
    return Session.listSessions(dir);
  }

  public static loadSession(sessionId: string, dataDir?: string): AgenticScraper {
    const dir = dataDir || './data';
    const session = Session.loadSession(sessionId, dir);
    
    const scraper = new AgenticScraper(session.getSession().config, sessionId);
    return scraper;
  }

  public static cleanupOldSessions(dataDir?: string, keepCount: number = 5): void {
    const dir = dataDir || './data';
    Session.cleanupOldSessions(dir, keepCount);
  }
}

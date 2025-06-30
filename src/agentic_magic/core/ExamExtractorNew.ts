import puppeteer, { Browser, Page } from 'puppeteer';
import { ScrapingConfig, ScrapingResult, ExamData, ErrorType } from '../types';
import { Logger } from '../utils/Logger';
import { RetryManager } from '../utils/RetryManager';
import { ProgressTracker } from '../utils/ProgressTracker';
import fs from 'fs';
import path from 'path';

interface ExamInfo {
  id: string;
  name: string;
  url: string;
  courseId?: string;
  courseName?: string;
  academicYear?: string;
  semester?: string;
  cfu?: number;
  hours?: number;
}

interface CoursePathsYears {
  courses: { [courseName: string]: string };
  pathsyears: {
    [courseName: string]: {
      [pathName: string]: {
        [year: string]: string;
      };
    };
  };
}

interface YearExams {
  [year: string]: Array<{
    id: string;
    name: string;
    url: string;
    academicYear: string;
    semester: string;
    cfu: number;
    hours: number;
  }>;
}

interface CourseExamData {
  [courseName: string]: {
    [pathName: string]: {
      [year: string]: {
        url: string;
        exams: YearExams;
      };
    };
  };
}

export class ExamExtractorNew {
  private config: ScrapingConfig;
  private logger: Logger;
  private retryManager: RetryManager;
  private progressTracker: ProgressTracker;
  private browser: Browser | null = null;
  private sessionId: string;

  constructor(config: ScrapingConfig, logger: Logger, progressTracker: ProgressTracker, sessionId: string) {
    this.config = config;
    this.logger = logger;
    this.retryManager = new RetryManager(logger, {
      maxRetries: config.scraping.maxRetries,
      baseDelay: config.scraping.retryDelay,
      backoffFactor: 2
    });
    this.progressTracker = progressTracker;
    this.sessionId = sessionId;
  }

  public async extractExamsFromCourseData(processedCourseDataPath?: string): Promise<ScrapingResult<ExamInfo[]>> {
    const startTime = Date.now();
    this.logger.info('Starting exam extraction from course data');

    try {
      await this.initializeBrowser();
      
      // Load the processed course data - either from provided path or look for it
      let coursesFilePath: string;
      
      if (processedCourseDataPath) {
        coursesFilePath = processedCourseDataPath;
      } else {
        // This should not happen - we need the processed data path
        throw new Error('Processed course data path must be provided');
      }
      
      if (!fs.existsSync(coursesFilePath)) {
        throw new Error(`Processed course data file not found at ${coursesFilePath}`);
      }

      const courseData: CoursePathsYears = JSON.parse(fs.readFileSync(coursesFilePath, 'utf8'));
      
      // Count total URLs to process
      let totalUrls = 0;
      for (const courseName in courseData.pathsyears) {
        for (const pathName in courseData.pathsyears[courseName]) {
          for (const year in courseData.pathsyears[courseName][pathName]) {
            if (courseData.pathsyears[courseName][pathName][year]) {
              totalUrls++;
            }
          }
        }
      }

      this.logger.info(`Found ${totalUrls} course/path/year combinations to process`);
      this.progressTracker.setTotal(totalUrls);

      const examData: CourseExamData = {};
      let processedCount = 0;

      // Process each course
      for (const courseName in courseData.pathsyears) {
        examData[courseName] = {};
        
        // Process each path within the course
        for (const pathName in courseData.pathsyears[courseName]) {
          examData[courseName][pathName] = {};
          
          this.logger.info(`Processing course: ${courseName} - Path: ${pathName}`);
          
          // Process each year within the path
          const yearPromises = Object.keys(courseData.pathsyears[courseName][pathName]).map(async (year) => {
            const url = courseData.pathsyears[courseName][pathName][year];
            
            if (!url) {
              this.logger.warn(`Empty URL for ${courseName} - ${pathName} - ${year}`);
              return { year, exams: {}, url: '' };
            }

            try {
              const exams = await this.extractExamsFromUrl(url);
              processedCount++;
              this.progressTracker.increment();
              this.logger.debug(`Processed ${processedCount}/${totalUrls}: ${courseName} - ${pathName} - ${year}`);
              return { year, exams, url };
            } catch (error) {
              this.logger.error(`Failed to extract exams for ${courseName} - ${pathName} - ${year}: ${error}`);
              processedCount++;
              this.progressTracker.increment();
              return { year, exams: {}, url };
            }
          });
          
          const results = await Promise.all(yearPromises);
          
          for (const { year, exams, url } of results) {
            examData[courseName][pathName][year] = { url, exams };
          }
          
          this.logger.info(`Completed course: ${courseName} - Path: ${pathName}`);
          
          // Save intermediate results to session directory
          const sessionDir = path.join(process.cwd(), this.config.output.dataDir, this.sessionId);
          if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
          }
          const outputPath = path.join(sessionDir, `${this.sessionId}-exams-intermediate.json`);
          fs.writeFileSync(outputPath, JSON.stringify(examData, null, 2));
        }
      }

      // Convert to flat exam list for compatibility
      const allExams: ExamInfo[] = this.convertToFlatExamList(examData);
      
      const duration = Date.now() - startTime;
      this.logger.info(`Exam extraction completed in ${duration}ms. Found ${allExams.length} total exams.`);

      return {
        success: true,
        data: allExams,
        metadata: {
          url: 'course-data-extraction',
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Exam extraction failed', error);

      return {
        success: false,
        error: {
          type: ErrorType.UNKNOWN,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        metadata: {
          url: 'course-data-extraction',
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };
    } finally {
      await this.cleanup();
    }
  }

  private async extractExamsFromUrl(url: string): Promise<YearExams> {
    if (!url) return {};

    return this.retryManager.executeWithRetry(
      async () => {
        const page = await this.browser!.newPage();
        await this.configurePage(page);

        try {
          this.logger.debug(`Navigating to URL: ${url}`);
          
          // Try multiple navigation strategies for better reliability
          await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 60000 // Increase timeout to 60 seconds
          });
          
          // Give Angular time to load and render
          await this.sleep(2000);
          
          // Wait for the main content container to appear
          try {
            await page.waitForSelector('.corso-insegnamenti-list, .insegnamenti-list, .content', { 
              timeout: 10000 
            });
          } catch (selectorError) {
            this.logger.warn(`Main content selector not found for ${url}, proceeding anyway`);
          }
          
          // Check if page loaded successfully
          const pageTitle = await page.title();
          this.logger.debug(`Page loaded: ${pageTitle}`);
          
          // Additional wait for dynamic content
          await this.sleep(1000);

          const exams = await page.evaluate((baseUrl) => {
            const years = document.querySelectorAll('.corso-insegnamenti-list > ul > li');
            const res: any = {};

            // Log debug information
            console.log(`Found ${years.length} year sections`);

            Array.from(years).forEach((yearList, yearIndex) => {
              if (!yearList) return;
              
              const year = yearList.getAttribute('id');
              const yearName = yearList.querySelector('h2.u-titoletto')?.textContent?.trim() || '';
              const examElements = yearList.querySelectorAll('card-insegnamento');
              
              console.log(`Year ${yearIndex}: id="${year}", name="${yearName}", exams=${examElements.length}`);
              
              res[year || yearName] = Array.from(examElements).flatMap((examElement) => {
                // Extract parent exam information
                const parentNameElement = examElement.querySelector('a');
                const parentId = parentNameElement?.textContent?.trim().match(/\[(\w+)\]/)?.[1] || '';
                const parentName = parentNameElement?.textContent?.trim()
                  .split(']').slice(1).join(']')
                  .replace(/\b(CORSO|DI|LAUREA|MAGISTRALE|A|CICLO|UNICO|TRIENNALE|IN)\b/gi, '')
                  .replace(/\s+/g, ' ')
                  .trim();
                const parentUrl = parentNameElement?.getAttribute('href') || '#';
                
                // Extract parent card information
                const cardRight = examElement.querySelector('.card-insegnamento-right');
                
                // Extract academic year (Anno di offerta)
                const yearOfferingElement = cardRight?.querySelector('.card-insegnamento-footer div:first-child');
                const yearOffering = yearOfferingElement?.textContent?.trim() || '';
                const academicYear = yearOffering.match(/(\d{4}\/\d{4})/)?.[1] || '';
                
                // Extract parent semester - look for semester information in footer divs
                const footerDivs = cardRight?.querySelectorAll('.card-insegnamento-footer div');
                let parentSemester = '';
                if (footerDivs) {
                  Array.from(footerDivs).forEach(div => {
                    const text = div.textContent?.trim() || '';
                    if (text.includes('Semestre') || text.includes('semestre')) {
                      parentSemester = text;
                    }
                  });
                }
                
                // Extract parent CFU and hours
                const parentCfuElement = cardRight?.querySelector('.card-insegnamento-cfu');
                const parentCfuText = parentCfuElement?.textContent?.trim() || '';
                const parentCfu = parentCfuText.match(/(\d+)\s*CFU/)?.[1] || '';
                
                const parentHoursElement = cardRight?.querySelector('.card-insegnamento-ore');
                const parentHoursText = parentHoursElement?.textContent?.trim() || '';
                const parentHours = parentHoursText.match(/(\d+)\s*ore/)?.[1] || '';
                
                // Check for subexams in <ul><li> structure
                const subexamsList = cardRight?.querySelector('ul');
                const allExams = [];
                
                if (subexamsList) {
                  // Has subexams - extract each subexam
                  const subexamElements = subexamsList.querySelectorAll('li');
                  console.log(`Found parent exam "${parentName}" with ${subexamElements.length} subexams`);
                  
                  Array.from(subexamElements).forEach(subexamElement => {
                    const subNameElement = subexamElement.querySelector('a');
                    const subId = subNameElement?.textContent?.trim().match(/\[(\w+)\]/)?.[1] || '';
                    const subName = subNameElement?.textContent?.trim()
                      .split(']').slice(1).join(']')
                      .replace(/\b(CORSO|DI|LAUREA|MAGISTRALE|A|CICLO|UNICO|TRIENNALE|IN)\b/gi, '')
                      .replace(/\s+/g, ' ')
                      .trim();
                    const subUrl = subNameElement?.getAttribute('href') || '#';
                    
                    // Extract subexam CFU and hours
                    const subCfuElement = subexamElement.querySelector('.card-insegnamento-cfu');
                    const subCfuText = subCfuElement?.textContent?.trim() || '';
                    const subCfu = subCfuText.match(/(\d+)\s*CFU/)?.[1] || '';
                    
                    const subHoursElement = subexamElement.querySelector('.card-insegnamento-ore');
                    const subHoursText = subHoursElement?.textContent?.trim() || '';
                    const subHours = subHoursText.match(/(\d+)\s*ore/)?.[1] || '';
                    
                    console.log(`Extracted subexam: ${subName}, CFU: ${subCfu}, Hours: ${subHours}, Parent: ${parentName}`);
                    
                    allExams.push({
                      id: subId,
                      name: subName,
                      url: subUrl ? `${baseUrl}${subUrl}` : subUrl,
                      academicYear,
                      semester: parentSemester, // Inherit semester from parent
                      cfu: subCfu ? parseInt(subCfu, 10) : 0,
                      hours: subHours ? parseInt(subHours, 10) : 0,
                      parentExamId: parentId, // Reference to parent exam
                      parentExamName: parentName,
                      isSubexam: true
                    });
                  });
                } else {
                  // No subexams - this is a standalone exam
                  console.log(`Extracted standalone exam: ${parentName}, CFU: ${parentCfu}, Hours: ${parentHours}, Year: ${academicYear}, Semester: ${parentSemester}`);
                  
                  allExams.push({
                    id: parentId,
                    name: parentName,
                    url: parentUrl ? `${baseUrl}${parentUrl}` : parentUrl,
                    academicYear,
                    semester: parentSemester,
                    cfu: parentCfu ? parseInt(parentCfu, 10) : 0,
                    hours: parentHours ? parseInt(parentHours, 10) : 0,
                    parentExamId: null,
                    parentExamName: null,
                    isSubexam: false
                  });
                }
                
                return allExams;
              }).filter((x) => x !== null && x.id && x.name);
            });
            
            console.log('Extraction result:', JSON.stringify(res, null, 2));
            return res;
          }, new URL(url).origin);

          await page.close();
          
          // Log the results
          const totalExams = Object.values(exams).reduce((total: number, yearExams: any) => total + yearExams.length, 0);
          this.logger.debug(`Extracted ${totalExams} exams from ${Object.keys(exams).length} year sections for URL: ${url}`);
          
          return exams;
        } catch (error) {
          await page.close();
          this.logger.error(`Error extracting exams from ${url}:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            url: url
          });
          throw error;
        }
      },
      `Extract exams from ${url}`
    );
  }

  private convertToFlatExamList(examData: CourseExamData): ExamInfo[] {
    const allExams: ExamInfo[] = [];
    
    for (const courseName in examData) {
      for (const pathName in examData[courseName]) {
        for (const year in examData[courseName][pathName]) {
          const yearData = examData[courseName][pathName][year];
          
          for (const yearKey in yearData.exams) {
            for (const exam of yearData.exams[yearKey]) {
              // Extract course ID from course name
              const courseIdMatch = courseName.match(/\[([^\]]+)\]/);
              const courseId = courseIdMatch ? courseIdMatch[1] : '';
              
              allExams.push({
                id: exam.id,
                name: exam.name,
                url: exam.url,
                courseId,
                courseName: courseName.replace(/\[[^\]]+\]\s*/, '').trim(),
                academicYear: exam.academicYear,
                semester: exam.semester,
                cfu: exam.cfu,
                hours: exam.hours
              });
            }
          }
        }
      }
    }
    
    return allExams;
  }

  private async initializeBrowser(): Promise<void> {
    if (this.browser) return;

    this.logger.debug('Initializing browser');
    this.browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      protocolTimeout: 60000 // Increase protocol timeout
    });
  }

  private async configurePage(page: Page): Promise<void> {
    // Set a reasonable timeout
    page.setDefaultTimeout(60000); // Increase to 60 seconds
    
    // Configure page for better Angular support
    await page.setJavaScriptEnabled(true);
    await page.setCacheEnabled(true);
    
    // Set user agent to avoid blocking
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Log all console messages for debugging
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'error') {
        this.logger.error(`Page console error: ${text}`);
      } else if (type === 'log') {
        this.logger.debug(`Page console log: ${text}`);
      } else if (type === 'warn') {
        this.logger.warn(`Page console warn: ${text}`);
      }
    });
    
    page.on('pageerror', (error) => {
      this.logger.error(`Page error: ${error.message}`, error);
    });
    
    // Handle network failures gracefully
    page.on('requestfailed', (request) => {
      this.logger.warn(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

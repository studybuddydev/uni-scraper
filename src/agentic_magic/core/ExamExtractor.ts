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
}

interface ModuleAndFraction {
  moduli: Array<{ name: string; url: string }>;
  frazioni: Array<{ name: string; url: string }>;
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

export class ExamExtractor {
  private config: ScrapingConfig;
  private logger: Logger;
  private retryManager: RetryManager;
  private progressTracker: ProgressTracker;
  private browser: Browser | null = null;

  constructor(config: ScrapingConfig, logger: Logger, progressTracker: ProgressTracker) {
    this.config = config;
    this.logger = logger;
    this.retryManager = new RetryManager(logger, {
      maxRetries: config.scraping.maxRetries,
      baseDelay: config.scraping.retryDelay,
      backoffFactor: 2
    });
    this.progressTracker = progressTracker;
  }

  public async extractExamsFromUrls(examUrls: string[]): Promise<ScrapingResult<ExamInfo[]>> {
    const startTime = Date.now();
    this.logger.info(`Starting exam extraction for ${examUrls.length} URLs`);

    try {
      await this.initializeBrowser();
      this.progressTracker.setTotal(examUrls.length);

      const allExams: ExamInfo[] = [];
      const concurrency = this.config.scraping.concurrency;
      
      // Process URLs in batches
      for (let i = 0; i < examUrls.length; i += concurrency) {
        const batch = examUrls.slice(i, i + concurrency);
        const batchPromises = batch.map(async (url, batchIndex) => {
          const globalIndex = i + batchIndex;
          return this.processExamUrl(url, globalIndex);
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            allExams.push(...result.value);
            this.progressTracker.increment(true);
          } else {
            this.progressTracker.increment(false);
            if (result.status === 'rejected') {
              this.logger.error('Batch processing failed:', result.reason);
            }
          }
        }

        // Rate limiting between batches
        if (i + concurrency < examUrls.length && this.config.scraping.delayBetweenRequests > 0) {
          await this.sleep(this.config.scraping.delayBetweenRequests);
        }
      }

      await this.closeBrowser();

      const duration = Date.now() - startTime;
      this.logger.info(`Exam extraction completed. Found ${allExams.length} exams in ${duration}ms`);

      return {
        success: true,
        data: allExams,
        metadata: {
          url: 'batch-processing',
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };

    } catch (error) {
      await this.closeBrowser();
      const duration = Date.now() - startTime;
      
      this.logger.error('Exam extraction failed:', error);
      
      return {
        success: false,
        error: {
          type: ErrorType.UNKNOWN,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        metadata: {
          url: 'batch-processing',
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };
    }
  }

  private async processExamUrl(url: string, index: number): Promise<ExamInfo[]> {
    this.logger.debug(`Processing exam URL ${index + 1}: ${url}`);

    return this.retryManager.executeWithRetry(
      async () => {
        const page = await this.browser!.newPage();
        await this.configurePage(page);

        try {
          const exams = await this.extractExamsFromPage(url, page);
          await page.close();
          return exams;
        } catch (error) {
          await page.close();
          throw error;
        }
      },
      `Extract exams from ${url}`
    );
  }

  private async extractExamsFromPage(url: string, page: Page): Promise<ExamInfo[]> {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await this.sleep(1000);

    // Extract course information
    const courseInfo = await this.extractCourseInfo(page);
    
    // Get exam list
    const examLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('.insegnamento-link a');
      return Array.from(links).map(link => ({
        name: link.textContent?.trim() || '',
        href: link.getAttribute('href') || ''
      }));
    });

    const baseUrl = new URL(url).origin;
    const exams: ExamInfo[] = [];

    for (const link of examLinks) {
      if (link.href && link.name) {
        const examUrl = link.href.startsWith('http') ? link.href : `${baseUrl}${link.href}`;
        
        // Extract exam ID from URL or name
        const examId = this.extractExamId(examUrl, link.name);
        
        exams.push({
          id: examId,
          name: link.name,
          url: examUrl,
          courseId: courseInfo.courseId,
          courseName: courseInfo.courseName
        });
      }
    }

    this.logger.debug(`Found ${exams.length} exams for course: ${courseInfo.courseName}`);
    return exams;
  }

  private async extractCourseInfo(page: Page): Promise<{ courseId: string; courseName: string }> {
    const courseInfo = await page.evaluate(() => {
      // Try to find course title and ID
      const titleElement = document.querySelector('h1, .course-title, .corso-title');
      const title = titleElement?.textContent?.trim() || '';
      
      // Extract course ID from title (usually in brackets)
      const idMatch = title.match(/\[([^\]]+)\]/);
      const courseId = idMatch ? idMatch[1] : '';
      
      // Clean course name (remove ID part)
      const courseName = title.replace(/\[[^\]]+\]\s*-?\s*/, '').trim();
      
      return { courseId, courseName };
    });

    return courseInfo;
  }

  private extractExamId(url: string, name: string): string {
    // Try to extract ID from URL
    const urlIdMatch = url.match(/\/(\d+)(?:\?|$)/);
    if (urlIdMatch) {
      return `${this.config.university.id}${urlIdMatch[1]}`;
    }

    // Try to extract from name
    const nameIdMatch = name.match(/\[([^\]]+)\]/);
    if (nameIdMatch) {
      return nameIdMatch[1];
    }

    // Fallback: generate ID from URL hash
    const urlHash = this.hashCode(url).toString();
    return `${this.config.university.id}${urlHash}`;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  public async extractDetailedExam(examUrl: string): Promise<ScrapingResult<ExamData>> {
    const startTime = Date.now();
    this.logger.debug(`Extracting detailed exam data from: ${examUrl}`);

    try {
      await this.initializeBrowser();
      const page = await this.browser!.newPage();
      await this.configurePage(page);

      const examData = await this.retryManager.executeWithRetry(
        () => this.extractExamDetails(examUrl, page),
        `Extract exam details: ${examUrl}`
      );

      await page.close();
      await this.closeBrowser();

      const duration = Date.now() - startTime;
      this.logger.debug(`Exam detail extraction completed in ${duration}ms`);

      return {
        success: true,
        data: examData,
        metadata: {
          url: examUrl,
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };

    } catch (error) {
      await this.closeBrowser();
      const duration = Date.now() - startTime;
      
      this.logger.error(`Failed to extract exam details from ${examUrl}:`, error);
      
      return {
        success: false,
        error: {
          type: ErrorType.PARSING,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        metadata: {
          url: examUrl,
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };
    }
  }

  private async extractExamDetails(url: string, page: Page): Promise<ExamData> {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await this.sleep(1000);

    // Check for modules and fractions
    const moduleInfo = await this.getModulesAndFractions(page, url);
    
    if (moduleInfo.moduli.length === 0 && moduleInfo.frazioni.length === 0) {
      // Single exam without modules
      return this.extractSingleExamData(page, url);
    } else {
      // Exam with modules or fractions
      return this.extractModularExamData(page, url, moduleInfo);
    }
  }

  private async getModulesAndFractions(page: Page, url: string): Promise<ModuleAndFraction> {
    const baseUrl = new URL(url).origin;
    
    return page.evaluate((baseUrl: string) => {
      const differenceElements = document.querySelectorAll('.insegnamento-links');
      
      if (differenceElements.length !== 2) {
        return { moduli: [], frazioni: [] };
      }

      const [moduliElement, frazioniElement] = Array.from(differenceElements);
      
      const moduli = Array.from(moduliElement.querySelectorAll('a')).map(a => ({
        name: a.textContent?.trim() || '',
        url: `${baseUrl}${a.getAttribute('href') || '#'}`
      }));

      const frazioni = Array.from(frazioniElement.querySelectorAll('a')).map(a => ({
        name: a.textContent?.trim() || '',
        url: `${baseUrl}${a.getAttribute('href') || '#'}`
      }));

      return { moduli, frazioni };
    }, baseUrl);
  }

  private async extractSingleExamData(page: Page, url: string): Promise<ExamData> {
    const rawData = await page.evaluate(() => {
      const results: any = {};

      // Extract title and code
      const codeTitle = document.querySelector('.corso-title')?.textContent?.trim() || '';
      const codeParts = codeTitle.split(']');
      const code = codeParts[0] ? codeParts[0].replace('[', '').trim() : '';
      const title = codeParts[1] ? codeParts[1].replace('-', '').trim() : codeTitle;

      // Extract accordion data
      const titleElements = document.querySelectorAll('.insegnamento-accordion .accordion > dt');
      const descriptionElements = document.querySelectorAll('.insegnamento-accordion .accordion > dd');

      const titles = Array.from(titleElements).map(t => t.textContent?.trim() || '');
      const descriptions = Array.from(descriptionElements).map(d => d.textContent?.trim() || '');

      for (let i = 1; i < titles.length; i++) {
        const sectionTitle = titles[i];
        const sectionDescription = descriptions[i];
        if (sectionTitle && sectionDescription) {
          results[sectionTitle] = sectionDescription;
        }
      }

      // Extract table data
      const tableTitle = titles[0] ?? 'General Information';
      results[tableTitle] = {};
      
      const tableHeaders = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dt');
      const tableValues = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dd');

      const headerTexts = Array.from(tableHeaders).map(h => h.textContent?.trim() || '');
      const valueTexts = Array.from(tableValues).map(v => v.textContent?.trim() || '');

      for (let i = 0; i < headerTexts.length; i++) {
        const header = headerTexts[i];
        const value = valueTexts[i];
        if (header && value) {
          results[tableTitle][header] = value;
        }
      }

      return { data: results, code, title };
    });

    // Convert raw data to structured ExamData
    return this.convertRawDataToExamData(rawData, url);
  }

  private async extractModularExamData(page: Page, url: string, moduleInfo: ModuleAndFraction): Promise<ExamData> {
    // For modular exams, we extract the main exam data and note the modules
    const mainExamData = await this.extractSingleExamData(page, url);
    
    // Add metadata about modules
    if (mainExamData.metadata) {
      mainExamData.metadata.hasModules = moduleInfo.moduli.length > 0;
      mainExamData.metadata.hasFractions = moduleInfo.frazioni.length > 0;
    }

    return mainExamData;
  }

  private convertRawDataToExamData(rawData: any, url: string): ExamData {
    const { data, code, title } = rawData;
    const generalInfo = data['General Information'] || data['Informazioni Generali'] || {};

    return {
      id: code || this.extractExamId(url, title),
      universityId: this.config.university.id,
      course: generalInfo['Corso di studio'] || generalInfo['Corso'] || '',
      courseId: this.extractCourseIdFromCourse(generalInfo['Corso di studio'] || ''),
      name: title,
      url: url,
      lastUpdated: new Date().toISOString(),
      deleted: null,
      goals: data['Obiettivi formativi'] || data['Obiettivi'] || undefined,
      examMode: data['Modalità di svolgimento dell\'esame'] || data['Modalità esame'] || undefined,
      requirements: data['Propedeuticità'] || data['Prerequisiti'] || undefined,
      cfu: generalInfo['CFU'] || generalInfo['Crediti'] || undefined,
      language: generalInfo['Lingua'] || generalInfo['Lingua di erogazione'] || undefined,
      teachers: this.extractTeachers(generalInfo['Docente'] || generalInfo['Docenti'] || ''),
      books: this.extractBooks(data['Bibliografia'] || data['Testi di riferimento'] || ''),
      chapters: this.extractChapters(data['Contenuti'] || data['Programma'] || ''),
      metadata: {
        scrapingSession: '',
        scrapingTimestamp: new Date().toISOString(),
        sourceUrl: url,
        hasModules: false,
        hasFractions: false
      }
    };
  }

  private extractCourseIdFromCourse(courseText: string): string {
    const idMatch = courseText.match(/\[([^\]]+)\]/);
    return idMatch ? idMatch[1] : '';
  }

  private extractTeachers(teacherText: string): Array<{ name: string }> {
    if (!teacherText) return [];
    
    // Split by common separators and clean
    const teachers = teacherText
      .split(/[,;]/)
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(name => ({ name }));
    
    return teachers;
  }

  private extractBooks(bibliographyText: string): { books: Array<{ name: string; authors: string[]; year?: number }> } {
    if (!bibliographyText) return { books: [] };
    
    // This is a simplified extraction - in reality, you'd want more sophisticated parsing
    const books = bibliographyText
      .split(/\n|;/)
      .map(b => b.trim())
      .filter(b => b.length > 0)
      .map(bookText => {
        // Try to extract year
        const yearMatch = bookText.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : undefined;
        
        // Basic book title extraction (this could be improved)
        const name = bookText.replace(/\b(19|20)\d{2}\b/, '').trim();
        
        return {
          name,
          authors: [], // Authors extraction would need more sophisticated parsing
          year
        };
      });

    return { books };
  }

  private extractChapters(contentText: string): Array<{ name: string; showTasks: boolean; tasks: Array<{ name: string }>; postIts: any[] }> {
    if (!contentText) return [];
    
    // Split content into chapters (this is a simplified approach)
    const chapters = contentText
      .split(/\n\s*\n|\d+\.\s+/)
      .map(c => c.trim())
      .filter(c => c.length > 0)
      .map(chapterText => ({
        name: chapterText.split('\n')[0] || chapterText.substring(0, 100),
        showTasks: true,
        tasks: [{ name: chapterText }],
        postIts: []
      }));

    return chapters;
  }

  private async initializeBrowser(): Promise<void> {
    if (!this.browser) {
      this.logger.debug('Initializing browser for exam extraction');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
    }
  }

  private async configurePage(page: Page): Promise<void> {
    await page.setUserAgent(this.config.scraping.userAgent);
    await page.setDefaultTimeout(this.config.scraping.timeout);
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

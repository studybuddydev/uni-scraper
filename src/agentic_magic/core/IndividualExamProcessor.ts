import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { ScrapingConfig } from '../types';
import { Logger } from '../utils/Logger';
import { RetryManager } from '../utils/RetryManager';
import { ProgressTracker } from '../utils/ProgressTracker';

interface ExamInfo {
  id: string;
  name: string;
  url: string;
  academicYear?: string;
  semester?: string;
  cfu?: number;
  hours?: number;
  courseId?: string;
  courseName?: string;
  pathName?: string;
  year?: string;
  parentExamId?: string | null;
  parentExamName?: string | null;
  isSubexam?: boolean;
  hasSubexams?: boolean;
}

interface DetailedExamData extends ExamInfo {
  syllabusExtracted: boolean;
  extractionTimestamp: string;
  extractionError?: string;
  immatriculationYear?: string;
  
  // Detailed syllabus information matching the target structure
  examMode?: string;
  examType?: string;
  goals?: string;
  requirements?: string;
  teachingMethods?: string;
  learningAssessment?: string;
  extendedProgram?: string;
  libraryTexts?: string;
  onlineResources?: string;
  other?: string;
  language?: string;
  courseType?: string;
  offerYear?: string;
  activityType?: string;
  field?: string;
  teachingActivityType?: string;
  evaluation?: string;
  teachingPeriod?: string;
  teachingMode?: string;
  disciplinarySector?: string;
  location?: string;
  relatedActivities?: string;
  otherPaths?: string;
  interclassType?: string;
  interclassField?: string;
  
  // Structured data
  chapters?: Array<{
    name: string;
    showTasks: boolean;
    tasks: Array<{ name: string }>;
    postIts: Array<any>;
    links: Array<any>;
  }>;
  books?: {
    books: Array<{
      name: string;
      authors: string[];
      year?: number;
      notes?: string[];
    }>;
  };
  teachers?: Array<{
    name: string;
  }>;
}

export class IndividualExamProcessor {
  private config: ScrapingConfig;
  private logger: Logger;
  private retryManager: RetryManager;
  private progressTracker: ProgressTracker;
  private browser: Browser | null = null;
  private sessionId: string;
  private individualExamsDir: string;

  // Key mapping from descrapper
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
    
    // Create directory for individual exam files
    const sessionDir = path.join(process.cwd(), this.config.output.dataDir, this.sessionId);
    this.individualExamsDir = path.join(sessionDir, 'individual-exams');
    if (!fs.existsSync(this.individualExamsDir)) {
      fs.mkdirSync(this.individualExamsDir, { recursive: true });
    }
  }

  public async processAllExamsFromIntermediate(intermediateFilePath: string): Promise<void> {
    this.logger.info('🔍 Starting individual exam processing from intermediate data');
    
    if (!fs.existsSync(intermediateFilePath)) {
      throw new Error(`Intermediate file not found: ${intermediateFilePath}`);
    }

    // Load intermediate exam data
    const intermediateData = JSON.parse(fs.readFileSync(intermediateFilePath, 'utf8'));
    
    // Extract all exams from the intermediate structure
    const allExams = this.extractAllExamsFromIntermediate(intermediateData);
    this.logger.info(`Found ${allExams.length} total exams to process`);

    // Check which exams are already processed
    const { processedExams, remainingExams } = this.checkExistingExams(allExams);
    this.logger.info(`${processedExams.length} exams already processed, ${remainingExams.length} remaining`);

    if (remainingExams.length === 0) {
      this.logger.info('✅ All exams already processed!');
      return;
    }

    // Initialize browser
    await this.initializeBrowser();
    
    try {
      // Process remaining exams
      this.progressTracker.setTotal(remainingExams.length);
      
      let successCount = 0;
      let protocolErrorCount = 0;
      let otherErrorCount = 0;
      
      for (let i = 0; i < remainingExams.length; i++) {
        const exam = remainingExams[i];
        
        this.logger.info(`Processing exam ${i + 1}/${remainingExams.length}: ${exam.name} (${exam.id})`);
        
        try {
          // First, check if this exam has fractions
          const fractions = await this.checkForFractions(exam);
          
          if (fractions.length > 0) {
            console.log(`🎯 Found ${fractions.length} fractions for exam: ${exam.name}`);
            console.log(`🎯 Fractions:`, fractions.map(f => f.name));
            
            // Process each fraction as a separate exam
            for (const fraction of fractions) {
              console.log(`🔄 Processing fraction: ${fraction.name}`);
              const detailedExam = await this.processIndividualExam({
                ...exam,
                id: `${exam.id}_${this.createFractionId(fraction.name)}`,
                name: fraction.name,
                url: fraction.url
              });
              await this.saveIndividualExam(detailedExam);
              console.log(`✅ Saved fraction: ${fraction.name}`);
            }
            successCount += fractions.length;
          } else {
            console.log(`📝 No fractions found, processing as single exam: ${exam.name}`);
            const detailedExam = await this.processIndividualExam(exam);
            await this.saveIndividualExam(detailedExam);
            successCount++;
          }
          
          this.progressTracker.increment();
          
          // Add delay between requests
          if (i < remainingExams.length - 1) {
            await this.sleep(this.config.scraping.delayBetweenRequests || 1000);
          }
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to process exam ${exam.name} (${exam.id}): ${errorMessage}`);
          
          // Check if this is a protocol error - if so, don't save the exam
          const isProtocolError = this.isProtocolError(errorMessage);
          
          if (isProtocolError) {
            this.logger.warn(`Skipping save for exam ${exam.name} due to protocol/connection error`);
            protocolErrorCount++;
            this.progressTracker.increment();
          } else {
            // Save failed exam with error info only for non-protocol errors
            const failedExam: DetailedExamData = {
              ...exam,
              syllabusExtracted: false,
              extractionTimestamp: new Date().toISOString(),
              extractionError: errorMessage
            };
            await this.saveIndividualExam(failedExam);
            otherErrorCount++;
            this.progressTracker.increment();
          }
        }
      }
      
      // Log processing summary
      this.logger.info('📊 Processing Summary:');
      this.logger.info(`   ✅ Successfully processed: ${successCount} exams`);
      this.logger.info(`   ⚠️  Protocol errors (skipped): ${protocolErrorCount} exams`);
      this.logger.info(`   ❌ Other errors (saved): ${otherErrorCount} exams`);
      this.logger.info(`   📁 Total saved files: ${successCount + otherErrorCount}`);
      
    } finally {
      await this.cleanup();
    }
    
    this.logger.info('✅ Individual exam processing completed');
  }

  public async generateFinalDataExams(): Promise<void> {
    this.logger.info('📋 Generating final dataExams from individual exam files');
    
    const examFiles = fs.readdirSync(this.individualExamsDir)
      .filter(file => file.endsWith('.json'))
      .sort();
    
    this.logger.info(`Found ${examFiles.length} individual exam files`);
    
    const finalDataExams: any[] = [];
    const codeMapping: { [key: string]: number } = {};
    
    for (const file of examFiles) {
      try {
        const filePath = path.join(this.individualExamsDir, file);
        const examData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Transform to legacy descrapper format
        const transformedExam = this.transformToLegacyFormat(examData, codeMapping);
        finalDataExams.push(transformedExam);
        
      } catch (error) {
        this.logger.warn(`Failed to read exam file ${file}: ${error}`);
      }
    }
    
    // Save final dataExams file
    const sessionDir = path.join(process.cwd(), this.config.output.dataDir, this.sessionId);
    const finalPath = path.join(sessionDir, `${this.sessionId}-dataExams.json`);
    
    fs.writeFileSync(finalPath, JSON.stringify(finalDataExams, null, 2));
    this.logger.info(`✅ Final dataExams saved to: ${finalPath}`);
    this.logger.info(`Total exams in final file: ${finalDataExams.length}`);
  }

  private transformToLegacyFormat(examData: DetailedExamData, codeMapping: { [key: string]: number }): any {
    // Use the same logic as the legacy descrapper's parseExam function
    const codeN = codeMapping[examData.id] ?? 1;
    codeMapping[examData.id] = codeN + 1;

    const res: any = {
      baseUrl: examData.url, // Use url as baseUrl for now
      url: examData.url,
      universityId: this.config.university.id,
      groupCode: `${this.config.university.id}-${examData.id}`,
      code: `${this.config.university.id}-${examData.id}-${codeN}`,
      courseId: 'TODO',
      name: examData.name,
      lastUpdated: new Date().toISOString(),
      deleted: null,
      fraction: null, // Will be set by LLM processing later
      module: null, // Will be set by LLM processing later
      color: this.getRandomColor(),
      cfu: examData.cfu || 0,
      hours: examData.hours || 0,
      teachers: examData.teachers || [],
      courseName: examData.courseName || null,
      coursePath: examData.pathName || null,
      year: examData.year ? parseInt(examData.year) : null,
    };

    // Apply the same key mapping as the legacy descrapper
    for (const [originalKey, newKey] of Object.entries(this.keyMapping)) {
      if (examData[originalKey as keyof DetailedExamData]) {
        const value = examData[originalKey as keyof DetailedExamData];
        if (Array.isArray(value)) {
          res[newKey] = value[0];
        } else {
          res[newKey] = value;
        }
      }
    }

    return res;
  }

  private getRandomColor(): string {
    const colors = [
      '#FFD1DC', '#AEC6CF', '#77DD77', '#FDFD96', '#CBAACB', '#FFB347', '#FF6961', '#99C5C4',
      '#E3E4FA', '#AAF0D1', '#FFDAB9', '#CFCFC4', '#B2FFFF', '#F49AC2', '#BDFCC9', '#D7BDE2',
      '#F9E79F', '#A9DFBF', '#AED6F1', '#F5CBA7', '#FADBD8', '#D5F5E3', '#FDEBD0', '#E8DAEF',
      '#D6EAF8', '#FCF3CF', '#D1F2EB', '#F6DDCC', '#EBDEF0', '#D4E6F1', '#FAD7A0', '#E5E8E8',
      '#F5B7B1', '#D2B4DE', '#A3E4D7', '#F7DC6F', '#EDBB99', '#F8C471', '#E6B0AA', '#A9CCE3',
      '#FDEDEC', '#D0ECE7', '#FCF3CF', '#FADBD8', '#F9E79F', '#D5DBDB', '#F1948A', '#BB8FCE',
      '#7FB3D5', '#76D7C4', '#F0B27A', '#E59866', '#EC7063', '#AF7AC5', '#F7C6C7', '#FFF5BA',
      '#C1F0F6', '#B5EAD7', '#FFDAC1', '#C7CEEA', '#FFCBC1', '#C2F0C2', '#FFFACD', '#BFD8B8',
      '#E2F0CB', '#D0E1F9'
    ];
    const randomIndex = Math.floor(Math.random() * colors.length);
    return colors[randomIndex];
  }

  private extractAllExamsFromIntermediate(data: any): ExamInfo[] {
    const allExams: ExamInfo[] = [];
    
    for (const [courseName, courseData] of Object.entries(data as any)) {
      for (const [pathName, pathData] of Object.entries(courseData as any)) {
        for (const [year, yearData] of Object.entries(pathData as any)) {
          const yearInfo = yearData as any;
          if (yearInfo.exams) {
            for (const [yearLevel, exams] of Object.entries(yearInfo.exams)) {
              if (Array.isArray(exams)) {
                for (const exam of exams) {
                  allExams.push({
                    ...exam,
                    courseId: courseName.match(/\[([^\]]+)\]/)?.[1] || '',
                    courseName: courseName,
                    pathName: pathName,
                    year: year
                  });
                }
              }
            }
          }
        }
      }
    }
    
    return allExams;
  }

  private checkExistingExams(allExams: ExamInfo[]): { processedExams: string[], remainingExams: ExamInfo[] } {
    const processedExams: string[] = [];
    const remainingExams: ExamInfo[] = [];
    
    for (const exam of allExams) {
      const fileName = this.getExamFileName(exam);
      const filePath = path.join(this.individualExamsDir, fileName);
      
      if (fs.existsSync(filePath)) {
        processedExams.push(exam.id);
      } else {
        remainingExams.push(exam);
      }
    }
    
    return { processedExams, remainingExams };
  }

  private async processIndividualExam(exam: ExamInfo): Promise<DetailedExamData> {
    return this.retryManager.executeWithRetry(
      async () => {
      const page = await this.browser!.newPage();
      
      try {
        await this.configurePage(page);
        
        this.logger.debug(`Navigating to exam URL: ${exam.url}`);
        
        await page.goto(exam.url, {
          waitUntil: 'networkidle0',
          timeout: this.config.scraping.timeout || 30000
        });
        
        await this.sleep(1000);
        
        // Extract detailed exam data using the same logic as the descrapper
        const detailedData = await this.extractExamDataFromPage(page);
        
        const detailedExam: DetailedExamData = {
          ...exam,
          ...detailedData,
          syllabusExtracted: true,
          extractionTimestamp: new Date().toISOString()
        };
        
        return detailedExam;
        
      } finally {
        await page.close();
      }
    },
    `Extract exam details for ${exam.name}`
    );
  }

  private async extractExamDataFromPage(page: Page): Promise<Partial<DetailedExamData>> {
    // Extract raw data using the same logic as the legacy descrapper
    const rawData = await page.evaluate(() => {
      const result: any = {};

      // Helper function to extract text from an element
      const getTextContent = (element: Element | null): string => {
        return element?.textContent?.trim() || '';
      };

      // Helper function to find section content by title using the same logic as descrapper
      const findSectionByTitle = (title: string): string => {
        const titleLower = title.toLowerCase();
        
        // Try different selectors for section titles
        const selectors = [
          'dt', 'h2', 'h3', 'h4', '.section-title', '.accordion-title', 
          '.info-section-title', '.syllabus-section-title', '.content-title'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = getTextContent(element).toLowerCase();
            if (text.includes(titleLower)) {
              // Look for the next sibling or parent's next sibling that contains content
              let contentElement = element.nextElementSibling;
              if (!contentElement && element.parentElement) {
                contentElement = element.parentElement.nextElementSibling;
              }
              if (contentElement) {
                return getTextContent(contentElement);
              }
            }
          }
        }
        
        return '';
      };

      // Extract all the data fields exactly as the legacy descrapper does
      
      // Course metadata
      result.courseType = findSectionByTitle('tipo di corso');
      result.offerYear = findSectionByTitle('anno di offerta');
      result.activityType = findSectionByTitle('tipo attività formativa');
      result.field = findSectionByTitle('ambito');
      result.language = findSectionByTitle('lingua di erogazione') || 'ITALIANO';
      result.teachingActivityType = findSectionByTitle('tipo attività didattica');
      result.evaluation = findSectionByTitle('valutazione');
      result.teachingPeriod = findSectionByTitle('periodo didattico');
      result.teachingMode = findSectionByTitle('modalita didattica');
      result.disciplinarySector = findSectionByTitle('settore scientifico disciplinare');
      result.location = findSectionByTitle('sede');
      result.relatedActivities = findSectionByTitle('attività correlate');
      result.otherPaths = findSectionByTitle('altri percorsi');
      result.interclassType = findSectionByTitle('tipologia interclasse');
      result.interclassField = findSectionByTitle('ambito interclasse');

      // Content fields - keep as raw strings like the descrapper
      result.chapters = findSectionByTitle('contenuti') || 
                       findSectionByTitle('contenuti per il gruppo studenti') || 
                       findSectionByTitle('contenuti/programma del corso');

      result.books = findSectionByTitle('testi') || 
                    findSectionByTitle('testi per il gruppo studenti') || 
                    findSectionByTitle('libri di testo/libri consigliati');

      result.goals = findSectionByTitle('obiettivi formativi') || 
                    findSectionByTitle('obiettivi formativi e risultati di apprendimento attesi') || 
                    findSectionByTitle('obiettivi formativi per il gruppo studenti');

      result.requirements = findSectionByTitle('prerequisiti') || 
                           findSectionByTitle('prerequisiti per il gruppo studenti');

      result.teachingMethods = findSectionByTitle('metodi didattici') || 
                              findSectionByTitle('metodi didattici per il gruppo studenti') || 
                              findSectionByTitle('metodi didattici utilizzati e attività di apprendimento richieste allo studente');

      result.learningAssessment = findSectionByTitle('verifica dell\'apprendimento') || 
                                 findSectionByTitle('verifica dell\'apprendimento per il gruppo studenti') || 
                                 findSectionByTitle('metodi di accertamento e criteri di valutazione');

      result.extendedProgram = findSectionByTitle('programma esteso') || 
                              findSectionByTitle('programma esteso per il gruppo studenti');

      result.libraryTexts = findSectionByTitle('testi disponibili nel catalogo delle biblioteche') || 
                           findSectionByTitle('testi disponibili nel catalogo delle biblioteche per il gruppo studenti');

      result.onlineResources = findSectionByTitle('risorse online') || 
                              findSectionByTitle('risorse online per il gruppo studenti');

      result.other = findSectionByTitle('altro') || 
                    findSectionByTitle('altre informazioni') || 
                    findSectionByTitle('altro per il gruppo studenti');

      return result;
    });

    return rawData;
  }

  private async saveIndividualExam(exam: DetailedExamData): Promise<void> {
    // Extract immatriculation year from URL coorte parameter
    const immatriculationYear = this.extractImmatriculationYear(exam.url);
    exam.immatriculationYear = immatriculationYear;
    
    // Create course folder (without leading underscore)
    const courseSubfolder = exam.courseId ? `${exam.courseId}_${exam.courseName?.replace(/[^a-zA-Z0-9]/g, '_') || 'UNKNOWN'}` : 'UNKNOWN_COURSE';
    const courseFolderPath = path.join(this.individualExamsDir, courseSubfolder);
    
    // Create year subfolder inside course folder
    const yearFolderPath = path.join(courseFolderPath, immatriculationYear);
    if (!fs.existsSync(yearFolderPath)) {
      fs.mkdirSync(yearFolderPath, { recursive: true });
    }
    
    const fileName = this.getExamFileName(exam);
    const filePath = path.join(yearFolderPath, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(exam, null, 2));
    this.logger.debug(`Saved exam data: ${courseSubfolder}/${immatriculationYear}/${fileName}`);
  }

  private getExamFileName(exam: ExamInfo): string {
    // Create a safe filename using exam ID, name, and academic year
    const safeName = exam.name.replace(/[^a-zA-Z0-9]/g, '_');
    const safeYear = exam.academicYear ? exam.academicYear.replace(/[^a-zA-Z0-9]/g, '_') : 'UNKNOWN_YEAR';
    return `${exam.id}_${safeName}_${safeYear}.json`;
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });
  }

  private async configurePage(page: Page): Promise<void> {
    await page.setUserAgent(this.config.scraping.userAgent);
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set longer timeout for navigation
    page.setDefaultTimeout(this.config.scraping.timeout || 30000);
    page.setDefaultNavigationTimeout(this.config.scraping.timeout || 30000);
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isProtocolError(error: string): boolean {
    const protocolErrorPatterns = [
      'protocol error',
      'connection closed',
      'websocket',
      'target closed',
      'session closed',
      'browser disconnected',
      'navigation failed',
      'net::ERR_',
      'timeout'
    ];
    
    const lowerError = error.toLowerCase();
    return protocolErrorPatterns.some(pattern => lowerError.includes(pattern));
  }

  private async detectFractions(page: Page): Promise<Array<{name: string, url: string}>> {
    return await page.evaluate(() => {
      const fractions: Array<{name: string, url: string}> = [];
      
      // Look for fraction links like the legacy descrapper
      const fractionLinks = document.querySelectorAll('a[href*="adCodFraz"]');
      
      fractionLinks.forEach(link => {
        const href = (link as HTMLAnchorElement).href;
        const name = link.textContent?.trim();
        
        if (name && href && name.includes('(')) {
          fractions.push({ name, url: href });
        }
      });
      
      return fractions;
    });
  }

  private async extractFromFraction(fraction: {name: string, url: string}, page: Page): Promise<Partial<DetailedExamData>> {
    // Navigate to the fraction URL
    await page.goto(fraction.url, {
      waitUntil: 'networkidle0',
      timeout: this.config.scraping.timeout || 30000
    });
    
    await this.sleep(1000);
    
    // Extract data from the fraction page
    return await this.extractExamDataFromPage(page);
  }

  private createFractionId(fractionName: string): string {
    // Extract the fraction identifier from names like "FILOSOFIA DEL DIRITTO (Cognomi A-L)"
    const match = fractionName.match(/\(([^)]+)\)/);
    if (match) {
      return match[1].replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    }
    // Fallback to sanitized full name
    return fractionName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').substring(0, 20);
  }

  private async checkForFractions(exam: ExamInfo): Promise<Array<{name: string, url: string}>> {
    const page = await this.browser!.newPage();
    
    try {
      await this.configurePage(page);
      
      await page.goto(exam.url, {
        waitUntil: 'networkidle0',
        timeout: this.config.scraping.timeout || 30000
      });
      
      await this.sleep(1000);
      
      return await this.detectFractions(page);
    } finally {
      await page.close();
    }
  }

  private extractImmatriculationYear(url: string): string {
    try {
      const urlObj = new URL(url);
      const coorte = urlObj.searchParams.get('coorte');
      return coorte || 'UNKNOWN_YEAR';
    } catch (error) {
      this.logger.warn(`Failed to extract immatriculation year from URL: ${url}`);
      return 'UNKNOWN_YEAR';
    }
  }
}

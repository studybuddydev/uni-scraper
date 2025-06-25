import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { Logger } from '../utils/Logger';

interface ExamDetailScraper {
  sessionId: string;
  logger: Logger;
  browser: any;
  config: {
    batchSize: number;
    delayBetweenRequests: number;
    timeout: number;
    userAgent: string;
    maxRetries: number;
  };
}

class ExamDetailScraper {
  constructor(inputFilePath: string) {
    this.sessionId = `exam-details-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    this.logger = new Logger('./logs', this.sessionId);
    this.config = {
      batchSize: 5,
      delayBetweenRequests: 2000,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      maxRetries: 3
    };
    this.logger.info(`Starting exam detail scraping session: ${this.sessionId}`);
  }

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

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async initializeBrowser() {
    this.browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    this.logger.info('Browser initialized');
  }

  // Extract detailed exam data from individual exam page
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

  // Main extraction method similar to descrapper's extractExams function
  private async extractExamsFromUrl(url: string): Promise<any[]> {
    if (!url) return [];
    
    const page = await this.browser.newPage();
    
    try {
      // Set user agent and configure page
      await page.setUserAgent(this.config.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: this.config.timeout
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

      // Log modules and fractions found
      if (modulesAndFractions.moduli.length > 0) {
        this.logger.info(`Found ${modulesAndFractions.moduli.length} modules in ${url}:`, modulesAndFractions.moduli.map((m: any) => m.name));
      }
      if (modulesAndFractions.frazioni.length > 0) {
        this.logger.info(`Found ${modulesAndFractions.frazioni.length} fractions in ${url}:`, modulesAndFractions.frazioni.map((f: any) => f.name));
      }

      // If no modules or fractions, extract single exam
      if (modulesAndFractions.moduli.length === 0 && modulesAndFractions.frazioni.length === 0) {
        this.logger.debug(`No modules/fractions found for ${url}, extracting single exam`);
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
        this.logger.info(`Processing ${modulesAndFractions.moduli.length} modules...`);
        for (const module of modulesAndFractions.moduli) {
          this.logger.debug(`  Processing module: ${module.name}`);
          const moduleResults = await this.extractExamsFromUrl(module.url);
          await this.sleep(1000);
          moduleResults.forEach((exam: any) => {
            exam.module = module.name;
          });
          results.push(...moduleResults);
        }
      }

      // Process fractions
      if (modulesAndFractions.frazioni.length > 0) {
        this.logger.info(`Processing ${modulesAndFractions.frazioni.length} fractions...`);
        for (const fraction of modulesAndFractions.frazioni) {
          this.logger.debug(`  Processing fraction: ${fraction.name}`);
          const fractionResults = await this.extractExamsFromUrl(fraction.url);
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

  // Parse exam data using descrapper logic from step 31
  private parseExamData(baseUrl: string, exam: any): any {
    const codeMapping: { [key: string]: number } = {};
    const codeN = codeMapping[exam.code] ?? 1;
    codeMapping[exam.code] = codeN + 1;

    const result: any = {
      baseUrl,
      url: exam.url,
      universityId: 'unibs',
      groupCode: `unibs-${exam.code}`,
      code: `unibs-${exam.code}-${codeN}`,
      courseId: 'TODO',
      name: exam.title,
      lastUpdated: new Date().toISOString(),
      deleted: null,
      fraction: exam.fraction ?? null,
      module: exam.module ?? null,
      color: this.generateRandomColor(),
      cfu: parseInt(exam.data['Crediti']?.[0]?.split(' ')[0] || '0') || null,
      hours: parseInt(exam.data['Durata']?.[0]?.split(' ')[0] || '0') || null,
      teachers: [
        ...(exam.data['Informazioni generali']?.['Docenti']?.split(',') ?? []),
        ...(exam.data['Informazioni generali']?.['Responsabili']?.split(',') ?? []),
        ...(exam.data['Informazioni generali']?.['Assistenti']?.split(',') ?? []),
      ].filter((x: any) => !!x).map(x => x.trim()),
      courseName: exam.data['Informazioni generali']?.['Corso di studi'] ?? null,
      coursePath: exam.data['Informazioni generali']?.['Percorso'] ?? null,
      year: +(exam.data['Anno di corso']?.[0] ?? null),
      
      // PRESERVE ALL RAW DATA - this is crucial!
      rawExamData: exam.data,
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

  private async processExamBatch(exams: any[]): Promise<any[]> {
    const results: any[] = [];
    
    for (const exam of exams) {
      let attempts = 0;
      while (attempts < this.config.maxRetries) {
        try {
          this.logger.debug(`Processing exam: ${exam.name} (${exam.url})`);
          
          // Extract detailed exam data
          const detailedExamData = await this.extractExamsFromUrl(exam.url);
          
          // Save raw extraction data for debugging
          const rawOutputDir = `./data/agentic-${this.sessionId}/raw-extractions`;
          if (!fs.existsSync(rawOutputDir)) {
            fs.mkdirSync(rawOutputDir, { recursive: true });
          }
          
          const sanitizedName = exam.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
          const rawFile = path.join(rawOutputDir, `${exam.id}_${sanitizedName}.json`);
          fs.writeFileSync(rawFile, JSON.stringify(detailedExamData, null, 2));
          
          // Process each exam result (could be multiple due to modules/fractions)
          for (const examData of detailedExamData) {
            const parsedExam = this.parseExamData(exam.url, examData);
            
            // Merge with original exam data
            const enhancedExam = {
              ...exam,
              ...parsedExam,
              originalExamData: exam,
              syllabusExtracted: true,
              extractionTimestamp: new Date().toISOString()
            };
            
            results.push(enhancedExam);
          }
          
          break; // Success, exit retry loop
          
        } catch (error) {
          attempts++;
          if (attempts >= this.config.maxRetries) {
            this.logger.error(`Failed to process exam ${exam.name} after ${this.config.maxRetries} attempts: ${error}`);
            results.push({
              ...exam,
              syllabusExtracted: false,
              extractionError: error instanceof Error ? error.message : String(error)
            });
          } else {
            this.logger.warn(`Attempt ${attempts} failed for ${exam.name}, retrying...`);
            await this.sleep(2000);
          }
        }
      }
      
      // Add delay between exams
      await this.sleep(this.config.delayBetweenRequests);
    }
    
    return results;
  }

  public async scrapeExamDetails(inputFilePath: string): Promise<void> {
    this.logger.info(`Loading exams from: ${inputFilePath}`);
    
    if (!fs.existsSync(inputFilePath)) {
      throw new Error(`Input file not found: ${inputFilePath}`);
    }
    
    const exams = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));
    this.logger.info(`Loaded ${exams.length} exams to process`);
    
    await this.initializeBrowser();
    
    try {
      const allResults: any[] = [];
      
      // Process exams in batches
      for (let i = 0; i < exams.length; i += this.config.batchSize) {
        const batch = exams.slice(i, i + this.config.batchSize);
        const batchNumber = Math.floor(i / this.config.batchSize) + 1;
        const totalBatches = Math.ceil(exams.length / this.config.batchSize);
        
        this.logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} exams)`);
        
        const batchResults = await this.processExamBatch(batch);
        allResults.push(...batchResults);
        
        // Save intermediate results
        const outputDir = `./data/agentic-${this.sessionId}`;
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const intermediateFile = path.join(outputDir, `${this.sessionId}-exams-detailed-batch-${batchNumber}.json`);
        fs.writeFileSync(intermediateFile, JSON.stringify(batchResults, null, 2));
        
        this.logger.info(`✓ Batch ${batchNumber} completed: ${batchResults.length} exams processed`);
        
        // Add delay between batches
        if (i + this.config.batchSize < exams.length) {
          this.logger.info(`Waiting ${this.config.delayBetweenRequests}ms before next batch...`);
          await this.sleep(this.config.delayBetweenRequests);
        }
      }
      
      // Save final results
      const outputDir = `./data/agentic-${this.sessionId}`;
      const finalFile = path.join(outputDir, `${this.sessionId}-exams-detailed-final.json`);
      const finalFileJsonl = path.join(outputDir, `${this.sessionId}-exams-detailed-final.jsonl`);
      
      fs.writeFileSync(finalFile, JSON.stringify(allResults, null, 2));
      
      // Save JSONL format
      const jsonlStream = fs.createWriteStream(finalFileJsonl);
      for (const exam of allResults) {
        jsonlStream.write(JSON.stringify(exam) + '\n');
      }
      jsonlStream.end();
      
      this.logger.info(`✅ SCRAPING COMPLETED`);
      this.logger.info(`Total exams processed: ${allResults.length}`);
      this.logger.info(`Final output: ${finalFile}`);
      this.logger.info(`JSONL output: ${finalFileJsonl}`);
      
      // Print summary
      const successCount = allResults.filter(e => e.syllabusExtracted).length;
      const failureCount = allResults.filter(e => !e.syllabusExtracted).length;
      
      this.logger.info(`✓ Successfully extracted: ${successCount}`);
      this.logger.info(`✗ Failed extractions: ${failureCount}`);
      
    } finally {
      await this.browser.close();
      this.logger.info('Browser closed');
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npm run scrape-exam-details <path-to-exam-file>');
    console.log('Example: npm run scrape-exam-details ./data/agentic-2025-06-25T14-58-23/agentic-2025-06-25T14-58-23-3-exams.json');
    process.exit(1);
  }
  
  const inputFile = args[0];
  const scraper = new ExamDetailScraper(inputFile);
  
  try {
    await scraper.scrapeExamDetails(inputFile);
    console.log('✅ Exam detail scraping completed successfully!');
  } catch (error) {
    console.error('❌ Exam detail scraping failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ExamDetailScraper };

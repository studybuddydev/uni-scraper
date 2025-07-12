/**
 * Step 2: Exam Detail Scraping and Data Processing
 * 
 * This script takes the course data from Step 1 and scrapes detailed information
 * for each exam, handling modules, fractions, and all edge cases.
 * 
 * Output: dataExams.json - Complete exam information with all details
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';

interface CourseWithExams {
  courseName: string;
  year: string;
  path: string;
  urlCourse: string;
  urlYear: string;
  urlPath: string;
  exams: ExamInfo[];
}

interface ExamInfo {
  id: string;
  name: string;
  url: string;
}

interface RawExamData {
  code: string;
  title: string;
  url: string;
  data: { [key: string]: any };
  module?: string;
  fraction?: string;
}

interface ProcessedExam {
  // Identifiers
  baseUrl: string;
  url: string;
  universityId: string;
  groupCode: string;
  code: string;
  courseId: string;
  name: string;
  
  // Metadata
  lastUpdated: string;
  deleted: null;
  fraction: string | null;
  module: string | null;
  color: string;
  
  // Basic info
  cfu: number | null;
  hours: number | null;
  teachers: string[];
  courseName: string | null;
  coursePath: string | null;
  year: number | null;
  
  // Academic details
  courseType?: string;
  offerYear?: string;
  activityType?: string;
  field?: string;
  language?: string;
  teachingActivityType?: string;
  evaluation?: string;
  teachingPeriod?: string;
  teachingMode?: string;
  disciplinarySector?: string;
  location?: string;
  
  // Content
  chapters?: string;
  books?: string;
  goals?: string;
  requirements?: string;
  teachingMethods?: string;
  learningAssessment?: string;
  extendedProgram?: string;
  libraryTexts?: string;
  onlineResources?: string;
  other?: string;
}

/**
 * Extract detailed exam data from an exam page
 */
async function extractExamData(page: Page, url: string): Promise<Omit<RawExamData, 'module' | 'fraction'>> {
  const result = await page.evaluate(() => {
    const results: any = {};

    // Extract code and title
    const codeTitle = document.querySelector('.corso-title')?.textContent?.trim() || '';
    const code = codeTitle.split(']')[0].replace('[', '').trim();
    const title = codeTitle.split('] - ')[1]?.trim() || codeTitle;

    // Extract accordion sections
    const titleElements = document.querySelectorAll('.insegnamento-accordion .accordion > dt');
    const descriptionElements = document.querySelectorAll('.insegnamento-accordion .accordion > dd');

    const titles = Array.from(titleElements).map((t) => t.textContent?.trim() || '');
    const descriptions = Array.from(descriptionElements).map((d) => d.textContent?.trim() || '');

    // Process each section
    for (let i = 1; i < titles.length; i++) {
      const sectionTitle = titles[i];
      const sectionDescription = descriptions[i];
      if (sectionTitle && sectionDescription) {
        results[sectionTitle] = sectionDescription;
      }
    }

    // Process the first section (general information table)
    const tableTitle = titles[0] || 'Informazioni generali';
    results[tableTitle] = {};
    
    const tableHeaders = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dt');
    const tableValues = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dd');

    const headerTexts = Array.from(tableHeaders).map((t) => t.textContent?.trim() || '');
    const valueTexts = Array.from(tableValues).map((d) => d.textContent?.trim() || '');

    for (let i = 0; i < headerTexts.length; i++) {
      const header = headerTexts[i];
      const value = valueTexts[i];
      if (header && value) {
        results[tableTitle][header] = value;
      }
    }

    // Process nested dl elements
    const nestedDls = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dl');
    nestedDls.forEach((dl) => {
      const nestedTitle = dl.querySelector('dt')?.textContent?.trim() || '';
      const nestedValues = Array.from(dl.querySelectorAll('dd')).map((d) => d.textContent?.trim() || '');
      if (nestedTitle && nestedValues.length > 0) {
        results[nestedTitle] = nestedValues;
      }
    });

    return { data: results, code, title };
  });
  
  return { ...result, url };
}

/**
 * Recursively extract exam data, handling modules and fractions
 */
async function extractExamDetails(url: string, browser: Browser): Promise<RawExamData[]> {
  if (!url) return [];
  
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check for modules and fractions
    const modulesAndFractions = await page.evaluate((baseUrl: string) => {
      const sections = document.querySelectorAll('.insegnamento-links');
      if (sections.length !== 2) {
        return null;
      }
      
      const [moduliSection, frazioniSection] = Array.from(sections);
      
      const moduli = Array.from(moduliSection.querySelectorAll('a')).map((a) => ({
        name: a.textContent?.trim() || '',
        url: `${baseUrl}${a.getAttribute('href') || '#'}`
      }));
      
      const frazioni = Array.from(frazioniSection.querySelectorAll('a')).map((a) => ({
        name: a.textContent?.trim() || '',
        url: `${baseUrl}${a.getAttribute('href') || '#'}`
      }));
      
      return { moduli, frazioni };
    }, new URL(url).origin);

    // If no modules or fractions, extract data directly
    if (!modulesAndFractions || (modulesAndFractions.moduli.length === 0 && modulesAndFractions.frazioni.length === 0)) {
      const examData = await extractExamData(page, url);
      return [examData];
    }

    const results: RawExamData[] = [];

    // Process modules
    if (modulesAndFractions.moduli.length > 0) {
      for (const module of modulesAndFractions.moduli) {
        console.log(`      📚 Processing module: ${module.name}`);
        const moduleExams = await extractExamDetails(module.url, browser);
        moduleExams.forEach(exam => {
          exam.module = module.name;
        });
        results.push(...moduleExams);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Process fractions
    if (modulesAndFractions.frazioni.length > 0) {
      for (const fraction of modulesAndFractions.frazioni) {
        console.log(`      🔢 Processing fraction: ${fraction.name}`);
        const fractionExams = await extractExamDetails(fraction.url, browser);
        fractionExams.forEach(exam => {
          exam.fraction = fraction.name;
        });
        results.push(...fractionExams);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;

  } catch (error) {
    console.error(`Error extracting exam details from ${url}:`, error);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * Generate a random color for the exam
 */
function getRandomColor(): string {
  const colors = [
    '#FFD1DC', '#AEC6CF', '#77DD77', '#FDFD96', '#CBAACB', '#FFB347',
    '#FF6961', '#99C5C4', '#E3E4FA', '#AAF0D1', '#FFDAB9', '#CFCFC4',
    '#B2FFFF', '#F49AC2', '#BDFCC9', '#D7BDE2', '#F9E79F', '#A9DFBF',
    '#AED6F1', '#F5CBA7', '#FADBD8', '#D5F5E3', '#FDEBD0', '#E8DAEF'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Process raw exam data into the final format
 */
function processExamData(rawExam: RawExamData, universityId: string, courseInfo: CourseWithExams): ProcessedExam {
  // Field mapping from Italian to English keys
  const keyMapping: { [key: string]: string } = {
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
    'Contenuti': 'chapters',
    'Contenuti per il gruppo studenti': 'chapters',
    'Contenuti/Programma del corso': 'chapters',
    'Testi': 'books',
    'Testi per il gruppo studenti': 'books',
    'Libri di testo/Libri consigliati': 'books',
    'Obiettivi formativi': 'goals',
    'Obiettivi formativi e risultati di apprendimento attesi': 'goals',
    'Obiettivi formativi per il gruppo studenti': 'goals',
    'Prerequisiti': 'requirements',
    'Prerequisiti per il gruppo studenti': 'requirements',
    'Metodi didattici': 'teachingMethods',
    'Metodi didattici per il gruppo studenti': 'teachingMethods',
    'Metodi didattici utilizzati e attività di apprendimento richieste allo studente': 'teachingMethods',
    "Verifica dell'apprendimento": 'learningAssessment',
    "Verifica dell'apprendimento per il gruppo studenti": 'learningAssessment',
    "Metodi di accertamento e criteri di valutazione": 'learningAssessment',
    'Programma esteso': 'extendedProgram',
    'Programma esteso per il gruppo studenti': 'extendedProgram',
    'Testi disponibili nel catalogo delle biblioteche': 'libraryTexts',
    'Risorse online': 'onlineResources',
    'Altro': 'other',
    'Altre informazioni': 'other'
  };

  // Create unique code
  const groupCode = `${universityId}-${rawExam.code}`;
  const uniqueCode = `${groupCode}-1`; // Simplified - could add counter logic

  // Parse numeric values safely
  const cfu = rawExam.data['Crediti']?.[0] ? parseInt(rawExam.data['Crediti'][0].split(' ')[0]) || null : null;
  const hours = rawExam.data['Durata']?.[0] ? parseInt(rawExam.data['Durata'][0].split(' ')[0]) || null : null;
  const year = rawExam.data['Anno di corso']?.[0] ? parseInt(rawExam.data['Anno di corso'][0]) || null : null;

  // Extract teachers
  const generalInfo = rawExam.data['Informazioni generali'] || {};
  const teachers = [
    ...(generalInfo['Docenti']?.split(',') || []),
    ...(generalInfo['Responsabili']?.split(',') || []),
    ...(generalInfo['Assistenti']?.split(',') || [])
  ].filter(x => !!x).map(x => x.trim());

  // Create the processed exam object
  const processedExam: ProcessedExam = {
    baseUrl: rawExam.url,
    url: rawExam.url,
    universityId,
    groupCode,
    code: uniqueCode,
    courseId: 'TODO', // Could be derived from course info
    name: rawExam.title,
    lastUpdated: new Date().toISOString(),
    deleted: null,
    fraction: rawExam.fraction || null,
    module: rawExam.module || null,
    color: getRandomColor(),
    cfu,
    hours,
    teachers,
    courseName: generalInfo['Corso di studi'] || courseInfo.courseName,
    coursePath: generalInfo['Percorso'] || courseInfo.path || null,
    year
  };

  // Map additional fields
  for (const [italianKey, englishKey] of Object.entries(keyMapping)) {
    if (rawExam.data[italianKey]) {
      const value = Array.isArray(rawExam.data[italianKey]) 
        ? rawExam.data[italianKey][0] 
        : rawExam.data[italianKey];
      (processedExam as any)[englishKey] = value;
    }
  }

  return processedExam;
}

/**
 * Main function to run Step 2
 */
export async function runStep2(sessionDir: string): Promise<void> {
  console.log(`🚀 Starting Step 2: Exam Detail Scraping`);
  console.log(`📁 Session directory: ${sessionDir}`);

  // Load course data from Step 1
  const courseDataFile = path.join(sessionDir, 'dataCourses.json');
  if (!fs.existsSync(courseDataFile)) {
    throw new Error(`Course data file not found: ${courseDataFile}. Please run Step 1 first.`);
  }

  const coursesData: CourseWithExams[] = JSON.parse(fs.readFileSync(courseDataFile, 'utf8'));
  console.log(`📚 Loaded ${coursesData.length} course-year-path combinations`);

  // Load configuration
  const configFile = path.join(sessionDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

  const browser = await puppeteer.launch({ 
    headless: true, 
    defaultViewport: { width: 1920, height: 1080 } 
  });

  try {
    const allExams: ProcessedExam[] = [];
    let examCount = 0;
    let totalExams = coursesData.reduce((sum, course) => sum + course.exams.length, 0);

    console.log(`🎯 Total exams to process: ${totalExams}`);

    // Process each course's exams
    for (const courseInfo of coursesData) {
      console.log(`\n📖 Processing course: ${courseInfo.courseName} (${courseInfo.year}) - ${courseInfo.path || 'Default path'}`);
      console.log(`   📝 ${courseInfo.exams.length} exams to process`);

      for (const examInfo of courseInfo.exams) {
        examCount++;
        console.log(`   🔍 [${examCount}/${totalExams}] Processing exam: ${examInfo.name} (${examInfo.id})`);
        
        try {
          const rawExams = await extractExamDetails(examInfo.url, browser);
          
          for (const rawExam of rawExams) {
            const processedExam = processExamData(rawExam, config.university, courseInfo);
            allExams.push(processedExam);
          }
          
          console.log(`      ✅ Extracted ${rawExams.length} exam record(s)`);
          
          // Small delay to be respectful
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`      ❌ Error processing exam ${examInfo.name}:`, error);
        }
      }

      // Save progress periodically
      if (examCount % 10 === 0) {
        const progressFile = path.join(sessionDir, 'dataExams-progress.json');
        fs.writeFileSync(progressFile, JSON.stringify(allExams, null, 2));
        console.log(`💾 Progress saved (${allExams.length} exams processed)`);
      }
    }

    // Save final results
    const outputFile = path.join(sessionDir, 'dataExams.json');
    fs.writeFileSync(outputFile, JSON.stringify(allExams, null, 2));

    // Save as JSONL too
    const jsonlFile = path.join(sessionDir, 'dataExams.jsonl');
    const jsonlContent = allExams.map(exam => JSON.stringify(exam)).join('\\n');
    fs.writeFileSync(jsonlFile, jsonlContent);

    console.log(`\n✅ Step 2 Complete!`);
    console.log(`📊 Processed ${totalExams} exam URLs`);
    console.log(`📚 Generated ${allExams.length} exam records`);
    console.log(`📁 Data saved to: ${outputFile}`);
    console.log(`📄 JSONL format: ${jsonlFile}`);

  } finally {
    await browser.close();
  }
}

// Allow running this script directly with a session directory argument
if (require.main === module) {
  const sessionDir = process.argv[2];
  if (!sessionDir) {
    console.error('Usage: node step2-exams.js <session-directory>');
    process.exit(1);
  }
  runStep2(sessionDir).catch(console.error);
}

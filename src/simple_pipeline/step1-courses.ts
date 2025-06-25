/**
 * Step 1: Course Discovery and Data Processing
 * 
 * This script discovers all courses from the university catalog and processes
 * their detailed information including exam URLs and course metadata.
 * 
 * Output: dataCourses.json - Complete course information ready for exam scraping
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { ScrapingConfig, getScrapingName, getBaseUrl } from './config';

interface CoursePathInfo {
  courseName: string;
  year: string;
  path: string;
  urlCourse: string;
  urlYear: string;
  urlPath: string;
}

interface ExamInfo {
  id: string;
  name: string;
  url: string;
}

interface CourseWithExams {
  courseName: string;
  year: string;
  path: string;
  urlCourse: string;
  urlYear: string;
  urlPath: string;
  exams: ExamInfo[];
}

/**
 * Extract course URLs from the main courses page
 */
async function extractCourseUrls(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const urls: string[] = [];
    const degreeElements = document.querySelectorAll('.corsi-leaf a');
    degreeElements.forEach((element) => {
      const url = element.getAttribute('href');
      if (url) urls.push(url);
    });
    return urls;
  });
}

/**
 * Get course title from the course page
 */
async function getCourseTitle(page: Page): Promise<string> {
  try {
    await page.waitForSelector('h1.corso-title.u-filetto', { timeout: 5000 });
    return await page.evaluate(() => 
      document.querySelector('h1.corso-title.u-filetto')?.textContent?.trim() || ''
    );
  } catch (e) {
    return 'Unknown Course';
  }
}

/**
 * Get the selected year text from the dropdown
 */
async function getSelectedYearText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const selectElement = document.querySelector('#offerta-formativa') as HTMLSelectElement;
    if (selectElement) {
      const selectedOption = selectElement.options[selectElement.selectedIndex];
      return selectedOption ? selectedOption.text : 'Unknown Year';
    }
    return 'No Year Found';
  });
}

/**
 * Find the link to course teachings/exams
 */
async function getTeachingsLink(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).find(a => {
      const text = a.textContent?.trim().toLowerCase();
      return text === 'piani di studio e insegnamenti' || text === 'insegnamenti';
    })?.href || null;
  });
}

/**
 * Extract career paths from the teachings page
 */
async function extractCareerPaths(browser: Browser, url: string, baseUrl: string): Promise<{ name: string, url: string }[]> {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    const result = await page.evaluate((baseUrl) => {
      const links = document.querySelectorAll('ul li a');
      const paths: { name: string, url: string }[] = [];

      links.forEach((link) => {
        const text = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        if (href.includes('schemaid')) {
          paths.push({ name: text, url: `${baseUrl}${href}` });
        }
      });

      return paths;
    }, baseUrl);

    return result;
  } catch (error) {
    console.error(`Error extracting career paths from ${url}:`, error);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * Extract exam information from a course path page
 */
async function extractExamsFromPath(page: Page, url: string, baseUrl: string): Promise<ExamInfo[]> {
  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1000));

    return await page.evaluate((baseUrl) => {
      const allExams: ExamInfo[] = [];
      const years = document.querySelectorAll('.corso-insegnamenti-list > ul > li');

      Array.from(years).forEach((yearList) => {
        const examElements = yearList.querySelectorAll('card-insegnamento');
        
        Array.from(examElements).forEach((examElement) => {
          const nameElement = examElement.querySelector('a');
          if (nameElement) {
            const fullText = nameElement.textContent?.trim() || '';
            const id = fullText.match(/\\[(\\w+)\\]/)?.[1] || '';
            const name = fullText.split(']').slice(1).join(']')
              .replace(/\\b(CORSO|DI|LAUREA|MAGISTRALE|A|CICLO|UNICO|TRIENNALE|IN)\\b/gi, '')
              .replace(/\\s+/g, ' ').trim();
            const url = nameElement.getAttribute('href') || '';
            
            if (id && name && url) {
              allExams.push({ 
                id, 
                name, 
                url: url.startsWith('http') ? url : `${baseUrl}${url}`
              });
            }
          }
        });
      });

      return allExams;
    }, baseUrl);
  } catch (error) {
    console.error(`Error extracting exams from ${url}:`, error);
    return [];
  }
}

/**
 * Discover all courses and their exam information
 */
async function discoverCourses(config: ScrapingConfig): Promise<CourseWithExams[]> {
  const baseUrl = getBaseUrl(config);
  const mainUrl = `${baseUrl}${config.url}`;
  
  console.log(`🔍 Starting course discovery for ${config.university} ${config.type}`);
  console.log(`📍 Main URL: ${mainUrl}`);

  const browser = await puppeteer.launch({ 
    headless: true, 
    defaultViewport: { width: 1920, height: 1080 } 
  });
  
  try {
    const page = await browser.newPage();
    
    // Step 1: Get all course URLs
    console.log('📚 Discovering course URLs...');
    await page.goto(mainUrl, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.corsi-group');
    const courseUrls = await extractCourseUrls(page);
    console.log(`✅ Found ${courseUrls.length} courses`);

    const allCourseData: CourseWithExams[] = [];

    // Step 2: Process each course
    for (let i = 0; i < courseUrls.length; i++) {
      const courseUrl = `${baseUrl}${courseUrls[i]}`;
      console.log(`\n📖 Processing course ${i + 1}/${courseUrls.length}: ${courseUrl}`);
      
      try {
        await page.goto(courseUrl, { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const courseTitle = await getCourseTitle(page);
        console.log(`   Course: ${courseTitle}`);

        // Step 3: Process all years for this course
        const yearOptions = ['0: Object', '1: Object', '2: Object', '3: Object', '4: Object', '5: Object', '6: Object'];
        
        for (const yearValue of yearOptions) {
          try {
            await page.select('#offerta-formativa', yearValue);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const yearText = await getSelectedYearText(page);
            const yearUrl = page.url();
            const teachingsLink = await getTeachingsLink(page);
            
            if (!teachingsLink) {
              console.log(`   ⚠️  No teachings link found for ${yearText}`);
              continue;
            }

            console.log(`   📅 Processing year: ${yearText}`);

            // Step 4: Handle career paths or direct exam extraction
            if (teachingsLink.endsWith('insegnamenti')) {
              // Multiple career paths
              const paths = await extractCareerPaths(browser, teachingsLink, baseUrl);
              console.log(`      Found ${paths.length} career paths`);
              
              for (const pathInfo of paths) {
                console.log(`      📂 Processing path: ${pathInfo.name}`);
                const exams = await extractExamsFromPath(page, pathInfo.url, baseUrl);
                
                allCourseData.push({
                  courseName: courseTitle,
                  year: yearText,
                  path: pathInfo.name,
                  urlCourse: courseUrl,
                  urlYear: yearUrl,
                  urlPath: pathInfo.url,
                  exams
                });
                
                console.log(`         ✅ Found ${exams.length} exams`);
              }
            } else {
              // Single path
              console.log(`      📂 Processing single path`);
              const exams = await extractExamsFromPath(page, teachingsLink, baseUrl);
              
              allCourseData.push({
                courseName: courseTitle,
                year: yearText,
                path: '',
                urlCourse: courseUrl,
                urlYear: yearUrl,
                urlPath: teachingsLink,
                exams
              });
              
              console.log(`         ✅ Found ${exams.length} exams`);
            }
          } catch (error) {
            console.error(`   ❌ Error processing year ${yearValue}:`, error);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing course ${courseUrl}:`, error);
      }
    }

    return allCourseData;

  } finally {
    await browser.close();
  }
}

/**
 * Main function to run Step 1
 */
export async function runStep1(config: ScrapingConfig = {
  university: 'unibs',
  type: 'triennale',
  url: '/corsi/2025?gruppo=1617109934164',
  numberOfYears: 5
}): Promise<string> {
  const scrapingName = getScrapingName(config);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join('data', `simple-${scrapingName}-${timestamp}`);

  // Ensure output directory exists
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  console.log(`🚀 Starting Step 1: Course Discovery for ${scrapingName}`);
  console.log(`📁 Output directory: ${sessionDir}`);

  try {
    // Run course discovery
    const courseData = await discoverCourses(config);
    
    // Save the results
    const outputFile = path.join(sessionDir, 'dataCourses.json');
    fs.writeFileSync(outputFile, JSON.stringify(courseData, null, 2));
    
    // Save configuration for reference
    const configFile = path.join(sessionDir, 'config.json');
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    console.log(`\n✅ Step 1 Complete!`);
    console.log(`📊 Processed ${courseData.length} course-year-path combinations`);
    console.log(`📁 Data saved to: ${outputFile}`);
    console.log(`\n🎯 Ready for Step 2: Run exam scraping with session: ${sessionDir}`);

    return sessionDir;

  } catch (error) {
    console.error('❌ Step 1 failed:', error);
    throw error;
  }
}

// Allow running this script directly
if (require.main === module) {
  runStep1().catch(console.error);
}

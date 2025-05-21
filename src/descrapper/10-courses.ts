import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import { config } from './config';

interface ResultsType {
  [key: string]: string[];
}

// Extractors
function extractDegreeUrls(): string[] {
  const urls: string[] = [];
  const degreeElements = document.querySelectorAll('.corsi-leaf a');
  degreeElements.forEach((element) => {
    const url = element.getAttribute('href');
    if (url) { urls.push(url); }
  });
  return urls;
}
async function getDegreeTitle(page: Page) {
  try {
    await page.waitForSelector('h1.corso-title.u-filetto');
    return await page.evaluate(() => document.querySelector('h1.corso-title.u-filetto')?.textContent?.trim() || '');
  }
  catch (e) {
    return 'Not found'
  }
}
async function getSelectedText(page: Page) {
  return await page.evaluate(() => {
    const selectElement = document.querySelector('#offerta-formativa') as HTMLSelectElement;
    if (selectElement) {
      const selectedOption = selectElement.options[selectElement.selectedIndex];
      return selectedOption ? selectedOption.text : 'No option selected';
    }
    return 'Select element not found';
  });
}
async function getLinkHref(page: Page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).find(a => {
      const text = a.textContent?.trim().toLowerCase();
      return text === 'piani di studio e insegnamenti' || text === 'insegnamenti';
    })?.href;
  });
}

// SCRAP HOME
async function getAllCoursesUrls(page: Page, degree_url: string, baseUrl: string) {
  try {
    await page.goto(degree_url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.corsi-group');
    const degreeUrls = await page.evaluate(extractDegreeUrls); // get all degree urls
    return degreeUrls.map(url => `${baseUrl}${url}`);
  } catch (e) {
    console.log('rotto', e);
    return []
  }
}

// SCRAP INSEEGNAMENTI
async function getExamListFromDegree(browser: Browser, page: Page, urls: string[], baseUrl: string) {

  const res: { [key: string]: ResultsType } = {}
  const newRes: { [key: string]: string }[] = []

  //iterate over all degrees
  for (const url of urls) {
    console.log('  Scrapping degree: ', url);
    try {
      await page.goto(url, { waitUntil: 'networkidle0' });
      await page.waitForSelector('a');
      await new Promise((res) => setTimeout(res, 3000));

      let pageTitle = await getDegreeTitle(page)
      console.log('  Course: ', pageTitle);

      let results: ResultsType = {};
      const selectionValues = ['0: Object', '1: Object', '2: Object', '3: Object', '4: Object', '5: Object', '6: Object']; // year selection 2024/2025 is 0 

      for (let i = 0; i < selectionValues.length; i++) {
        const value = selectionValues[i];
        await page.select('#offerta-formativa', value);
        await new Promise((res) => setTimeout(res, 1000));
        const yearUrl = await page.url();

        const year = await getSelectedText(page) // Retrieve the select year
        console.log('    Year: ', year, yearUrl);
        const linkHref = await getLinkHref(page) // Find the link corresponding to "piani di studio e insegnamenti" or "insegnamenti"

        if (pageTitle) {
          const paths = linkHref?.split('?')[0].endsWith('insegnamenti') ? await selectCareer(browser, linkHref, baseUrl) : [{ name: '', url: linkHref || '' }];
          results[year] = paths.map(p => p.url);
          newRes.push(...paths.map(p => ({
            courseName: pageTitle,
            year: year,
            path: p.name,
            urlCourse: url,
            urlYear: yearUrl,
            urlPath: p.url,
          })));
        }
        console.log('    links: ', results[year]);
      }
      res[pageTitle] = results;
    } catch (e) {
      console.log('  Scrapping degree ROTTO: ', url);
    }
  }

  return newRes;
}

async function selectCareer(browser: Browser, url: string, baseUrl: string): Promise<{ name: string, url: string }[]> {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  const result = await page.evaluate((baseUrl) => {
    const textUrlPairs: { [key: string]: string } = {};
    const links = document.querySelectorAll('ul li a');
    const urls: string[] = [];
    const res: { name: string, url: string }[] = [];

    links.forEach((link) => {
      const text = link.textContent?.trim() || '';
      const url = link.getAttribute('href') || '';
      if (url.includes('schemaid')) {
        textUrlPairs[text] = `${baseUrl}${url}`;
        urls.push(`${baseUrl}${url}`); // Use baseUrl here instead of BASE_URL
        res.push({ name: text, url: `${baseUrl}${url}` });
      }
    });

    // return urls;
    return res;
  }, baseUrl);

  await page.close();
  return result;
}

async function degreeListScrapper(title: string, uniCode: string, degreePath: string) {
  const baseUrl = `https://${uniCode}.coursecatalogue.cineca.it`;
  const degreeListUrl = `${baseUrl}${degreePath}`;

  const browser = await puppeteer.launch({ headless: false, defaultViewport: { width: 1920, height: 1080 } });
  const page = await browser.newPage();

  console.log('START scraping home');
  const coursesUrls = await getAllCoursesUrls(page, degreeListUrl, baseUrl)
  console.log('DONE scraping home, degreesUrls.length: ', coursesUrls.length);

  console.log('START scraping insegnamenti');
  const insegnamentiUrls = await getExamListFromDegree(browser, page, coursesUrls, baseUrl)
  console.log('DONE scraping insegnamenti');
  const filename = `./data/${title}/10-courses-${title}.json`;
  if (!fs.existsSync(`./data/${title}`)) fs.mkdirSync(`./data/${title}`, { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(insegnamentiUrls, null, 2));

  console.log('FILE WRITTEN scraping insegnamenti: ', filename);
  await browser.close();
}

async function main() {
  degreeListScrapper(config.scripingName, config.unicode, config.url)
}

main()
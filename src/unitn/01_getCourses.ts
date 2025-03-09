import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';

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
async function getAllCoursesUrls(page: Page, degree_url: string) {
  try {
    await page.goto(degree_url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.corsi-group');
    const degreeUrls = await page.evaluate(extractDegreeUrls); // get all degree urls
    return degreeUrls.map(url => `${BASE_URL}${url}`);
  } catch (e) {
    console.log('rotto', e);
    return []
  }
}


// SCRAP DEGREE
async function scrapDegree(page: Page, degreeUrl: string) {

}


// SCRAP INSEEGNAMENTI
async function getExamListFromDegree(page: Page, urls: string[]) {

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
      const selectionValues = ['0: Object', '1: Object', '2: Object', '3: Object', '4: Object']; // year selection 2024/2025 is 0 

      for (let i = 0; i < selectionValues.length; i++) {
        const value = selectionValues[i];
        await page.select('#offerta-formativa', value);
        await new Promise((res) => setTimeout(res, 1000));

        const year = await getSelectedText(page)        // Retrieve the select year
        console.log('    Year: ', year);
        const linkHref = await getLinkHref(page)                // Find the link corresponding to "piani di studio e insegnamenti" or "insegnamenti"

        if (pageTitle) {
          const paths = linkHref?.split('?')[0].endsWith('insegnamenti') ? await selectCareer(linkHref) : [{ name: '', url: linkHref || '' }];
          results[year] = paths.map(p => p.url);
          newRes.push(...paths.map(p => ({
            courseName: pageTitle,
            year: year,
            path: p.name,
            url: p.url,
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

async function selectCareer(url: string): Promise<{ name: string, url: string }[]> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  //const BASE_URL = 'https://unibs.coursecatalogue.cineca.it'

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
  }, BASE_URL);

  await browser.close();
  return result;
}

async function fetchYearlyExams(browser: Browser, urls: string[], year: number): Promise<any[]> {
  const page = await browser.newPage();
  const exams = []

  console.log(`    Getting exams for year  ${year}, urls: ${urls.length}`);

  if (!urls) {
    urls = []
    console.log('      urls rotti: ', urls);
  }

  for (const url of urls) {
    if (url === '') continue;

    try {
      console.log('      Extracting: ', url, year);
      await page.goto(url, { waitUntil: 'networkidle0' });

      const tmpExams = await page.evaluate((baseUrl, year, uni) => {
        const exams: { title: string, id: string, href: string, cfu: string, hours: string, semester: string, annoDiOfferta: string, year: number }[] = [];
        const firstYearSection = document.querySelector(`li[id="${year}"]`);

        if (firstYearSection) {
          const examCards = firstYearSection.querySelectorAll('card-insegnamento');

          examCards.forEach(card => {
            const titleElement = card.querySelector('.card-insegnamento-header a');
            const hrefElement = card.querySelector('.card-insegnamento-header a');
            const cfuElement = card.querySelector('.card-insegnamento-cfu');
            const hoursElement = card.querySelector('.card-insegnamento-ore');
            const semesterElement = card.querySelector('.card-insegnamento-footer2 span');
            const annoDiOffertaElement = card.querySelector('div.card-insegnamento-footer > div:nth-child(1)');

            if (titleElement && hrefElement && cfuElement && hoursElement && semesterElement) {
              exams.push({
                title: titleElement.textContent?.trim() || '',
                id: uni + titleElement.textContent?.match(/\[(.*?)\]/)?.[1] || '',
                href: baseUrl + hrefElement.getAttribute('href') || '',
                cfu: cfuElement.textContent?.trim() || '',
                hours: hoursElement.textContent?.trim() || '',
                semester: semesterElement.textContent?.trim() || '',
                annoDiOfferta: annoDiOffertaElement?.textContent?.trim() || '',
                year: year
              });
            }
          });
        }
        return exams;
      }, BASE_URL, year, UNI);

      console.log('      Extracted exams: ', tmpExams.length);
      exams.push(...tmpExams)
    } catch (e) {
      console.log('      extract rotto: ', urls);
      console.log(e);
    }
  }

  await page.close();
  return exams
}

async function getExamsDetails(browser: Browser, years: { [key: string]: string[] }) {
  const firstYearExams = await fetchYearlyExams(browser, years['2024/2025'], 1);
  const secondYearExams = await fetchYearlyExams(browser, years['2023/2024'], 2);
  const thirdYearExams = await fetchYearlyExams(browser, years['2022/2023'], 3);
  // const fourthYearExams = await fetchYearlyExams(page, fourthYearUrl, 4);
  // const fifthYearExams = await fetchYearlyExams(page, fifthYearUrl, 5);
  // const sixthYearExams = await fetchYearlyExams(page, sixthYearUrl, 6);

  return [...firstYearExams, ...secondYearExams, ...thirdYearExams]//, ...fourthYearExams, ...fifthYearExams, ...sixthYearExams];
}


async function degreeTypeScrapper(degreeTypeUrl: string, title: string) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log('START scraping home');
  const coursesUrls = await getAllCoursesUrls(page, degreeTypeUrl)
  console.log('DONE scraping home, degreesUrls.length: ', coursesUrls.length);

  console.log('START scraping insegnamenti');
  const insegnamentiUrls = await getExamListFromDegree(page, coursesUrls)
  console.log('DONE scraping insegnamenti');
  const filename = `./data/${title}-coursesUrls.json`;
  fs.writeFileSync(filename, JSON.stringify(insegnamentiUrls, null, 2));
  console.log('FILE WRITTEN scraping insegnamenti: ', filename);
  await browser.close();

  return filename;
}

async function scrapeCourses(uni: string, title: string, urlFile: string) {
  const browser = await puppeteer.launch({ headless: false });

  const insegnamentiUrls = JSON.parse(fs.readFileSync(urlFile, 'utf8')) as { [key: string]: ResultsType };
  const courseEntries = Object.entries(insegnamentiUrls);
  const examByDegree = []

  console.log('START scrape courses: ', courseEntries.length);

  for (const [courseCode, years] of courseEntries) {
    const id = courseCode.match(/\[(\w+)\]/)?.[1] || '';
    const name = courseCode.split(']').slice(1).join(']').replace(/\b(CORSO|DI|LAUREA|MAGISTRALE|A|CICLO|UNICO|TRIENNALE|IN)\b/gi, '').replace(/\s+/g, ' ').trim();
    console.log(`  Course Code: ${courseCode} | name: ${name}, id: ${id}`);
    const exams = await getExamsDetails(browser, years);

    const degreeExams = {
      'name': name,
      'id': `${uni}${id}`,
      'uni': uni,
      'exams': exams
    }

    examByDegree.push(degreeExams)
    console.log('  counting exams: ', exams.length);
  }

  const filename = `./data/${title}.json`;
  fs.writeFileSync(filename, JSON.stringify(examByDegree, null, 2));
  console.log('FILE WRITTEN scraping courses: ', filename);
  await browser.close();
  return filename;
}

async function scrapeAll(degreeTypeUrl: string, degreeTypeTitle: string, uni: string) {
  const filename = await degreeTypeScrapper(degreeTypeUrl, degreeTypeTitle);
  // const filename = `./data/${title}-coursesUrls.json`;
  // console.log('\n----------------------\n');
  // await scrapeCourses(uni, degreeTypeTitle, filename);
}

const UNI = 'unitn'
const BASE_URL = `https://${UNI}.coursecatalogue.cineca.it`;

async function main() {
  // const title = 'triennaliUNIBS'
  const unitnTriennaliURL = 'https://unitn.coursecatalogue.cineca.it/corsi/2024?gruppo=1647269677464'
  const unitnCicloUnicoURL = 'https://unitn.coursecatalogue.cineca.it/corsi/2024?gruppo=1679583500227'
  const unitnMagistraleURL = 'https://unitn.coursecatalogue.cineca.it/corsi/2024?gruppo=1647269677465'

  const unibsTriennaliURL = 'https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1617109934164'
  const unibsMagistraliURL = 'https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1617109934165'
  const unibsCicloUnicoURL = 'https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1619785172027'

  scrapeAll(unitnTriennaliURL, 'triennaliUNITN', 'unitn')
  // scrapeAll(unitnMagistraleURL, 'magistraliUNITN')
  // scrapeAll(unitnCicloUnicoURL, 'cicloUnicoUNITN')

  // scrapeAll(unibsTriennaliURL, 'triennaliUNIBS')
  // scrapeAll(unibsMagistraliURL, 'magistraliUNIBS')
  // scrapeAll(unibsCicloUnicoURL, 'cicloUnicoUNIBS')

}

main()
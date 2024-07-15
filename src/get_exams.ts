import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import { cleanAllDegrees } from './clean';

const BASE_URL = 'https://unitn.coursecatalogue.cineca.it'



interface ExamUrls {
  [key: string]: string[];
}

// input degree url, output all the exams 
async function scrapeExams(url: string, page: Page) {
  console.log('Scraping exams:', url);

  // Load the page
  await page.goto(url, { waitUntil: 'networkidle0' });



  // Define selectors
  const yearSelector = 'h2.u-titoletto.u-color-links.u-font-text';
  const examListSelector = 'ul';
  const examItemSelector = 'li';

  // Extract the exam information grouped by year
  const examsByYear = await page.evaluate((yearSel, examListSel, examItemSel) => {
    const years = Array.from(document.querySelectorAll(yearSel));
    const data = [] as any;

    years.forEach((yearElement) => {
      const yearText = yearElement.textContent?.trim() || '';
      let examListElement = yearElement.nextElementSibling;

      while (examListElement && !examListElement.matches(examListSel)) {
        examListElement = examListElement.nextElementSibling;
      }

      if (examListElement) {
        const examElements = Array.from(examListElement.querySelectorAll(examItemSel));
        const exams = examElements.map((examElement) => {
          const titleElement = examElement.querySelector('h4.card-insegnamento-header > div > a > span');
          const cfuElement = examElement.querySelector('.card-insegnamento-cfu');
          const hoursElement = examElement.querySelector('.card-insegnamento-ore');
          const semesterElement = examElement.querySelector('.card-insegnamento-footer2 > div > span');

          return {
            title: titleElement?.textContent?.trim() || '',
            cfu: cfuElement?.textContent?.trim() || '',
            hours: hoursElement?.textContent?.trim() || '',
            semester: semesterElement?.textContent?.trim() || '',
          };
        });

        data.push({
          year: yearText,
          exams: exams,
        });
      }
    });

    return data;
  }, yearSelector, examListSelector, examItemSelector);

  return examsByYear;
}

//input lista dei degree, output dictionary degree: url lista esami
async function scrapeDegrees(degree_url: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const degrees = [];
  const BASE_URL = 'https://unitn.coursecatalogue.cineca.it'

  try {
    // Navigate to the target page
    await page.goto(degree_url, { waitUntil: 'networkidle0' });

    // Wait for the element to be visible (optional, adjust as needed)
    await page.waitForSelector('.corsi-group');

    // Get all the degree URLs
    const degreeUrls: string[] = await page.evaluate(() => {
      const urls: string[] = [];
      const degreeElements = document.querySelectorAll('.corsi-leaf a');

      degreeElements.forEach((element) => {
        const url = element.getAttribute('href');
        if (url) {
          urls.push(url);
        }
      });

      return urls;
    });

    let exam_urls: { [key: string]: string[] } = {}




    // For each degree
    for (let url of degreeUrls) {
      // Construct the full URL if necessary
      const fullUrl = 'https://unitn.coursecatalogue.cineca.it' + url;
      console.log(fullUrl);

      // Navigate to the degree page
      await page.goto(fullUrl, { waitUntil: 'networkidle0' });
      await page.waitForSelector('a');
      await new Promise((res) => setTimeout(res, 3000));

      // Wait for the specific element to be present
      let pageTitle = ''
      try {
        await page.waitForSelector('h1.corso-title.u-filetto');
        pageTitle = await page.evaluate(() => {
          return document.querySelector('h1.corso-title.u-filetto')?.textContent?.trim() || '';
        });
      }
      catch (e) {
        pageTitle = 'not found'
      }
      console.log('page_title', pageTitle);

      // Go to the list of exams
      const linkHref = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).find(a => {
          const text = a.textContent?.trim().toLowerCase();
          return text === 'piani di studio e insegnamenti' || text === 'insegnamenti';
      })?.href;
      });

      if (pageTitle) {
        if (!exam_urls[pageTitle]) {
          exam_urls[pageTitle] = [];
        }
        exam_urls[pageTitle].push(linkHref || '');

        if (linkHref?.endsWith('insegnamenti')) {
          exam_urls[pageTitle] = await selectCareer(linkHref)
        }
      }




      // if (linkHref) {
      //     const examPage = await browser.newPage();
      //     const examsByYear = await scrapeExams(linkHref, examPage);
      //     await examPage.close();
      //     console.log(examsByYear);

      //     degrees.push({
      //         title: pageTitle,
      //         examsByYear: examsByYear,
      //     });
      // }
    }
    return exam_urls

    // fs.writeFileSync('degrees.json', JSON.stringify(degrees, null, 2));
  } catch (error) {
    console.error('Error scraping degrees:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}





async function selectCareer(url: string): Promise<string[]> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const BASE_URL = 'https://unitn.coursecatalogue.cineca.it'

  await page.goto(url, { waitUntil: 'networkidle0' });

  const result = await page.evaluate(() => {
    const textUrlPairs: { [key: string]: string } = {};
    const links = document.querySelectorAll('ul li a');
    const urls: string[] = []

    links.forEach((link) => {
      const text = link.textContent?.trim() || '';
      const url = link.getAttribute('href') || '';
      if (url.includes('schemaid')) {
        textUrlPairs[text] = url;
        urls.push('https://unitn.coursecatalogue.cineca.it' + url)
      }
    });

    return urls;
  });

  await browser.close();
  return result;
}







async function scrape_all(url:string, title:string) {

  const exam_urls: ExamUrls | undefined = await scrapeDegrees(url);

 


  if (!exam_urls) {
    return
  }
  console.log(exam_urls);





  let degrees = []






  for (const title of Object.keys(exam_urls)) {
    const browser = await puppeteer.launch({ headless: true });

    const page = await browser.newPage();
    const urls = exam_urls[title];
    let allExams: any[] = [];

    for (const url of urls) {
      let exams: string[] = []
      try {
        exams = await scrapeExams(url, page);
      } catch (e) {
        console.log(title, 'rotto');
        console.log(url);
        console.log(e)

        exams = []

      }
      allExams = allExams.concat(exams); // Append exams from each URL
    }


    degrees.push({
      title: title,
      examsByYear: allExams,
    });

  }

  const cleanedDegrees = cleanAllDegrees(degrees)


  fs.writeFileSync('./data/' + title + '.json', JSON.stringify(cleanedDegrees, null, 2));


}



async function main() {
    const unibsTriennaliURL = 'https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1617109934164'
    const title = 'triennaliUNIBS'

    const unibsCicloUnicoURL = 'https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1619785172027'
    const unibsMagistraliURL ='https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1617109934165'
    const unitnTriennaliURL = 'https://unitn.coursecatalogue.cineca.it/corsi/2024?gruppo=1647269677464'
    const unitnCicloUnicoURL = 'https://unitn.coursecatalogue.cineca.it/corsi/2024?gruppo=1679583500227'
    const unitnMagistraleURL = 'https://unitn.coursecatalogue.cineca.it/corsi/2024?gruppo=1647269677465'



    scrape_all(unitnMagistraleURL, 'magistraliUNITN')



}

main();

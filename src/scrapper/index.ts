import puppeteer, { Browser, Page } from 'puppeteer';


const BASE_URL = 'https://unitn.coursecatalogue.cineca.it';


function extractDegreeUrlsFromGruppo(): Promise<string[]> {
  return new Promise((resolve) => {
      const urls: string[] = [];
      const degreeElements = document.querySelectorAll('.corsi-leaf a');
      degreeElements.forEach((element) => {
          const url = element.getAttribute('href');
          if (url) { urls.push(url); }
      });
      resolve(urls);
  });
}

async function extractExam(examUrl: string) {
  
}

async function extractGruppo(gruopUrl: string) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log('LOG: Opening gruppo page')
  await page.goto(`${BASE_URL}${gruopUrl}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.corsi-group');

  console.log('LOG: Extractiong degree urls')
  const degreeUrls = (await page.evaluate(extractDegreeUrlsFromGruppo)).map(url => `${BASE_URL}${url}`);
  console.log(degreeUrls);


  await new Promise(resolve => setTimeout(resolve, 10000));

  await browser.close();
}

extractGruppo('/corsi/2024?gruppo=1647269677464');
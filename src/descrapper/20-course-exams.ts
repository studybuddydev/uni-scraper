import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';

async function extractExams(url: string, browser: Browser) {
  if (!url) return {};
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((resolve) => setTimeout(resolve, 500));

  const exams = await page.evaluate((baseUrl) => {
    const years = document.querySelectorAll('.corso-insegnamenti-list > ul > li');
    const res: any = {}

    Array.from(years).forEach((yearList) => {
      if (!yearList) return null;
      const year = yearList.getAttribute('id');
      const yearName = yearList.querySelector('h2.u-titoletto')?.textContent?.trim() || '';
      const examElements = yearList.querySelectorAll('card-insegnamento');
      res[year || yearName] = Array.from(examElements).map((examElement) => {
        const nameElement = examElement.querySelector('a');
        const id = nameElement?.textContent?.trim().match(/\[(\w+)\]/)?.[1] || '';
        const name = nameElement?.textContent?.trim().split(']').slice(1).join(']').replace(/\b(CORSO|DI|LAUREA|MAGISTRALE|A|CICLO|UNICO|TRIENNALE|IN)\b/gi, '').replace(/\s+/g, ' ').trim();
        const url = nameElement?.getAttribute('href') || '#';
        return { id, name, url: url ? `${baseUrl}${url}` : url };
      }).filter((x) => x !== null);
    });
    return res;
  }, new URL(url).origin);

  await page.close();
  return exams;
}


async function doFile(title: string) {
  const filename = `./data/11-courses-${title}.json`;
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1920, height: 1080 } });

  const res: any = {}

  for (const course in data['pathsyears']) {
    res[course] = {}
    for (const path in data['pathsyears'][course]) {
      res[course][path] = {}

      console.log('Starting:', course, ' - ', path);
      const yearsPromises = Object.keys(data['pathsyears'][course][path]).map((year) => {
        const url = data['pathsyears'][course][path][year];
        return extractExams(url, browser).then((exams) => ({ year, exams, url }));
      });
      const results = await Promise.all(yearsPromises);
      for (const { year, exams, url } of results) {
        res[course][path][year] = { url, exams };
      }
      console.log('Done:', course, ' - ', path);
      fs.writeFileSync(`./data/20-exams-${title}.json`, JSON.stringify(res, null, 2));
    }
  }

  await browser.close();
}

doFile('triennaliUNITN');

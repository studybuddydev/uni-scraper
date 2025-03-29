import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import { url } from 'inspector';

async function extractExamData(page: Page): Promise<any> {
  const data = await page.evaluate(() => {

    const results: any = {};

    const tEl = document.querySelectorAll('.insegnamento-accordion .accordion > dt');
    const dEl = document.querySelectorAll('.insegnamento-accordion .accordion > dd');

    const titles = Array.from(tEl).map((t) => t.textContent?.trim() || '');
    const descriptions = Array.from(dEl).map((d) => d.textContent?.trim() || '');

    for (let i = 1; i < titles.length; i++) {
      const title = titles[i];
      const description = descriptions[i];
      if (title && description) results[title] = description;
    }

    const tableTitle = titles[0] ?? 'General Information';
    results[tableTitle] = {};
    const tableHeaderEl = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dt')
    const tableInfoEl = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dd')
    
    const tableTitles = Array.from(tableHeaderEl).map((t) => t.textContent?.trim() || '');
    const tableDescriptions = Array.from(tableInfoEl).map((d) => d.textContent?.trim() || '');

    for (let i = 0; i < tableTitles.length; i++) {
      const title = tableTitles[i];
      const description = tableDescriptions[i];
      if (title && description) results[tableTitle][title] = description;
    }

    const tableLines = document.querySelectorAll('.insegnamento-accordion .accordion > dd .u-dl-orizzontale > dl')
    tableLines.forEach((line) => {
      const title = line.querySelector('dt')?.textContent?.trim() || '';
      const description = Array.from(line.querySelectorAll('dd')).map((d) => d.textContent?.trim() || '') || [];
      if (title && description) results[title] = description;
    });

    return results;

  });
  return data;
}

async function extractExams(url: string, browser: Browser): Promise<any[]> {
  if (!url) return [];
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((resolve) => setTimeout(resolve, 1000));


  // get moduli and frazioni
  const MandF = await page.evaluate(() => {
    const difference = document.querySelectorAll('.insegnamento-links');
    if (difference.length !== 2) {
      return null;
    }
    const [moduli, frazioni] = Array.from(difference).map((x) =>
      Array.from(x.querySelectorAll('a'))
        .map((a) => {
          const name = a.textContent?.trim() || '';
          const url = 'https://unitn.coursecatalogue.cineca.it' + (a.getAttribute('href') || '#');
          return { name, url };
        })
    );
    return { moduli, frazioni };
  });
  if (!MandF) {
    console.log('We got a problem on ', url);
    await page.close();
    return [];
  }


  if (MandF.moduli.length === 0 && MandF.frazioni.length === 0) {
    const data = await extractExamData(page);
    await page.close();
    return [{ data, url }];
  }

  const results: any[] = [];

  if (MandF.moduli.length > 0) {
    for (const module of MandF.moduli) {
      const res = await extractExams(module.url, browser);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      res.forEach((x: any) => { x.module = module.name; });
      results.push(...res);
    }
  }

  if (MandF.frazioni.length > 0) {
    for (const fraction of MandF.frazioni) {
      const res = await extractExams(fraction.url, browser);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      res.forEach((x: any) => { x.fraction = fraction.name; });
      results.push(...res);
    }
  }

  await page.close();
  return results;
}

async function doFile(title: string) {
  const filename = `./data/21-exams-${title}.json`;
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const browser = await puppeteer.launch({ headless: false, defaultViewport: { width: 1920, height: 1080 } });

  // const xx = await extractExams('https://unitn.coursecatalogue.cineca.it/insegnamenti/2024/146171%2F1/2020/50430/10131?coorte=2024&schemaid=8539&adCodRadice=146171', browser);
  // const xx = await extractExams('https://unitn.coursecatalogue.cineca.it/insegnamenti/2024/50427_646254_96034/2020/50430/10131?coorte=2024&schemaid=8539', browser);
  // const xx = await extractExams('https://unitn.coursecatalogue.cineca.it/insegnamenti/2024/146171%2F2-PARI/2020/50430/10131?coorte=2024&schemaid=8539&adCodFraz=146171', browser);

  const res: any = {}
  for (const exam of data) {
    console.log('Starting:', exam.url);
    const eData = await extractExams(exam.url, browser);
    res[exam.url] = eData;
    fs.writeFileSync(`./data/30-exams-${title}.json`, JSON.stringify(res, null, 2));
  }

  await browser.close();

}


doFile('triennaliUNITN');

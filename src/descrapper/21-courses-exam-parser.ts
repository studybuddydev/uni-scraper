import puppeteer from 'puppeteer';
import fs from 'fs';

function doFile(title: string) {
  const filename = `./data/20-exams-${title}.json`;
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));

  const res: any = {};

  for (const course in data) {
    for (const path in data[course]) {
      // console.log('  Path:', path);
    for (const year in data[course][path]) {
        // console.log('    Year:', year);
        const d = data[course][path][year];
        const baseUrl = d['url'].split('/').slice(0, 3).join('/');
        for (const y in d['exams']) {
          for (const exam of d['exams'][y]) {
            const id = exam['id'];
            const name = exam['name'];
            const url = `${baseUrl}${exam['url']}`;

            if (!res[url]) res[url] = { names: new Set(), ids: new Set() };
            res[url]['names'].add(name);
            res[url]['ids'].add(id);
          }
        }
      }
    }
  }

  const res2: any = [];
  for (const url in res) {
    const names = Array.from(res[url]['names']);
    const ids = Array.from(res[url]['ids']);
    if (names.length !== 1) {
      console.log('Multiple names for URL:', url);
      console.log('Names:', names);
    }
    if (ids.length !== 1) {
      console.log('Multiple IDs for URL:', url);
      console.log('IDs:', ids);
    }

    res2.push({ url, name: names[0], id: ids[0] });
  }

  fs.writeFileSync(`./data/21-exams-${title}.json`, JSON.stringify(res2, null, 2));
}

doFile('triennaliUNITN');

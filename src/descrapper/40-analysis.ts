import puppeteer from 'puppeteer';
import fs from 'fs';
import { config } from './config';

const title = config.scripingName;

const previousYears = ["2024/2025", "2023/2024", "2022/2023"];

const filename = `./data/${title}/20-exams-${title}.json`;
const exams = JSON.parse(fs.readFileSync(filename, 'utf8'));

const res = {} as any;

for (const exam of Object.keys(exams)) {
  for (const path of Object.keys(exams[exam])) {
    const courseName = path === 'NA' ? exam : `${exam} - ${path}`;
    // console.log(courseName);

    const examsUrlList = [] as string[][];

    for (let y = 0; y < previousYears.length; y++) {
      if (y >= previousYears[y].length) {
        console.log(`Year ${y} not found`);
        continue;
      }
      examsUrlList.push(
        exams[exam][path][previousYears[y]]?.['exams'][`${y + 1}`]?.map((x: any) => x.url) ?? []
      );
    }
    res[courseName] = examsUrlList;
  }
}

fs.writeFileSync(`./data/${title}/40-courseexams-${title}.json`, JSON.stringify(res, null, 2));
console.log('File written: ', `./data/${title}/40-courseexams-${title}.json`);
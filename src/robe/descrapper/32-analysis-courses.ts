import puppeteer from 'puppeteer';
import fs from 'fs';
import { config } from './config';
import { get } from 'http';

const title = config.scripingName;

const previousYears = ["2024/2025", "2023/2024", "2022/2023", "2021/2022", "2020/2021", "2019/2020", "2018/2019", "2017/2018", "2016/2017", "2015/2016", "2014/2015", "2013/2014", "2012/2013", "2011/2012", "2010/2011"];


const filename = `./data/${title}/20-exams-${title}.json`;
const courses = JSON.parse(fs.readFileSync(filename, 'utf8'));


// load all exams
const filenameExams = `./data/${title}/31-exams-${title}.json`;
const exams: any[] = JSON.parse(fs.readFileSync(filenameExams, 'utf8'));

function getExamByUrl(url: string) {
  const e = exams.filter((x) => x.baseUrl === url);
  if (e === null) {
    console.log('Exam not found: ', url);
    return null;
  }
  return [...(new Set(e.map(x => x.groupCode)))];
}

const examMapping = {} as any;

for (const exam of Object.keys(courses)) {
  for (const path of Object.keys(courses[exam])) {
    const courseName = path === 'NA' ? exam : `${exam} - ${path}`;

    const examsUrlList = [] as string[][];

    for (let y = 0; y < config.numberOfYears; y++) {
      if (y >= previousYears[y].length) {
        console.log(`Year ${y} not found`);
        continue;
      }
      const yearUrls = courses[exam][path][previousYears[y]]?.['exams'][`${y + 1}`]?.map((x: any) => x.url) ?? [];
      const ee = yearUrls.map((x: any) => getExamByUrl(x)).flat();
      examsUrlList.push(ee);
    }
    examMapping[courseName] = examsUrlList;
  }
}

const res = [] as any[];
for (const courseName of Object.keys(examMapping)) {
  const exams = examMapping[courseName];

  // remove [ and ]
  const code = courseName.split(' ')[0].replace(/[\[\]']+/g, '');
  const name = courseName.split(' ').slice(1).join(' ');
  const c = {
    id: `${config.unicode}-${code}`,
    universityId: config.unicode,
    name: name,
    lastUpdated: new Date().toISOString(),
    deleted: null,
    type: config.type,
    exams: [] as any[],
    fullName: `${code} - ${name}`,
    courseId: code,
  }

  for (let i = 0; i < exams.length; i++) {
    const eYear: any[] = exams[i].map((e: any) => ({ examId: e, year: i + 1 }))
    c.exams.push(...eYear);
  }

  res.push(c);
}


fs.writeFileSync(`./data/${title}/32-courseexams-${title}.json`, JSON.stringify(res, null, 2));
console.log('End json');

// save also in jsonl
const outputFileJsonl = `./data/${title}/32-courseexams-${title}.jsonl`;
const outputStream = fs.createWriteStream(outputFileJsonl, { flags: 'a' });
for (const r of res) {
  outputStream.write(JSON.stringify(r) + '\n');
}
outputStream.end();
console.log('End jsonl');
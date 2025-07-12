import puppeteer from 'puppeteer';
import fs from 'fs';
import { config } from './config';
import { exit } from 'process';

const title = config.scripingName;
const filenameExams = `./data/${title}/30-exams-${title}.json`;
const exams = JSON.parse(fs.readFileSync(filenameExams, 'utf8'));

const results = [] as any[];

// const keys = new Set<string>();
const keyMapping: { [key: string]: string } = {
  'Tipo di corso': 'courseType',
  'Anno di offerta': 'offerYear',
  'Tipo Attività Formativa': 'activityType',
  'Ambito': 'field',
  'Lingua di erogazione': 'language',
  'Tipo attività didattica': 'teachingActivityType',
  'Valutazione': 'evaluation',
  'Periodo didattico': 'teachingPeriod',
  'Modalita didattica': 'teachingMode',
  'Settore scientifico disciplinare': 'disciplinarySector',
  'Sede': 'location',
  'Attività correlate': 'relatedActivities',
  'Altri Percorsi': 'otherPaths',
  'Tipologia interclasse': 'interclassType',
  'Ambito Interclasse': 'interclassField',

  'Contenuti': 'chapters',
  'Contenuti  per il gruppo studenti': 'chapters',
  'Contenuti/Programma del corso': 'chapters',

  'Testi': 'books',
  'Testi  per il gruppo studenti': 'books',
  'Libri di testo/Libri consigliati': 'books',

  'Obiettivi formativi': 'goals',
  'Obiettivi formativi e risultati di apprendimento attesi': 'goals',
  'Obiettivi formativi  per il gruppo studenti': 'goals',

  'Prerequisiti': 'requirements',
  'Prerequisiti  per il gruppo studenti': 'requirements',

  'Metodi didattici': 'teachingMethods',
  'Metodi didattici  per il gruppo studenti': 'teachingMethods',
  'Metodi didattici utilizzati e attività di apprendimento richieste allo studente': 'teachingMethods',

  "Verifica dell'apprendimento": 'learningAssessment',
  "Verifica dell'apprendimento  per il gruppo studenti": 'learningAssessment',
  "Metodi di accertamento e criteri di valutazione": 'learningAssessment',

  'Programma esteso': 'extendedProgram',
  'Programma esteso  per il gruppo studenti': 'extendedProgram',

  'Testi disponibili nel catalogo delle biblioteche': 'libraryTexts',
  'Testi disponibili nel catalogo delle biblioteche  per il gruppo studenti': 'libraryTexts',

  'Risorse online': 'onlineResources',
  'Risorse online  per il gruppo studenti': 'onlineResources',
  
  'Altro': 'other',
  'Altre informazioni': 'other',
  'Altro  per il gruppo studenti': 'other',
};

const codeMapping: { [key: string]: number } = { }

// generate a random HEX color
function getRandomColor() {
  const colors = [
  '#FFD1DC',
  '#AEC6CF',
  '#77DD77',
  '#FDFD96',
  '#CBAACB',
  '#FFB347',
  '#FF6961',
  '#99C5C4',
  '#E3E4FA',
  '#AAF0D1',
  '#FFDAB9',
  '#CFCFC4',
  '#B2FFFF',
  '#F49AC2',
  '#BDFCC9',
  '#D7BDE2',
  '#F9E79F',
  '#A9DFBF',
  '#AED6F1',
  '#F5CBA7',
  '#FADBD8',
  '#D5F5E3',
  '#FDEBD0',
  '#E8DAEF',
  '#D6EAF8',
  '#FCF3CF',
  '#D1F2EB',
  '#F6DDCC',
  '#EBDEF0',
  '#D4E6F1',
  '#FAD7A0',
  '#E5E8E8',
  '#F5B7B1',
  '#D2B4DE',
  '#A3E4D7',
  '#F7DC6F',
  '#EDBB99',
  '#F8C471',
  '#E6B0AA',
  '#A9CCE3',
  '#FDEDEC',
  '#D0ECE7',
  '#FCF3CF',
  '#FADBD8',
  '#F9E79F',
  '#D5DBDB',
  '#F1948A',
  '#BB8FCE',
  '#7FB3D5',
  '#76D7C4',
  '#F0B27A',
  '#E59866',
  '#EC7063',
  '#AF7AC5',
  '#F7C6C7',
  '#FFF5BA',
  '#C1F0F6',
  '#B5EAD7',
  '#FFDAC1',
  '#C7CEEA',
  '#FFCBC1',
  '#C2F0C2',
  '#FFFACD',
  '#BFD8B8',
  '#E2F0CB',
  '#D0E1F9'
  ];
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
}

function parseExam(baseUrl: string, exam: any) {

  const codeN = codeMapping[exam.code] ?? 1;
  codeMapping[exam.code] = codeN + 1;

  const res: any = {
    baseUrl,
    url: exam.url,
    universityId: config.unicode,
    groupCode: `${config.unicode}-${exam.code}`,
    code: `${config.unicode}-${exam.code}-${codeN}`,
    courseId: 'TODO',
    name: exam.title,
    lastUpdated: new Date().toISOString(),
    deleted: null,
    fraction: exam.fraction ?? null,
    module: exam.module ?? null,
    color: getRandomColor(),
    cfu: parseInt(exam.data['Crediti']?.[0].split(' ')[0]),
    hours: parseInt(exam.data['Durata']?.[0].split(' ')[0]),
    teachers: [
        ...(exam.data['Informazioni generali']?.['Docenti']?.split(',') ?? []),
        ...(exam.data['Informazioni generali']?.['Responsabili']?.split(',') ?? []),
        ...(exam.data['Informazioni generali']?.['Assistenti']?.split(',') ?? []),
    ].filter((x: any) => !!x).map(x => x.trim()),
    courseName: exam.data['Informazioni generali']?.['Corso di studi'] ?? null,
    coursePath: exam.data['Informazioni generali']?.['Percorso'] ?? null,
    year: +(exam.data['Anno di corso']?.[0] ?? null),

    // all: exam.data,

  };

  // Object.keys(exam.data).forEach((k) => { keys.add(k); }); 

  // Dynamically parse and rename keys
  for (const [originalKey, newKey] of Object.entries(keyMapping)) {
    if (originalKey == 'Obiettivi formativi  per il gruppo studenti' && exam.data[originalKey])
      console.log(exam.url)
    if (exam.data[originalKey]) {
      if (Array.isArray(exam.data[originalKey])) {
        res[newKey] = exam.data[originalKey][0];
      } else {
        res[newKey] = exam.data[originalKey];
      }
    }
  }

  return res;
}

for (const eUrl in exams) {
  const ee = exams[eUrl];
  for (const e of ee) {
    const r = parseExam(eUrl, e);
    results.push(r);
  }
}

// console.log('Keys:', keys);

// save file
const outputFile = `./data/${title}/31-exams-${title}.json`;
fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log('End json');

// save also in jsonl
const outputFileJsonl = `./data/${title}/31-exams-${title}.jsonl`;
const outputStream = fs.createWriteStream(outputFileJsonl, { flags: 'a' });
for (const r of results) {
  outputStream.write(JSON.stringify(r) + '\n');
}
outputStream.end();
console.log('End jsonl');

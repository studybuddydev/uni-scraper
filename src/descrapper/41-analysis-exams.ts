import puppeteer from 'puppeteer';
import fs from 'fs';
import { config } from './config';

const title = config.scripingName;
const filenameExams = `./data/${title}/30-exams-${title}.json`;
const exams = JSON.parse(fs.readFileSync(filenameExams, 'utf8'));

const results = [] as any[];

// const keys = new Set<string>();

function parseExam(baseUrl: string, exam: any) {

  const keyMapping: { [key: string]: string } = {
    'Informazioni generali': 'generalInfo',
    'Tipo di corso': 'courseType',
    'Anno di offerta': 'offerYear',
    'Anno di corso': 'courseYear',
    'Tipo Attività Formativa': 'activityType',
    'Ambito': 'field',
    'Lingua di erogazione': 'language',
    'Crediti': 'credits',
    'Tipo attività didattica': 'teachingActivityType',
    'Valutazione': 'evaluation',
    'Periodo didattico': 'teachingPeriod',
    'Durata': 'duration',
    'Modalita didattica': 'teachingMode',
    'Settore scientifico disciplinare': 'disciplinarySector',
    'Sede': 'location',
    'Contenuti': 'content',
    'Testi': 'texts',
    'Obiettivi formativi': 'learningObjectives',
    'Prerequisiti': 'prerequisites',
    'Metodi didattici': 'teachingMethods',
    'Altro': 'other',
    "Verifica dell'apprendimento": 'learningAssessment',
    'Programma esteso': 'extendedProgram',
    'Testi disponibili nel catalogo delle biblioteche': 'libraryTexts',
    'Risorse online': 'onlineResources',
    'Contenuti  per il gruppo studenti': 'contentForStudentGroup',
    'Testi  per il gruppo studenti': 'textsForStudentGroup',
    'Obiettivi formativi  per il gruppo studenti': 'learningObjectivesForStudentGroup',
    'Prerequisiti  per il gruppo studenti': 'prerequisitesForStudentGroup',
    'Metodi didattici  per il gruppo studenti': 'teachingMethodsForStudentGroup',
    "Verifica dell'apprendimento  per il gruppo studenti": 'learningAssessmentForStudentGroup',
    'Programma esteso  per il gruppo studenti': 'extendedProgramForStudentGroup',
    'Testi disponibili nel catalogo delle biblioteche  per il gruppo studenti': 'libraryTextsForStudentGroup',
    'Risorse online  per il gruppo studenti': 'onlineResourcesForStudentGroup',
    'Altro  per il gruppo studenti': 'otherForStudentGroup',
    'Attività correlate': 'relatedActivities',
    'Altri Percorsi': 'otherPaths',
    'Tipologia interclasse': 'interclassType',
    'Ambito Interclasse': 'interclassField',
  };

  const res: any = {
    baseUrl,
    url: exam.url,
    code: exam.code,
    title: exam.title,
    fraction: exam.fraction ?? null,
    module: exam.module ?? null,
  };

  // Object.keys(exam.data).forEach((k) => { keys.add(k); }); 

  // Dynamically parse and rename keys
  for (const [originalKey, newKey] of Object.entries(keyMapping)) {
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
const outputFile = `./data/${title}/41-exams-${title}.json`;
fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log('End');

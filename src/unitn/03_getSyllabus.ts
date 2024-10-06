import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import OpenAI from "openai";
import 'dotenv/config'
const openai = new OpenAI();

const filePath = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unitn/examsUrls.json';

async function main() {
    const browser = await puppeteer.launch({ headless: true });
    const examUrls = fs.readFileSync(filePath, 'utf8');
    const parsedExamUrls = JSON.parse(examUrls);

    for (const course in parsedExamUrls) {
        if (parsedExamUrls.hasOwnProperty(course)) {
            console.log(`Course: ${course}`);
            const exams = parsedExamUrls[course];
            for (const exam of exams) {
                console.log(`       Exam: ${exam.name}`);
                
                const page = await browser.newPage();
                await page.goto(exam.url, { waitUntil: 'networkidle0' });
                
                const fractions = await getFraction(page);
                
                if (fractions.length > 0) {
                    for (const [index, fractionName] of fractions.entries()) {
                        console.log(`           Fraction: ${fractionName}`);
                        await clickFraction(page, index);
                        const syllabus = await scrapeSyllabus(page);
                        processAndSave(syllabus, course, exam.examId)
                     
                    }
                } else {
                    const syllabus = await scrapeSyllabus(page);
                    processAndSave(syllabus, course, exam.examId)
                    
                }
                
                await page.close();


                
                // Wait for 0.5 seconds between exams
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    await browser.close();
}

async function getFraction(page: Page): Promise<string[]> {
    console.log('Getting fractions');
    try {
        await page.waitForSelector('.insegnamento-links', { timeout: 5000 });

        const fractionNames = await page.evaluate(() => {
            const selector = '.insegnamento-links li a';
            const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
            return links.map(link => link.textContent?.trim() || '');
        });

        return fractionNames;
    } catch (error) {
        console.error(`Error in getFraction: ${error}`);
        return [];
    }
}

async function clickFraction(page: Page, index: number) {
    try {
        await page.waitForSelector('.insegnamento-links', { timeout: 5000 });
        const fractionSelectors = await page.$$('.insegnamento-links li a');
        
        if (index < fractionSelectors.length) {
            await fractionSelectors[index].click();
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
        } else {
            console.error(`Fraction index ${index} out of range`);
        }
    } catch (error) {
        console.error(`Error clicking fraction: ${error}`);
    }
}

async function scrapeSyllabus(page: Page): Promise<CourseInfo> {
    try {
        await page.waitForSelector('.u-filetto', { timeout: 5000 });

        const title = await page.$eval('.u-filetto', element => element.textContent?.trim() || 'no title found');
        console.log(`           Scraping Title: ${title}`);

        await page.waitForSelector('.accordion', { timeout: 5000 });
        let infoElements: CourseInfo = await getCourseInfo(page);

        infoElements.name = title;
        infoElements.url = page.url();

        return infoElements;
    } catch (error) {
        console.error(`Error in scrapeSyllabus: ${error}`);
        return {
            name: 'Error',
            icon: '',
            color: '',
            chapters: '',
            books: '',
            examDetails: '',
            learningGoals: '',
            methods: '',
            requirements: '',
            credits: '',
            lang: '',
            teachers: '',
            course: '',
            subesami: [],
            url: page.url()
        };
    }
}


async function getCourseInfo(page: Page): Promise<CourseInfo> {
    console.log('passo dal getcourseinfo');


    //const matchingElements = await page.$$('h1, dl');
    //console.log('Matching elements:', matchingElements.length); // Should log the number of matched elements

    return await page.$$eval('h1,dd,dt', (elements: Element[]) => {

        //console.log('Inside $$eval, elements:', elements); 
        let currentGroup: CourseInfo = {
            name: '',
            icon: '',
            color: '',
            chapters: '',
            books: '',
            examDetails: '',
            learningGoals: '',
            methods: '',
            requirements: '',
            credits: '',
            lang: '',
            teachers: '',
            course: '',
            subesami: [],
            url: ''
        };



        elements.forEach((element) => {
            const tagName = element.tagName.toLowerCase();

            console.log('tagName', tagName);

            if (tagName === 'h1') {
                currentGroup.name = element.textContent?.trim() || '';
            } else if (tagName === 'dt') {
                const item = element.textContent?.trim() || ''
                    
                console.log('item',item);

                if (item.includes('Contenuti')) {
                    currentGroup.chapters = element.nextElementSibling?.textContent?.trim() || '';
                } else if (item.includes('Informazioni')) {
                    const infoitem = element.nextElementSibling
                    if (infoitem) {
                        // Look for <dt> elements within the infoItem
                        const dtElements = infoitem.querySelectorAll('dt');

                        dtElements.forEach((dtElement) => {
                            const label = dtElement.textContent?.trim() || '';
                            const ddElement = dtElement.nextElementSibling?.textContent?.trim() || '';

                            if (label.includes('Lingua di erogazione')) {
                                currentGroup.lang = ddElement;
                            } else if (label.includes('Crediti')) {
                                currentGroup.credits = ddElement;
                            } else if (label.includes('Docenti')) {
                                currentGroup.teachers = ddElement
                            } else if (label.includes('Corso di studi')) {
                                currentGroup.course = ddElement
                            } else if (label.includes('Attività correlate')) {
                                const links = dtElement.nextElementSibling?.querySelectorAll('a');
                                if (links) {
                                    currentGroup.subesami = Array.from(links).map(link => link.href);
                                }
                            }

                        });
                    }

                } else if (item.includes('Testi')) {
                    currentGroup.books = element.nextElementSibling?.textContent?.trim() || '';
                } else if (item.includes('Obiettivi formativi')) {
                    currentGroup.learningGoals = element.nextElementSibling?.textContent?.trim() || '';
                } else if (item.includes('Metodi didattici')) {
                    currentGroup.methods = element.nextElementSibling?.textContent?.trim() || '';
                } else if (item.includes('Metodi di accertamento')) {
                    currentGroup.examDetails = element.nextElementSibling?.textContent?.trim() || '';
                } else if (item.includes('Programma esteso')) {
                    // Append the item to the existing chapters
                    currentGroup.chapters = (currentGroup.chapters || '') + '\n' + (element.nextElementSibling?.textContent?.trim() || '');
                } else if (item.includes('Prerequisiti')) {
                    currentGroup.requirements = element.nextElementSibling?.textContent?.trim() || '';
                }
            }
        });

        return currentGroup;


    });
}




async function processSyllabusChapters(syllabus: CourseInfo): Promise<processedChapter> {
    const systemPromptChapters = `You are a helpful studybuddy for university students, you are given in input a string with the content of the course, 
                        you should infer the chapters and the section(if present) and put it in the tasks list , add notes in the postIts if needed to clarify, use a representative mdi icon provising the its name and a random hex color, create a json 
                        output should follow this schema:{ icon: string, color:string, chapters: [{ name: string, showTasks: true, tasks: {name: string}[], postIts: {"color": "#e6b905","content": ""}[], links:string[]}`



    let response = await openai.chat.completions.create({
        model: "gpt-4o-mini",  // Make sure to specify the correct model
        messages: [
            { role: "system", content: systemPromptChapters },
            { role: "user", content: syllabus.chapters },
        ],
        response_format: { type: "json_object" },
    });


    const parsedChapters = JSON.parse(response.choices[0].message.content || '');

    return parsedChapters


}


async function processSyllabusBooks(syllabus: CourseInfo): Promise<Book[]> {
    const systemPromptBooks = `You are a helpful studybuddy for university students, you are given in input a string with the content of the course, 
      you should infer list of the books used in this universitycourse, create a json a and fill the schema as you believe it is useful for the student, the 
      output should follow this schema:{books: [{ name: string, authors: string[],year: number, notes: string[]}`

    let response = await openai.chat.completions.create({
        model: "gpt-4o-mini",  // Make sure to specify the correct model
        messages: [
            { role: "system", content: systemPromptBooks },
            { role: "user", content: syllabus.books },
        ],
        response_format: { type: "json_object" },
    });

    const parsedBooks = JSON.parse(response.choices[0].message.content || '');

    return parsedBooks

}



async function processAndSave(syllabus: CourseInfo, courseid: string, parent: string) {

   
    console.log('processing and saving', syllabus.name);

    syllabus.name = syllabus.name.replace(/\//g, '');
    console.log('processing and saving', syllabus.name);
    // Execute the regex against the syllabus name
    const id = syllabus.name.match(/\[(\w+)\]/)?.[1] || '';
    const name = syllabus.name.split(']').slice(1).join(']').replace(/[^\w\s]/g, ' ').trim();



    const path = 'data/syllabustn/'
    const files = fs.readdirSync(path)
    const found = files.find(file => file.includes(id))
    if (found) {
        console.log('skipping' + id);
        return
    }


    const processedChapters: processedChapter = await processSyllabusChapters(syllabus)
    const processedBooks: Book[] = await processSyllabusBooks(syllabus)

    const uniname = 'unitn'
    console.log('creating dataexam');




    const exam: DataExam = {
        id: uniname + id,
        parentExam: parent,
        universityId: uniname,
        course: syllabus.course,
        courseId: courseid,
        name: name,
        lastUpdated: new Date(),
        deleted: null,

        goals: syllabus.learningGoals,

        chapters: processedChapters?.chapters,

        urls: [{ "name": "syllabus", "url": syllabus.url },],

        icon: processedChapters?.icon,
        color: processedChapters?.color,

        examMode: syllabus.examDetails,
        requirements: syllabus.requirements,
        cfu: syllabus.credits,
        language: syllabus.lang,
        teachers: syllabus.teachers.split(',').map(name => ({ name: name.trim() })),

        books: processedBooks



        //books: syllabus.books,



    }

    const fileName = `${syllabus.name.replace(/\s+/g, '_')}.json`;

    // Convert the exam object to a stringified JSON
    const jsonString = JSON.stringify(exam, null, 2);

    fs.writeFile('data/syllabustn/' + fileName, jsonString, (err) => {
        if (err) {
            console.error("Error writing file:", err);
        } else {
            console.log(`Exam details saved to ${fileName}`);
        }
    });
}


export interface CourseInfo {
    name: string;
    icon: string;
    color: string;
    chapters: string;
    books: string;
    examDetails: string;
    learningGoals: string;
    methods: string;
    requirements: string;
    credits: string;
    lang: string;
    teachers: string;
    course: string;
    subesami: string[];
    url: string;
}

interface processedChapter {
    icon: string,
    color: string,
    chapters: []
}

interface Book {

    name: string,
    authors: string[],
    year: number,
    notes: string[]

}

interface DataExam {
    id: string;
    parentExam: string;
    universityId: string;
    course: string;
    courseId: string;
    name: string;
    lastUpdated: Date;
    deleted: Date | null;

    description?: string;
    goals?: string;
    requirements?: string;

    chapters?: {
        id: number;
        parentId: number | null;
        name: string;
        description: string;
    }[];
    urls?: {
        name: string;
        url: string;
    }[];
    teachers?: {
        name: string;
        email?: string;
    }[];
    books?: Book[]


    cfu?: string;
    examMode?: string;
    hours?: string;
    semester?: string;
    year?: string;
    teachingYear?: string;
    deparment?: string;

    language?: string;
    note?: string
    color?: string;
    icon?: string;
}
interface Exam {
    examId: string;
    year: string;
    semester: string;
    url: string;
}

interface Course {
    name: string;
    id: string;
    uni: string;
    exams: Exam[];
    type: string;
}



main()
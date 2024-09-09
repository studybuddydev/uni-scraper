import puppeteer, { Browser, Page } from 'puppeteer';
import OpenAI from "openai";
import 'dotenv/config'
import fs from 'fs';
const openai = new OpenAI();

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

//the actual scraping of the course
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

            if (tagName === 'h1') {
                currentGroup.name = element.textContent?.trim() || '';
            } else if (tagName === 'dt') {
                const item = element.textContent?.trim() || ''
                // console.log(item);


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
                } else if (item.includes('Verifica dell\'apprendimento')) {
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



// from  url of a syllabus from scrape it and return the contnt of the course  
export async function scrapeSyllabus(url: string, browser: Browser): Promise<CourseInfo> {
    //const browser = await puppeteer.launch({ headless: true });
    const page: Page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('app-root', { timeout: 5000 });
    await page.waitForSelector('.u-filetto');

    // Extract the title text
    const title = await page.$eval('.u-filetto', element => element.textContent?.trim() || 'no title found');
    console.log(`           scrapando  Title: ${title}`);

    await page.waitForSelector('.accordion');
    let infoElements: CourseInfo = await getCourseInfo(page);



    // console.log('infoelements', infoElements);



    infoElements.name = title;



    //await browser.close();

    return infoElements;
}

export async function getSubdivisionUrls(url: string, browser: Browser): Promise<string[]> {
    console.log('               this exams may have an inner subdivision');

    //const browser = await puppeteer.launch({ headless: true });
    const page: Page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('app-root', { timeout: 5000 });



    const urls = await page.evaluate(() => {
        const selector = '#top > app-root > div > insegnamento > div.app-main > main > div.insegnamento > div:nth-child(4) > ul > li > a'
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
        return links.map(link => link.href);
    });

    console.log('urls', urls);

    //close browser
    //await browser.close();

    return urls
}

// from the extracted course use ai to create a list of chapters 
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

    const processedChapters: processedChapter = await processSyllabusChapters(syllabus)
    const processedBooks: Book[] = await processSyllabusBooks(syllabus)


    // Execute the regex against the syllabus name
    const id = syllabus.name.match(/\[(\w+)\]/)?.[1] || '';
    const name = syllabus.name.split(']').slice(1).join(']').replace(/[^\w\s]/g, ' ').trim();

    const path = 'data/syllabus/'
    const files = fs.readdirSync(path)
    const found = files.find(file => file.includes(id))
    if (found) {
        console.log('skipping' + id);
        return
    }


    const uniname = courseid.substring(0, 5)

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

    fs.writeFile('data/syllabus/' + fileName, jsonString, (err) => {
        if (err) {
            console.error("Error writing file:", err);
        } else {
            console.log(`Exam details saved to ${fileName}`);
        }
    });
}

// async function exploreSubdivision(url: string, page: Page): Promise<string[]> {

// }

// async function getsyllabus(exam: Exam, courseid: string, type: string) {
//     const examurl = exam.url
//     const browser = await puppeteer.launch({ headless: true });
//     // in the folder data/syllabus if there is a file that contains the id of the exam it means that the exam has already been processed, only contains the id the filename is more complex
   
//     const examId = (exam['examId'] as string).substring(5);
//     console.log('examId', examId);

//     const path = 'data/syllabus/'
//     const files = fs.readdirSync(path)
//     const found = files.find(file => file.includes(examId))
//     // if (found) {
//     //     console.log('skipping' + examId);
//     //     return
//     // }


//     let syllabus = await scrapeSyllabus(examurl, browser)  // 
//     syllabus.url = examurl

//     //è medicina e ha i sottoesami
//     if (syllabus.subesami.length != 0) {
//         console.log('   ci sono subesami', syllabus.subesami);



//         for (const subesame of syllabus.subesami) {
//             console.log('       subesame', subesame);
//             const subesameSyllabus = await scrapeSyllabus(subesame, browser)
//             if (syllabus.chapters != '') {
//                 console.log('               a posto ci sono i capitoli', syllabus.chapters);
//                 processAndSave(subesameSyllabus, courseid)
//             } else {
//                 const urls = await getSubdivisionUrls(subesame, browser)
//                 for (const url of urls) {

//                     syllabus = await scrapeSyllabus(url, browser)

//                     if (syllabus.chapters)
//                         processAndSave(syllabus, courseid)
//                     else
//                         console.log('no chapters', syllabus);

//                 }
//             }
//            // processAndSave(subesameSyllabus, courseid)
//         }
//         }else {

//             console.log('   no subesami', syllabus.subesami);

//             if (syllabus.chapters != '') {
//                 processAndSave(syllabus, courseid)
//             } else {
//                 const urls = await getSubdivisionUrls(examurl, browser)
//                 for (const url of urls) {

//                     syllabus = await scrapeSyllabus(url, browser)

//                     if (syllabus.chapters){
//                         console.log('                   a posto ci sono i capitoli', syllabus.chapters);
//                         processAndSave(syllabus, courseid)
//                     }
//                     else{
//                         console.log('                   no chapters', syllabus);
//                     }

//                 }
//             }

//         }

//     await browser.close();
    
// }

// const url = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2023/8249_122421_8338/2022/8251/81?coorte=2023&schemaid=2493'
// const url1 = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2023/8108_115535_145/2022/8110/81?coorte=2022&schemaid=2808'

//getsyllabus(url1)



async function main() {
    const path = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/unibs_courses.json'
    const courseids = ['unibs08624']





    let problematicExams: string[] = []

    // for each course id 
    for (const courseid of courseids) {

        console.log('getting course', courseid);


        const jsonData = JSON.parse(fs.readFileSync(path, 'utf8'));
        const course: Course = jsonData.find((obj: Course) => obj.id === courseid); // Converts obj.id to string for comparison
        console.log(course.name + '=========================================================================');

        for (const exam of course.exams) {

            try {
                
               // await getsyllabus(exam, courseid, course.type )
            } catch (e) {
                console.log(exam['url']);
                problematicExams.push(exam['url'])
            }

        }
        console.log('problematic exams' + problematicExams);
    }


}


async function mainone() {

    const id = 'unibs05713'// get data from unibs08624.json
    const browser = await puppeteer.launch({ headless: true });


    // read id.json from data folder
    const path = `/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/${id}.json`
    const jsonData = JSON.parse(fs.readFileSync(path, 'utf8'));

    console.log(jsonData);

    for (const exam in jsonData) {
        console.log(exam);
        const urls = jsonData[exam];
       
        for (const url of urls) {
            const syllabus = await scrapeSyllabus(url, browser)
            processAndSave(syllabus, id, exam)

        }


    }
    
}

mainone()


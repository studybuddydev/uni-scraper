import puppeteer, { Page } from 'puppeteer';
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
    credits:string;
    lang:string;
    teachers: string;
    course:string;
}

interface processedChapter {
    icon: string,
    color: string,
    chapters: []
}

interface Book{
    
    name: string, 
    authors: string[],
    year: number, 
    notes: string[]

}

interface DataExam {
    id: string;
    universityId: string;
    course: string;
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

//the actual scraping of the course
async function getCourseInfo(page: Page): Promise<CourseInfo>{
    console.log('passo dal getcourseinfo');


    const matchingElements = await page.$$('h1, dl');
    console.log('Matching elements:', matchingElements.length); // Should log the number of matched elements

    
    return await page.$$eval('h1,dd,dt', (elements: Element[]) => {

        console.log('Inside $$eval, elements:', elements); 
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
            credits:'',
            lang: '',
            teachers: '',
            course:''
        };

        
    
        elements.forEach((element) => {
            const tagName = element.tagName.toLowerCase();
    
            if (tagName === 'h1') {
                currentGroup.name = element.textContent?.trim() || '';
            } else if (tagName === 'dt') {
                const item = element.textContent?.trim() || ''
                console.log(item);
                
    
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
                            }else if (label.includes('Docenti')){
                                currentGroup.teachers = ddElement
                            }else if (label.includes('Corso di studi')){
                                currentGroup.course = ddElement
                            }
                                
                        });
                    }

                }else if (item.includes('Testi')) {
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
                }else if(item.includes('Prerequisiti')){
                    currentGroup.requirements = element.nextElementSibling?.textContent?.trim() || '';
                }
            }
        });
    
        return currentGroup;
    
    
    });
}



// from  url of a syllabus from scrape it and return the contnt of the course  
export async function scrapeSyllabus(url: string): Promise<CourseInfo> {
    const browser = await puppeteer.launch({ headless: true });
    const page: Page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('app-root', { timeout: 5000 });
    await page.waitForSelector('.u-filetto');

    // Extract the title text
    const title = await page.$eval('.u-filetto', element => element.textContent?.trim() || 'no title found');
    console.log(`Title: ${title}`);

    await page.waitForSelector('.accordion');
    let infoElements: CourseInfo = await getCourseInfo(page);



    console.log('infoelements', infoElements);



    infoElements.name = title;

   

    await browser.close();

    return infoElements;
}

export async function getSubdivisionUrls(url: string) {
    console.log('this exams may have an inner subdivision AL/MZ');
    
    const browser = await puppeteer.launch({ headless: true });
    const page: Page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('app-root', { timeout: 5000 });



    const urls = await page.evaluate(() => {
        const selector = '#top > app-root > div > insegnamento > div.app-main > main > div.insegnamento > div:nth-child(4) > ul > li > a'
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
        return links.map(link => link.href);
    });

    console.log('urls', urls);
    return urls
}

// from the extracted course use ai to create a list of chapters 
async function processSyllabusChapters(syllabus: CourseInfo): Promise<processedChapter> {
    const systemPromptChapters = `You are a helpful studybuddy for university students, you are given in input a string with the content of the course, 
                        you should infer the chapters and the section(if present) and put it in the tasks list with done set to false, add notes in the postIts if needed to clarify, use a representative mdi icon provising the its name and a random hex color, create a json 
                        output should follow this schema:{ icon: string, color:string, chapters: [{ name: string, showTasks: true, tasks: {name: string, done: bool}[], postIts: {"color": "#e6b905","content": ""}[], links:string[]}`



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



async function processAndSave(syllabus: CourseInfo) {

    const processedChapters: processedChapter = await processSyllabusChapters(syllabus)
    const processedBooks: Book[] = await processSyllabusBooks(syllabus)


    // Execute the regex against the syllabus name
    const id = syllabus.name.match(/\[(\w+)\]/)?.[1] || '';
    const name = syllabus.name.split(']').slice(1).join(']').replace(/[^\w\s]/g, ' ').trim();


    const uniname = 'unibs'

    console.log('creating dataexam');
    

    

    const exam: DataExam = {
        id: uniname + id,
        universityId: uniname,
        course: syllabus.course,
        name: name,
        lastUpdated: new Date(),
        deleted: null,

        goals: syllabus.learningGoals,

        chapters: processedChapters?.chapters,

        urls: [{ "name": "syllabus", "url": url },],

        icon: processedChapters?.icon,
        color: processedChapters?.color,

        examMode: syllabus.examDetails,
        requirements: syllabus.requirements,
        cfu: syllabus.credits,
        language: syllabus.lang,
        teachers: syllabus.teachers.split(',').map(name => ({ name: name.trim() })),

        books:processedBooks 


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

async function getsyllabus(url: string) {

    let syllabus = await scrapeSyllabus(url)



    if (syllabus.chapters != '') {
        processAndSave(syllabus)
    } else {
        const urls = await getSubdivisionUrls(url)
        for (const url of urls) {
      
            syllabus = await scrapeSyllabus(url)

            if (syllabus.chapters)
                processAndSave(syllabus)
            else
                console.log('no chapters', syllabus);

        }
    }




}

const url = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2023/8249_122421_8338/2022/8251/81?coorte=2023&schemaid=2493'
const url1 = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2023/8108_115535_145/2022/8110/81?coorte=2022&schemaid=2808'

//getsyllabus(url1)



async function main() {
    const path = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs_courses.json'


    interface Course { name: string, id: string, uni: string, exams: [] }

    const jsonData = JSON.parse(fs.readFileSync(path, 'utf8'));
    const ingemec: Course = jsonData.find((obj: Course) => obj.id === 'unibs05742'); // Converts obj.id to string for comparison
    for (const exam of ingemec.exams) {
        
        try {
            await getsyllabus(exam['url'])
        } catch (e) {
            console.log(exam['title'] + 'is broken');
            console.log(exam['url']);
        }

    }

}

main()


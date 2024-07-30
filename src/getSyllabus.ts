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
    links: string[]
    postIts: string[]
    books: string;
    examDetails: string;
    learningGoals: string;
    methods: string;
}

interface processedChapter {
    icon: string,
    color: string,
    chapters: []
}

//the actual scraping of the course
async function getCourseInfo(page: Page): Promise<CourseInfo> {
    return await page.$$eval('.accordion > dt, .accordion > dd', (elements: Element[]) => {
        let currentGroup: Partial<CourseInfo> = {};

        for (const element of elements) {
            if (element.tagName === 'DT') {
                currentGroup.name = element.textContent!.trim();
            } else if (element.tagName === 'DD') {
                const item = element.textContent!.trim();
                switch (currentGroup?.name) {
                    case 'Contenuti':
                        currentGroup.chapters = item//.split('-').map(chapter => chapter.trim()).filter(chapter => chapter !== '');
                        break;
                    case 'Testi':
                        currentGroup.books = item
                    case 'Obiettivi formativi':
                        currentGroup.learningGoals = item;
                        break;
                    case 'Metodi didattici':
                        currentGroup.methods = item;
                        break;
                    case 'Verifica dell\'apprendimento':
                        currentGroup.examDetails = item;
                        break;
                    case 'Programma esteso':
                        currentGroup.chapters += item
                    default:
                        break;
                }
            }
        }


        return currentGroup as CourseInfo;
    });
}



// from  url of a syllabus from scrape it and return the contnt of the course  
export async function scrapeSyllabus(url: string): Promise<CourseInfo> {
    const browser = await puppeteer.launch();
    const page: Page = await browser.newPage();
    //const url = ctx.message?.text as string
    await page.goto(url, { waitUntil: 'networkidle0' }); // Replace with your target web app URL

    await page.waitForSelector('app-root', { timeout: 5000 });

    await page.waitForSelector('.u-filetto');

    // Extract the title text
    const title = await page.$eval('.u-filetto', element => element.textContent);


    console.log(`Title: ${title}`);

    await page.waitForSelector('.accordion');
    let infoElements: CourseInfo = { name: '', icon: '', color: '', chapters: '', links: [], postIts: [], books: '', examDetails: '', learningGoals: '', methods: '' };

    // unico modo di farlo funzionare, ho provato a tirare fuori sta funzione per pulire un po' il codice ma non funziona

    try {
        infoElements = await getCourseInfo(page)
    } catch (e) {
        console.log('scassato');

    }


    infoElements.name = title?.trim() || 'no title found';


    await browser.close();


    return infoElements



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


async function processSyllabusBooks(syllabus: CourseInfo) {
    const systemPromptBooks = `You are a helpful studybuddy for university students, you are given in input a string with the content of the course, 
      you should infer list of the books used in this universitycourse, create a json a and fill the schema as you believe it is useful for the student, the 
      output should follow this schema:{books: [{ name: string, authors: string[], notes: string[]}`

    let response = await openai.chat.completions.create({
        model: "gpt-4o-mini",  // Make sure to specify the correct model
        messages: [
            { role: "system", content: systemPromptBooks },
            { role: "user", content: syllabus.books },
        ],
        response_format: { type: "json_object" },
    });

    const parsedBooks = response.choices[0].message.content

    return parsedBooks

}

async function getsyllabus(url: string) {

    const syllabus = await scrapeSyllabus(url)

    console.log(syllabus.chapters);
    

    if (syllabus.chapters) {

        const processedChapters: processedChapter = await processSyllabusChapters(syllabus)

        console.log(processedChapters);



        // Execute the regex against the syllabus name
        const id = syllabus.name.match(/\[(\w+)\]/)?.[1] || '';
        const name = syllabus.name.split(']').slice(1).join(']').replace(/[^\w\s]/g, ' ').trim();
        ;

        const uniname = 'unibs'


        const exam = {
            name: name,
            id: uniname + id,
            icon: processedChapters?.icon,
            color: processedChapters?.color,
            chapters: processedChapters?.chapters,
            links: [{ "name": "syllabus", "url": url },],
            postIts: [{
                "color": "#FFEB3B",
                "content": syllabus.books
            },
            {
                "color": "#FFEB3B",
                "content": syllabus.examDetails
            }]

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
    }else{
        console.log('è rotto');
        
    }




}

const url = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2023/8249_122421_8338/2022/8251/81?coorte=2023&schemaid=2493'
const url1 = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2023/8108_115535_145/2022/8110/81?coorte=2022&schemaid=2808'

getsyllabus(url)



async function main() {
    const path = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs_esami.json'


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

//main()


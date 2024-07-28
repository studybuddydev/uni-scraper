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
    links:string[]
    postIts:string[]
    books: string;
    examDetails: string;
    learningGoals: string;
    methods: string;
}





// get url of a syllabus from unitn course catalogue and scrape it 
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
    let infoElements: CourseInfo = { name: '',icon:'', color:'', chapters: '',links:[], postIts: [], books: '', examDetails: '', learningGoals: '', methods: '' };

    // unico modo di farlo funzionare, ho provato a tirare fuori sta funzione per pulire un po' il codice ma non funziona
    infoElements = await page.$$eval('.accordion > dt, .accordion > dd', (elements: Element[]) => {
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

     infoElements.name = title?.trim() || 'no title found';




    //save to a json file 

    


    await browser.close();

    //const processedSyllabus = await processSyllabus(infoElements)
    //const inputfile: InputFile = new InputFile(Buffer.from(JSON.stringify(processedSyllabus, null, 2)), processedSyllabus?.name + '.json')


    return  infoElements



}


async function processSyllabusChapters(syllabus: CourseInfo) {
    const systemPromptChapters = `You are a helpful studybuddy for university students, you are given in input a string with the content of the course, 
                        you should infer the chapters and the section(if present), add notes in the postIts if needed to clarify, create a json 
                        output should follow this schema:{chapters: [{ name: string, sections: string[], postIts: {"color": "#e6b905","content": ""}, links:string[]}`



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


    // const systemPromptBooks = `You are a helpful studybuddy for university students, you are given in input a string with the content of the course, 
    //   you should infer list of the books used in this universitycourse, create a json a and fill the schema as you believe it is useful for the student, the 
    //   output should follow this schema:{books: [{ name: string, authors: string[], notes: string[]}`

    // response = await openai.chat.completions.create({
    //     model: "gpt-4o-mini",  // Make sure to specify the correct model
    //     messages: [
    //         { role: "system", content: systemPromptBooks },
    //         { role: "user", content: syllabus.books },
    //     ],
    //     response_format: { type: "json_object" },
    // });

    // const parsedBooks = response.choices[0].message.content

    // return({title:syllabus.name,
    //             chapters: parsedChapters,
    //             books:parsedBooks
    // });


}


async function main() {
    const url = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2023/8293_120752_344/2019/8293/118?coorte=2023&schemaid=2753'

    const syllabus = await scrapeSyllabus(url)    



    

    const processedChapters = await processSyllabusChapters(syllabus)

    console.log(processedChapters?.chapters);

    const exam = {
        name: syllabus.name,
        chapters: processedChapters?.chapters
    }

    const fileName = `${syllabus.name.replace(/\s+/g, '_')}.json`;

    // Convert the exam object to a stringified JSON
    const jsonString = JSON.stringify(exam, null, 2);

    fs.writeFile(fileName, jsonString, (err) => {
        if (err) {
            console.error("Error writing file:", err);
        } else {
            console.log(`Exam details saved to ${fileName}`);
        }
    });

    

    
}

main()
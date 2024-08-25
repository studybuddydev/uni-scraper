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
            console.log('tagname', element.tagName);
            
            if (element.tagName === 'DT') {
                currentGroup.name = element.textContent!.trim();
            } else if (element.tagName === 'DD') {
                const item = element.textContent!.trim();
                
                
                const trimmedItem = item.trim();

                if (trimmedItem.includes('Contenuti')) {
                    console.log('contenuti', trimmedItem);
                    
                    currentGroup.chapters = trimmedItem//.split('-').map(chapter => chapter.trim()).filter(chapter => chapter !== '');
                } else if (trimmedItem.includes('Testi')) {
                    currentGroup.books = trimmedItem;
                } else if (trimmedItem.includes('Obiettivi formativi')) {
                    currentGroup.learningGoals = trimmedItem;
                } else if (trimmedItem.includes('Metodi didattici')) {
                    currentGroup.methods = trimmedItem;
                } else if (trimmedItem.includes('Verifica dell\'apprendimento')) {
                    currentGroup.examDetails = trimmedItem;
                } else if (trimmedItem.includes('Programma esteso')) {
                    // Append the item to the existing chapters
                    currentGroup.chapters = (currentGroup.chapters || '') + trimmedItem;
                } else {
                    // Handle any other cases if necessary
                }
            }
        }


        return currentGroup as CourseInfo;
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

    console.log(infoElements);
    


    infoElements.name = title;

    await browser.close();

    return infoElements;
}

export async function getSubdivisionUrls(url: string) {
    const browser = await puppeteer.launch({headless:true});
    const page: Page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' }); 
    await page.waitForSelector('app-root', { timeout: 5000 });
    


    const urls = await page.evaluate(() => {
        const selector = '#top > app-root > div > insegnamento > div.app-main > main > div.insegnamento > div:nth-child(4) > ul > li > a'
        const links =  Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
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

async function processAndSave(syllabus: CourseInfo) {

    const processedChapters: processedChapter = await processSyllabusChapters(syllabus)


    // Execute the regex against the syllabus name
    const id = syllabus.name.match(/\[(\w+)\]/)?.[1] || '';
    const name = syllabus.name.split(']').slice(1).join(']').replace(/[^\w\s]/g, ' ').trim();


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
}

// async function exploreSubdivision(url: string, page: Page): Promise<string[]> {
   
// }

async function getsyllabus(url: string) {

    let syllabus = await scrapeSyllabus(url)



    if (syllabus.chapters) {
        processAndSave(syllabus)
    }else{
        const urls = await getSubdivisionUrls(url)
        for(const url of urls){
            console.log(url);
            syllabus = await scrapeSyllabus(url)

               if (syllabus.chapters)
                    processAndSave(syllabus)
               else
                    console.log(syllabus);
                
        }
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


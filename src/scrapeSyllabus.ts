import fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer';
import OpenAI from "openai";
import 'dotenv/config'
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


async function getsubExams(page: Page): Promise<string[]> {
    let urls = await page.evaluate(() => {
        const links = document.querySelectorAll('dl dd a');
        return Array.from(links).map(link => (link as HTMLAnchorElement).href);
    });
    // keep only the ones that contain the word 'insegnamento'
    urls = urls.filter(url => url.includes('insegnamenti'));
    // console.log('urls', urls);

    return urls;
}

// async function getFraction(page: Page): Promise<string[]> {
//     const urls = await page.evaluate(() => {
//         const selector = '#top > app-root > div > insegnamento > div.app-main > main > div.insegnamento > div:nth-child(4) > ul > li > a'
//         const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
//         return links.map(link => link.href);
//     });


//     return urls;

// }

export async function getFraction(url: string, browser: Browser): Promise<string[]> {

    const browser1 = await puppeteer.launch({ headless: true });
    const page: Page = await browser1.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('app-root', { timeout: 5000 });


    const urls = await page.evaluate(() => {
        const selector = '#top > app-root > div > insegnamento > div.app-main > main > div.insegnamento > div:nth-child(4) > ul > li > a'
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
        return links.map(link => link.href);
    });


    //close browser
    await browser1.close();

    return urls
}


export async function getFinalUrls(url: string, browser: Browser): Promise<string[]> {
    //const browser = await puppeteer.launch({ headless: true });
    console.log('scraping', url);
    const page: Page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 5000 });
    await page.waitForSelector('app-root', { timeout: 5000 });
    await page.waitForSelector('.u-filetto');

    // Extract the title text
    const title = await page.$eval('.u-filetto', element => element.textContent?.trim() || 'no title found');
    console.log(`Title: ${title}`);

    await page.waitForSelector('.accordion');

    let allUrls: string[] = [];

    let subesami = await getsubExams(page);
    if (subesami.length == 0 ){
        subesami.push(url);
    }


    for (const subexam of subesami) {
        const url1 = await getFraction(subexam, browser);
        if (url1.length == 0) {
            allUrls.push(subexam);
        } 

        allUrls = allUrls.concat(url1);
    }



    return allUrls;
}



async function getNestedUrls() {
    const path = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/unibs_courses.json'
    const courseids = ['unibs54454', 'unibs54455', 'unibs05751', 'unibs05771', 'unibs05713', 'unibs05742']
    // a map of course id to urls
    const courseUrls: { [key: string]: string[] } = {};

    const browser = await puppeteer.launch({ headless: true });


    //for each course id 
    for (const courseid of courseids) {

        const uni = courseid.substring(0, 5);
        const courseid1 = courseid.substring(5, courseid.length);

        console.log('getting course', courseid);
        const jsonData = JSON.parse(fs.readFileSync(path, 'utf8'));
        const course: Course = jsonData.find((obj: Course) => obj.id === courseid); // Converts obj.id to string for comparison
        console.log(course.name + '=========================================================================');

        for (const exam of course.exams) {

            const subUrls = await getFinalUrls(exam.url, browser);

            console.log('subUrls', subUrls);

            courseUrls[exam.examId] = subUrls;

        }

        const data = JSON.stringify(courseUrls, null, 2);
        fs.writeFileSync(`./data/${uni}/${courseid}.json`, data);
    }

    console.log(courseUrls);


   

}


async function main() {

    const id = 'unibs08624' 
    const browser = await puppeteer.launch({ headless: true });


    // read id.json from data folder
    const path = `/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/${id}.json`
    const jsonData = JSON.parse(fs.readFileSync(path, 'utf8'));

    console.log(jsonData);

    for (const exam in jsonData) {
        console.log(exam);
        const urls = jsonData[exam];
       
        for (const url of urls) {


    }
    
}
}
getNestedUrls();

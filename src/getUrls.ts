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


async function getSubExams(url: string, browser: Browser): Promise<string[]> {
    const page: Page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.waitForSelector('app-root', { timeout: 5001 });

        await page.waitForSelector('.accordion');

        let urls = await page.evaluate(() => {
            const links = document.querySelectorAll('dl dd a');
            return Array.from(links).map(link => (link as HTMLAnchorElement).href);
        });

        urls = urls.filter(url => url.includes('insegnamenti'));
        return urls;
    } catch (error) {
        console.error(`Error in getSubExams: ${error}`);
        return [];
    } finally {
        await page.close();
    }
}

async function getFraction(url: string, browser: Browser): Promise<string[]> {
    const page: Page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.waitForSelector('app-root', { timeout: 5001 });

        await page.waitForSelector('.accordion');

        const urls = await page.evaluate(() => {
            const selector = '#top > app-root > div > insegnamento > div.app-main > main > div.insegnamento > div:nth-child(4) > ul > li > a';
            const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
            return links.map(link => link.href);
        });

        return urls;
    } catch (error) {
        console.error(`Error in getFraction: ${error}`);
        return [];
    } finally {
        await page.close();
    }
}

export async function getFinalUrls(url: string, browser: Browser): Promise<string[]> {
    console.log('scraping', url);
    let allUrls: string[] = [];

    try {
        let subExams = await getSubExams(url, browser);
        if (subExams.length === 0) {
            subExams.push(url);
        }

        for (const subExam of subExams) {
            const urls = await getFraction(subExam, browser);
            if (urls.length === 0) {
                allUrls.push(subExam);
            } else {
                allUrls = allUrls.concat(urls);
            }
        }
    } catch (error) {
        console.error(`Error in getFinalUrls: ${error}`);
    }

    return allUrls;
}



async function getNestedUrls(courseids: string[]) {
    //const path = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/unibs_courses.json'
    const path = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unitn/unitn_courses.json';

    // a map of course id to urls

    const browser = await puppeteer.launch({ headless: true });


    //for each course id 
    for (const courseid of courseids) {

        const uni = courseid.substring(0, 5);
        const courseid1 = courseid.substring(5, courseid.length);
        const courseUrls: { [key: string]: string[] } = {};

        const savepath = `./data/${uni}/courses/${courseid}.json`

        if (fs.existsSync(savepath)) {
            console.log('file already there', savepath);
            continue;
        }

        console.log('getting course', courseid);
        const jsonData = JSON.parse(fs.readFileSync(path, 'utf8'));
        const course: Course = jsonData.find((obj: Course) => obj.id === courseid); // Converts obj.id to string for comparison
        console.log(course.name + '=========================================================================');

        for (const exam of course.exams) {
            console.log( exam.url);
            
            try {
                const subUrls = await getFinalUrls(exam.url, browser);
                console.log('subUrls', subUrls);
                courseUrls[exam.examId] = subUrls;
            }
            catch (err) {
                console.log('error', err);
                console.log('error getting urls for', exam.url);
            }
        }

        const data = JSON.stringify(courseUrls, null, 2);
        fs.writeFileSync(savepath, data);
        console.log('saved', savepath);
    }

    await browser.close();

    return;


   

}



async function main() {
   // const coursepath = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/unibs_courses.json';
    const coursepath = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unitn/unitn_courses.json';

    const courses = JSON.parse(fs.readFileSync(coursepath, 'utf8'));

    const courseids = courses.map((course: Course) => course.id);

    //const courseids = ['unibs05724', 'unibs05731', 'unibs05742', 'unibs05743','unibs05751','unibs05771', 'unibs05831', 'unibs05851']

    console.log(courseids);

 
    await getNestedUrls(courseids);
    
   
}


main();
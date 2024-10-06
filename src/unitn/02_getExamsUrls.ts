import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';

const filePath = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unitn/coursesUrls.json';
const UNI = 'unitn'
const BASE_URL = `https://${UNI}.coursecatalogue.cineca.it`;
//map '2024/2025' -> 1, '2023/2024' -> 2, etc
const yearsMap = {
    '2024/2025': '1',
    '2023/2024': '2',
    '2022/2023': '3',
    // '2021/2022': '4',
    // '2020/2021': '5',
};


async function getExams() {
    const browser = await puppeteer.launch({ headless: true });

    const courseUrls = fs.readFileSync(filePath, 'utf8');
    const parsedCourseUrls = JSON.parse(courseUrls);

    const courseExams: { [course: string]: any[] } = {};

    for (const course in parsedCourseUrls) {
        if (parsedCourseUrls.hasOwnProperty(course)) {
            console.log(`Course: ${course}`);
            const years = parsedCourseUrls[course];
            const exams: any[] = [];
            for (const year in years) {
                if (year in yearsMap) {
                    console.log(`       Year: ${year}`);
                    const urls = years[year];
                    for (const url of urls) {
                        console.log(`           URL: ${url}`);
                        const examUrls = await getExamsUrls(browser, url, yearsMap[year as keyof typeof yearsMap]);
                        exams.push(...examUrls);
                    }
                }
            }
            courseExams[course] = exams;
        }
    }

    console.log(courseExams);
    fs.writeFileSync(path.join( 'data', 'unitn', 'examsUrls.json'), JSON.stringify(courseExams, null, 2));
    return courseExams;
    await browser.close();
}

// this takes a course url and returna an array of exam urls
async function getExamsUrls(browser: Browser, url: string, year: string): Promise<any[]> {
    console.log('Getting exams for', url, year);
    const page: Page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.waitForSelector('li[id="1"]');

        const exams = await page.evaluate((year, BASE_URL, UNI) => {
            console.log(`Evaluating page for year: ${year}`);
            const yearSelector = `li[id="${year}"]`;
            const yearElement = document.querySelector(yearSelector);
            if (!yearElement) {
                console.error(`Year element not found for year: ${year}`);
                return [];
            }

            const examElements = yearElement.querySelectorAll('card-insegnamento');
            console.log(`Found ${examElements.length} exam elements`);
            return Array.from(examElements).map((examElement) => {
                const nameElement = examElement.querySelector('a');
                const creditsElement = examElement.querySelector('.card-insegnamento-cfu');
                const hoursElement = examElement.querySelector('.card-insegnamento-ore');

                
                const id = nameElement?.textContent?.trim().match(/\[(\w+)\]/)?.[1] || '';
                const name = nameElement?.textContent?.trim().split(']').slice(1).join(']').replace(/\b(CORSO|DI|LAUREA|MAGISTRALE|A|CICLO|UNICO|TRIENNALE|IN)\b/gi, '').replace(/\s+/g, ' ').trim();

                return {
                    id: UNI + id,
                    name: name,
                    url: BASE_URL +nameElement?.getAttribute('href') || '#',
                    credits: creditsElement?.textContent?.trim() || 'N/A',
                    hours: hoursElement?.textContent?.trim() || 'N/A',
                    year: year,
                };
            });
        }, year, BASE_URL, UNI);

        return exams;
    } catch (error) {
        console.error('Error while scraping exams:', error);
        return [];
    } finally {
        await page.close();
    }
}


// this takes an exam url and returns the subexams














let exams = {}; ;
// if the file already exists, we don't need to scrape the urls again
if (!fs.existsSync(path.join('data', 'unitn', 'examsUrls.json'))) {
    exams = getExams()
}else 
{
    exams = JSON.parse(fs.readFileSync(path.join('data', 'unitn', 'examsUrls.json'), 'utf8'));
}


console.log(exams);






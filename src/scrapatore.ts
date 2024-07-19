import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import { cleanAllDegrees } from './clean';

import { BASE_URL } from './constants';

console.log(BASE_URL);


// scrape degrees url 
function extractDegreeUrls(): Promise<string[]> {
    return new Promise((resolve) => {
        const urls: string[] = [];
        const degreeElements = document.querySelectorAll('.corsi-leaf a');

        degreeElements.forEach((element) => {
            const url = element.getAttribute('href');
            if (url) {
                urls.push(url);
            }
        });

        resolve(urls);
    });
}

// getSelectedText.js
export async function getSelectedText(page: Page) {
    return await page.evaluate(() => {
        const selectElement = document.querySelector('#offerta-formativa') as HTMLSelectElement;
        if (selectElement) {
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            return selectedOption ? selectedOption.text : 'No option selected';
        }
        return 'Select element not found';
    });
}

// getLinkHrefModule.js
export async function getLinkHref(page: Page) {
    return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).find(a => {
            const text = a.textContent?.trim().toLowerCase();
            return text === 'piani di studio e insegnamenti' || text === 'insegnamenti';
        })?.href;
    });
}

async function scrapeDegrees(page: Page, degree_url: string) {

    console.log('getting all degrees urls');


    let degreeUrls: string[] = []
    try {
        // Navigate to the target page
        await page.goto(degree_url, { waitUntil: 'networkidle0' });
        await page.waitForSelector('.corsi-group');
        degreeUrls = await page.evaluate(extractDegreeUrls); // get all degree urls
        degreeUrls = degreeUrls.map(url => `${BASE_URL}${url}`);

    } catch (e) {
        console.log('rotto');
        degreeUrls = []

    }
    return degreeUrls
}

async function getDegreeTitle(page: Page) {
    let pageTitle
    try {
        await page.waitForSelector('h1.corso-title.u-filetto');
        pageTitle = await page.evaluate(() => {
            return document.querySelector('h1.corso-title.u-filetto')?.textContent?.trim() || '';
        });
    }
    catch (e) {
        pageTitle = 'not found'
    }
    return pageTitle
}
interface ResultsType {
    [key: string]: string[];
}


// gets in input a list of degree urls and return an obect where for each degree and each year we have the url of the list of exams
async function getExamListFromDegree(page: Page, urls: string[]) {

    const res: { [key: string]: ResultsType } = {}

    //iterate over all degrees
    for (const url of urls) {
        console.log(url);


        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.waitForSelector('a');
        await new Promise((res) => setTimeout(res, 3000));

        // get degree name
        let pageTitle = await getDegreeTitle(page)
        let results: ResultsType = {};


        //get url of list of exams for each year 
        const selectionValues = ['0: Object', '1: Object', '2: Object', '3: Object','4: Object']; // year selection 2024/2025 is 0 

        for (let i = 0; i < selectionValues.length; i++) {
            const value = selectionValues[i];
            await page.select('#offerta-formativa', value);
            await new Promise((res) => setTimeout(res, 1000));

            const selectedText = await getSelectedText(page)        // Retrieve the select uear
            const linkHref = await getLinkHref(page)                // Find the link corresponding to "piani di studio e insegnamenti" or "insegnamenti"

            if (pageTitle) {
                if (!results[selectedText]) {
                    results[selectedText] = [];
                }
                results[selectedText].push(linkHref || '');

                if (linkHref?.endsWith('insegnamenti')) {
                    results[selectedText] = await selectCareer(linkHref)
                }
            }


        }


        res[pageTitle] = results
    }


    return res
}


async function selectCareer(url: string): Promise<string[]> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    //const BASE_URL = 'https://unibs.coursecatalogue.cineca.it'

    await page.goto(url, { waitUntil: 'networkidle0' });

    const result = await page.evaluate((baseUrl) => {
        const textUrlPairs: { [key: string]: string } = {};
        const links = document.querySelectorAll('ul li a');
        const urls: string[] = [];

        links.forEach((link) => {
            const text = link.textContent?.trim() || '';
            const url = link.getAttribute('href') || '';
            if (url.includes('schemaid')) {
                textUrlPairs[text] = url;
                urls.push(baseUrl + url); // Use baseUrl here instead of BASE_URL
            }
        });

        return urls;
    }, BASE_URL);

    await browser.close();
    return result;
}

async function fetchYearlyExams(page: Page, urls: string[], year: number): Promise<any[]> {
    const browser = await puppeteer.launch({ headless: true });
    const page1 = await browser.newPage();
    const exams = []
    
    if(!urls){
        urls = []
        console.log('rotto');
    }
    

    for (const url of urls) {

        try {
            await page1.goto(url, { waitUntil: 'networkidle0' });
            console.log(url);


            const tmpExams = await page1.evaluate((baseUrl, year) => {
                const exams: { title: string, href: string, cfu: string, hours: string, semester: string, annoDiOfferta: string, year: number }[] = [];
                const firstYearSection = document.querySelector(`li[id="${year}"]`);

                if (firstYearSection) {
                    const examCards = firstYearSection.querySelectorAll('card-insegnamento');

                    examCards.forEach(card => {
                        const titleElement = card.querySelector('.card-insegnamento-header span');
                        const hrefElement = card.querySelector('.card-insegnamento-header a');
                        const cfuElement = card.querySelector('.card-insegnamento-cfu');
                        const hoursElement = card.querySelector('.card-insegnamento-ore');
                        const semesterElement = card.querySelector('.card-insegnamento-footer2 span');
                        const annoDiOffertaElement = card.querySelector('div.card-insegnamento-footer > div:nth-child(1)');

                        console.log(titleElement?.textContent);

                        if (titleElement && hrefElement && cfuElement && hoursElement && semesterElement) {
                            exams.push({
                                title: titleElement.textContent?.trim() || '',
                                href: baseUrl + hrefElement.getAttribute('href') || '',
                                cfu: cfuElement.textContent?.trim() || '',
                                hours: hoursElement.textContent?.trim() || '',
                                semester: semesterElement.textContent?.trim() || '',
                                annoDiOfferta: annoDiOffertaElement?.textContent?.trim() || '',
                                year: year
                            });
                        }
                    });
                }



                return exams;
            }, BASE_URL, year);

            exams.push(...tmpExams)
        } catch (e) {
            console.log('rotto');

        }


    }

    await browser.close();

    return exams

}

async function getExamsDetails(page: Page, years: { [key: string]: string[] }) {

    // Extract URLs for different years
    const firstYearUrl = years['2023/2024'];
    const secondYearUrl = years['2022/2023'];
    const thirdYearUrl = years['2021/2022'];
    const fourthYearUrl = years['2020/2021'];
    const fifthYearUrl = years['2019/2020'];

    const firstYearExams = await fetchYearlyExams(page, firstYearUrl, 1);
    const secondYearExams = await fetchYearlyExams(page, secondYearUrl, 2);
    const thirdYearExams = await fetchYearlyExams(page, thirdYearUrl, 3);
    const fourthYearExams = await fetchYearlyExams(page, fourthYearUrl, 4);
    const fifthYearExams = await fetchYearlyExams(page, fifthYearUrl, 5);
    const sixthYearExams = await fetchYearlyExams(page, fifthYearUrl, 6);

    // Combine all exams
    const allExams = [...firstYearExams, ...secondYearExams, ...thirdYearExams, ...fourthYearExams, ...fifthYearExams, ...sixthYearExams];

    console.log(allExams);

    return allExams;
}



async function main() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

   // const title = 'triennaliUNIBS'
    const unibsTriennaliURL = 'https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1617109934164'

    const unibsMagistraliURL ='https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1617109934165'
    const title = 'cicloUnicoUNIBS'

    const unibsCicloUnicoURL = 'https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1619785172027'




    let degreesUrls = await scrapeDegrees(page, unibsCicloUnicoURL)
    let insegnamentiUrls = await getExamListFromDegree(page, degreesUrls)



    const examByDegree: { [key: string]: string[] } = {}

    const courseEntries = Object.entries(insegnamentiUrls);

    for (const [courseCode, years] of courseEntries) {
        console.log(`Course Code: ${courseCode}`);
        const exams = await getExamsDetails(page, years);
        examByDegree[courseCode] = exams

    }

    fs.writeFileSync('./data/' + title + '.json', JSON.stringify(examByDegree, null, 2));

    await browser.close();




}

main()

import puppeteer, { Page } from 'puppeteer';
import fs from 'fs';

import { info } from 'console'
//const url = "https://unitn.coursecatalogue.cineca.it/insegnamenti/2023/87758/2008/10003/10114?coorte=2023"

export interface CourseInfo {
    name: string;
    chapters: string[];
    books: string;
    examDetails: string;
    learningGoals: string;
    methods: string;
}






export async function getSyllabusExams() {

    const urlEsami = 'https://unitn.coursecatalogue.cineca.it/corsi/2023/10114/insegnamenti/9999'
    const ingeunibs = 'https://unibs.coursecatalogue.cineca.it/corsi/2024/89/insegnamenti/8587'
    const browser = await puppeteer.launch({ dumpio: true });
    const page: Page = await browser.newPage();
    await page.goto(ingeunibs, { waitUntil: 'networkidle0' }); // Replace with your target web app URL

    await page.waitForSelector('app-root', { timeout: 5000 });

    //print page content 
    const content = await page.content()

    await page.waitForSelector('card-insegnamento'); // Wait for the presence of the exam cards

    // Extract exam information
    const exams = await page.evaluate(() => {

        try {
            const examElements = Array.from(document.querySelectorAll('card-insegnamento'));

            return examElements.map(examElement => {
                const nameElement = examElement.querySelector('.card-insegnamento-header');
                const creditsElement = examElement.querySelector('.card-insegnamento-footer .card-insegnamento-cfu');
                const hoursElement = examElement.querySelector('.card-insegnamento-footer .card-insegnamento-ore');
                const urlElement = examElement.querySelector('.card-insegnamento-header a')?.getAttribute('href');

                // Check if elements are not null before accessing properties
                const name = nameElement ? nameElement.textContent?.trim() : '';
                const credits = creditsElement ? creditsElement.textContent?.trim() : '';
                const hours = hoursElement ? hoursElement.textContent?.trim() : '';
                const url = urlEsami + urlElement ? urlElement : '';

                return {
                    name,
                    credits,
                    hours,
                    url
                };

            });
        } catch {
            console.log('card rotto')
        }

    });

    // Print exam information
    exams?.forEach(exam => {
        console.log("Name:", exam.name);
        console.log("Credits:", exam.credits);
        console.log("Hours:", urlEsami + exam.url);
        console.log();
    });

    return exams


}




// get url of a syllabus from unitn course catalogue and scrape it 
export async function scrapeSyllabus(url: string): Promise<void> {
    const browser = await puppeteer.launch({ dumpio: true });
    const page: Page = await browser.newPage();
    //const url = ctx.message?.text as string
    await page.goto(url, { waitUntil: 'networkidle0' }); // Replace with your target web app URL

    await page.waitForSelector('app-root', { timeout: 5000 });


    await page.waitForSelector('.u-filetto');
    // Extract the title text
    const title = await page.$eval('.u-filetto', element => element.textContent);


    console.log(`Title: ${title}`);

    await page.waitForSelector('.accordion');
    let infoElements: CourseInfo = { name: '', chapters: [], books: '', examDetails: '', learningGoals: '', methods: '' };

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
                        currentGroup.chapters = [item]//.split('-').map(chapter => chapter.trim()).filter(chapter => chapter !== '');
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
                    default:
                        break;
                }
            }
        }


        return currentGroup as CourseInfo;
    });

    infoElements.name = title?.trim() || 'no title found';

    console.log('Information:', infoElements);

    console.log(infoElements)

    //save to a json file 



    await browser.close();

    console.log(infoElements)





    //ctx.replyWithDocument(inputfile)



}



async function scrapeExams() {
    // Launch Puppeteer
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Load the page
    const url = 'https://unibs.coursecatalogue.cineca.it/corsi/2024/89/insegnamenti/8587';
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Define selectors
    const yearSelector = 'h2.u-titoletto.u-color-links.u-font-text';
    const examListSelector = 'ul';
    const examItemSelector = 'li';

    // Extract the exam information grouped by year
    const examsByYear = await page.evaluate((yearSel, examListSel, examItemSel) => {
        const years = Array.from(document.querySelectorAll(yearSel));
        const data = [] as any;

        years.forEach((yearElement) => {
            const yearText = yearElement.textContent?.trim() || '';
            let examListElement = yearElement.nextElementSibling;

            while (examListElement && !examListElement.matches(examListSel)) {
                examListElement = examListElement.nextElementSibling;
            }

            if (examListElement) {
                const examElements = Array.from(examListElement.querySelectorAll(examItemSel));
                const exams = examElements.map((examElement) => {
                    const titleElement = examElement.querySelector('h4.card-insegnamento-header > div > a > span');
                    const cfuElement = examElement.querySelector('.card-insegnamento-cfu');
                    const hoursElement = examElement.querySelector('.card-insegnamento-ore');
                    const semesterElement = examElement.querySelector('.card-insegnamento-footer2 > div > span');

                    return {
                        title: titleElement?.textContent?.trim() || '',
                        cfu: cfuElement?.textContent?.trim() || '',
                        hours: hoursElement?.textContent?.trim() || '',
                        semester: semesterElement?.textContent?.trim() || '',
                    };
                });

                data.push({
                    year: yearText,
                    exams: exams,
                });
            }
        });

        return data;
    }, yearSelector, examListSelector, examItemSelector);

    // Save exams data to a JSON file
    fs.writeFileSync('exams.json', JSON.stringify(examsByYear, null, 2), 'utf-8');

    console.log('Exams data saved to exams.json');

    // Close Puppeteer
    await browser.close();
}





async function scrapeDegrees() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const degrees = [];


    const degree_url = 'https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1617109934164'

    try {
        // Navigate to the target page
        await page.goto(degree_url, { waitUntil: 'networkidle0' });

        // Wait for the element to be visible (optional, adjust as needed)
        await page.waitForSelector('.corsi-group');


        //get all the degree utls
        const degreeUrls: string[] = await page.evaluate(() => {
            const urls: string[] = [];
            const degreeElements = document.querySelectorAll('.corsi-leaf a');

            degreeElements.forEach((element) => {
                const url = element.getAttribute('href');
                if (url) {
                    urls.push(url);
                }
            });

            return urls;
        });

        //for each degree
        for (let url of degreeUrls) {
            // Construct the full URL if necessary
            const fullUrl = 'https://unibs.coursecatalogue.cineca.it' + url; // Replace YOUR_BASE_URL with actual base URL
            console.log(fullUrl)

            // Navigate to the degree page
            await page.goto(fullUrl, { waitUntil: 'networkidle0' });

            await page.waitForSelector('a');

            await new Promise((res) => setTimeout(res, 3000))

                  // Wait for the specific element to be present
            await page.waitForSelector('h1.corso-title.u-filetto');

            // Extract the page title from the specific h1 element
            const pageTitle = await page.evaluate(() => {
                return document.querySelector('h1.corso-title.u-filetto')?.textContent?.trim();
            });
            console.log(pageTitle)

            

            // go in the list of exams 
            const linkHref = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a')).find(a => a.textContent?.trim() === 'Piani di studio e Insegnamenti')?.href
            });

            await page.goto(linkHref || '', { waitUntil: 'networkidle0' })

            // Define selectors
            const yearSelector = 'h2.u-titoletto.u-color-links.u-font-text';
            const examListSelector = 'ul';
            const examItemSelector = 'li';

            // Extract the exam information grouped by year
            const examsByYear = await page.evaluate((yearSel, examListSel, examItemSel) => {
                const years = Array.from(document.querySelectorAll(yearSel));
                const data = [] as any;

                years.forEach((yearElement) => {
                    const yearText = yearElement.textContent?.trim() || '';
                    let examListElement = yearElement.nextElementSibling;

                    while (examListElement && !examListElement.matches(examListSel)) {
                        examListElement = examListElement.nextElementSibling;
                    }

                    if (examListElement) {
                        const examElements = Array.from(examListElement.querySelectorAll(examItemSel));
                        const exams = examElements.map((examElement) => {
                            const titleElement = examElement.querySelector('h4.card-insegnamento-header > div > a > span');
                            const cfuElement = examElement.querySelector('.card-insegnamento-cfu');
                            const hoursElement = examElement.querySelector('.card-insegnamento-ore');
                            const semesterElement = examElement.querySelector('.card-insegnamento-footer2 > div > span');

                            return {
                                title: titleElement?.textContent?.trim() || '',
                                cfu: cfuElement?.textContent?.trim() || '',
                                hours: hoursElement?.textContent?.trim() || '',
                                semester: semesterElement?.textContent?.trim() || '',
                            };
                        });

                        data.push({
                            year: yearText,
                            exams: exams,
                        });
                    }
                });

                return data;
            }, yearSelector, examListSelector, examItemSelector);

            degrees.push({
                title: pageTitle,
                examsByYear: examsByYear,
            });

            


        }
        


    fs.writeFileSync('degrees.json', JSON.stringify(degrees, null, 2));



    } catch (error) {
        console.error('Error scraping degrees:', error);
    } finally {
        // Close the browser
        await browser.close();
    }
}










async function main() {

    scrapeDegrees().catch(console.error);


    console.log('aspettiamo gli esami')

}

main()
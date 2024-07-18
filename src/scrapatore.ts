import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import { cleanAllDegrees } from './clean';


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


async function scrapeDegrees(degree_url: string) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const BASE_URL = 'https://unibs.coursecatalogue.cineca.it'

    
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



async function main(){

    const unibsTriennaliURL = 'https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1617109934164'


    let degreesUrls = await scrapeDegrees(unibsTriennaliURL)

    


    console.log(degreesUrls);
    
}

main()
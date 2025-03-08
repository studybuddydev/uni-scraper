import puppeteer, { Page } from 'puppeteer';


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


}


async function getsyllabus() {

    const url  = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2023/8249_122421_8338/2022/8251/81?coorte=2023&schemaid=2493'





}

getsyllabus()
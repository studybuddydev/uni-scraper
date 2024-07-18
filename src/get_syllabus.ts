import puppeteer, { Page } from 'puppeteer';

export interface CourseInfo {
    name: string;
    chapters: string[];
    books: string;
    examDetails: string;
    learningGoals: string;
    methods: string;
}


// get url of a syllabus from unitn course catalogue and scrape it 
export async function scrapeSyllabus(url: string): Promise<void> {
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

   // infoElements.name = title?.trim() || 'no title found';

    console.log('Information:', infoElements);

    console.log(infoElements)

    //save to a json file 



    await browser.close();

   //const processedSyllabus = await processSyllabus(infoElements)
   //const inputfile: InputFile = new InputFile(Buffer.from(JSON.stringify(processedSyllabus, null, 2)), processedSyllabus?.name + '.json')

    // const fs = require('fs');
    // fs.writeFileSync('esame.json', JSON.stringify(infoElements, null, 2));





    //ctx.replyWithDocument(inputfile)



}

async function main(){
    const url = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2024/8544_129006_23355/2019/8544/117?coorte=2024&schemaid=2730'

    scrapeSyllabus(url)

}

main()
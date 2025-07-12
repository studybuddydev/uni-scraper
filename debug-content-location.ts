import puppeteer from 'puppeteer';

async function findPotentialContent(page: any) {
  return await page.evaluate(() => {
    const result: any[] = [];
    
    // Look for various content keywords in the page
    const contentKeywords = [
      'obiettivi', 'goals', 'programma', 'contenuti', 'chapters',
      'bibliografia', 'testi', 'books', 'prerequisiti', 'requirements',
      'metodi didattici', 'teaching', 'modalità esame', 'assessment'
    ];
    
    const allElements = document.querySelectorAll('*');
    
    for (const element of allElements) {
      const text = element.textContent?.toLowerCase() || '';
      const tagName = element.tagName.toLowerCase();
      
      for (const keyword of contentKeywords) {
        if (text.includes(keyword) && text.length > keyword.length + 10) {
          result.push({
            keyword,
            tagName,
            text: text.substring(0, 200),
            hasNext: !!element.nextElementSibling,
            nextText: element.nextElementSibling?.textContent?.substring(0, 200) || ''
          });
        }
      }
    }
    
    return result;
  });
}

async function testContentLocation() {
  console.log('🔍 Testing where content is located...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null 
  });
  
  const page = await browser.newPage();
  
  try {
    const testUrl = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2025/8785_139960_2223/2025/8899/1498?coorte=2025&schemaid=3278';
    
    console.log('📄 1. Checking MAIN PAGE for content...');
    await page.goto(testUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mainPageContent = await findPotentialContent(page);
    console.log('📝 Main page content sections found:', mainPageContent.length);
    mainPageContent.forEach((section, i) => {
      console.log(`  ${i+1}. [${section.tagName}] ${section.keyword}: ${section.text.substring(0, 100)}...`);
      if (section.hasNext && section.nextText) {
        console.log(`     → Next: ${section.nextText.substring(0, 100)}...`);
      }
    });
    
    // Check for fractions
    const fractions = await page.evaluate(() => {
      const fractionLinks = Array.from(document.querySelectorAll('a[href*="adCodFraz"]'));
      return fractionLinks.map(link => ({
        name: (link as HTMLElement).textContent?.trim() || '',
        url: (link as HTMLAnchorElement).href
      }));
    });
    
    if (fractions.length > 0) {
      console.log('\n📄 2. Checking FRACTION PAGE for content...');
      const firstFraction = fractions[0];
      console.log(`📖 Testing fraction: ${firstFraction.name}`);
      
      await page.goto(firstFraction.url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const fractionContent = await findPotentialContent(page);
      console.log('📝 Fraction page content sections found:', fractionContent.length);
      fractionContent.forEach((section, i) => {
        console.log(`  ${i+1}. [${section.tagName}] ${section.keyword}: ${section.text.substring(0, 100)}...`);
        if (section.hasNext && section.nextText) {
          console.log(`     → Next: ${section.nextText.substring(0, 100)}...`);
        }
      });
    }
    
    console.log('\n✅ Analysis complete! Press any key to close...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve(undefined));
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testContentLocation();

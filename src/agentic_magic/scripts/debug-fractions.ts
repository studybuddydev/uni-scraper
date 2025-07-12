import puppeteer from 'puppeteer';

async function testFractionDetection() {
  console.log('🔍 Testing fraction detection...');
  
  const browser = await puppeteer.launch({ headless: false }); // Run in visible mode to see what happens
  const page = await browser.newPage();
  
  try {
    const testUrl = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2025/8785_139960_2223/2025/8899/1498?coorte=2025&schemaid=3278';
    console.log('📄 Navigating to:', testUrl);
    
    await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for fractions
    const fractions = await page.evaluate(() => {
      const fractionLinks = document.querySelectorAll('.insegnamento-links a');
      const results: Array<{name: string, url: string}> = [];
      
      for (const link of fractionLinks) {
        const name = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        const fullUrl = href.startsWith('http') ? href : `https://unibs.coursecatalogue.cineca.it${href}`;
        
        results.push({ name, url: fullUrl });
      }
      
      return results;
    });
    
    console.log('🎯 Found fractions:', fractions);
    
    if (fractions.length > 0) {
      console.log('✅ Fractions detected! Testing first fraction...');
      
      // Test navigating to first fraction
      const firstFraction = fractions[0];
      console.log('📖 Navigating to fraction:', firstFraction.name, firstFraction.url);
      
      await page.goto(firstFraction.url, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract content from fraction page
      const content = await page.evaluate(() => {
        const result: any = {};
        
        // Look for content sections
        const sections = document.querySelectorAll('dt, h2, h3, h4, .section-title');
        
        for (const section of sections) {
          const text = section.textContent?.toLowerCase() || '';
          
          if (text.includes('obiettivi formativi')) {
            const nextElement = section.nextElementSibling;
            if (nextElement) {
              result.goals = nextElement.textContent?.trim() || '';
            }
          }
          
          if (text.includes('contenuti') || text.includes('programma')) {
            const nextElement = section.nextElementSibling;
            if (nextElement) {
              result.chapters = nextElement.textContent?.trim() || '';
            }
          }
          
          if (text.includes('testi') || text.includes('bibliografia')) {
            const nextElement = section.nextElementSibling;
            if (nextElement) {
              result.books = nextElement.textContent?.trim() || '';
            }
          }
        }
        
        return result;
      });
      
      console.log('📚 Extracted content:', content);
      
    } else {
      console.log('❌ No fractions found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testFractionDetection();

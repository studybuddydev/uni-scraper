import puppeteer from 'puppeteer';

async function debugFractionContent() {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate directly to a fraction URL
    const fractionUrl = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2025/11013-A-L/2025/8899/1498?coorte=2025&schemaid=3278&adCodFraz=11013';
    
    console.log(`📖 Navigating directly to fraction: ${fractionUrl}`);
    await page.goto(fractionUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Analyze the page structure
    const pageAnalysis = await page.evaluate(() => {
      const result: any = {
        title: document.title,
        allDTs: [],
        allDDs: [],
        allHeadings: [],
        potentialContent: []
      };
      
      // Find all dt elements (definition terms)
      const dts = document.querySelectorAll('dt');
      result.allDTs = Array.from(dts).map(dt => dt.textContent?.trim()).filter(t => t);
      
      // Find all dd elements (definition descriptions)
      const dds = document.querySelectorAll('dd');
      result.allDDs = Array.from(dds).map(dd => dd.textContent?.trim().substring(0, 200)).filter(t => t);
      
      // Find all headings
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      result.allHeadings = Array.from(headings).map(h => h.textContent?.trim()).filter(t => t);
      
      // Look for specific content patterns
      const keywords = ['obiettivi', 'contenuti', 'testi', 'prerequisiti', 'metodi', 'valutazione'];
      
      for (const keyword of keywords) {
        // Check in dt-dd pairs
        for (let i = 0; i < dts.length; i++) {
          const dt = dts[i];
          const dtText = dt.textContent?.toLowerCase() || '';
          if (dtText.includes(keyword)) {
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName === 'DD') {
              result.potentialContent.push({
                keyword: keyword,
                title: dt.textContent?.trim(),
                content: dd.textContent?.trim().substring(0, 300)
              });
            }
          }
        }
      }
      
      return result;
    });
    
    console.log('📄 Page title:', pageAnalysis.title);
    console.log('📋 All DT elements:', pageAnalysis.allDTs);
    console.log('📝 All DD elements (first 200 chars):', pageAnalysis.allDDs.slice(0, 5));
    console.log('🔍 Potential content found:', pageAnalysis.potentialContent);
    
    // Wait for user to inspect
    console.log('🔍 Browser is open - inspect the page and press any key to continue...');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Don't close immediately so we can inspect
    setTimeout(async () => {
      await browser.close();
    }, 30000); // Close after 30 seconds
  }
}

debugFractionContent();

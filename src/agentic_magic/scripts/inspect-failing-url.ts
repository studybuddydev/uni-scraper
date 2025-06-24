#!/usr/bin/env node

import puppeteer from 'puppeteer';

async function inspectFailingURL() {
  try {
    console.log('=== Inspecting Failing URL ===');
    
    // One of the failing URLs from GIURISPRUDENZA
    const url = 'https://unibs.coursecatalogue.cineca.it/corsi/2021/112/insegnamenti/7548?codicione=0170107051400001';
    
    console.log(`Inspecting URL: ${url}`);
    
    const browser = await puppeteer.launch({ 
      headless: false, // Show browser to see what happens
      defaultViewport: { width: 1920, height: 1080 } 
    });
    
    const page = await browser.newPage();
    
    // Log all console messages
    page.on('console', (msg) => {
      console.log(`[PAGE ${msg.type()}]: ${msg.text()}`);
    });
    
    page.on('pageerror', (error) => {
      console.log(`[PAGE ERROR]: ${error.message}`);
    });
    
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    console.log(`Page title: ${await page.title()}`);
    
    // Check if the expected elements exist
    const yearSections = await page.$$('.corso-insegnamenti-list > ul > li');
    console.log(`Found ${yearSections.length} year sections`);
    
    const examCards = await page.$$('card-insegnamento');
    console.log(`Found ${examCards.length} exam cards`);
    
    // Try different selectors to see what's on the page
    const alternativeSelectors = [
      '.corso-insegnamenti-list',
      '.corso-insegnamenti',
      'ul > li',
      'card-insegnamento',
      '.insegnamento',
      '.exam',
      '.course'
    ];
    
    for (const selector of alternativeSelectors) {
      const elements = await page.$$(selector);
      console.log(`Selector "${selector}": ${elements.length} elements`);
    }
    
    // Get a snippet of the page HTML to see the structure
    const bodyHTML = await page.evaluate(() => {
      return document.body.innerHTML.substring(0, 2000);
    });
    
    console.log('\nPage HTML snippet:');
    console.log(bodyHTML);
    console.log('\n--- End HTML snippet ---');
    
    // Wait a bit to see the page
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await browser.close();
    
  } catch (error) {
    console.error('✗ Inspection failed:', error);
  }
}

inspectFailingURL();

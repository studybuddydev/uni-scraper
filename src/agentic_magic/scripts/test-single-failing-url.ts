#!/usr/bin/env node

import path from 'path';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import { ExamExtractorNew } from '../core/ExamExtractorNew';
import fs from 'fs';

async function testSingleFailingURL() {
  try {
    console.log('=== Testing Single Failing URL ===');
    
    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = configManager.loadConfig();
    
    // Initialize utilities
    const sessionId = `test-single-${Date.now()}`;
    const logger = new Logger(config.output.logsDir, sessionId);
    const progressTracker = new ProgressTracker();
    
    // Create exam extractor
    const examExtractor = new ExamExtractorNew(config, logger, progressTracker, sessionId);
    
    // Initialize browser manually for direct testing
    await (examExtractor as any).initializeBrowser();
    
    // Test a specific failing URL - let's use the existing working data
    const structuredDataPath = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs-ciclounico/11-courses-unibs-ciclounico.json';
    
    if (!fs.existsSync(structuredDataPath)) {
      console.error('Structured course data not found at:', structuredDataPath);
      process.exit(1);
    }
    
    const courseData = JSON.parse(fs.readFileSync(structuredDataPath, 'utf8'));
    
    // Find the failing GIURISPRUDENZA course
    const giurisprudenzaCourse = Object.keys(courseData.pathsyears).find(name => 
      name.includes('GIURISPRUDENZA')
    );
    
    if (!giurisprudenzaCourse) {
      console.error('GIURISPRUDENZA course not found in data');
      process.exit(1);
    }
    
    console.log(`Testing course: ${giurisprudenzaCourse}`);
    
    const pathData = courseData.pathsyears[giurisprudenzaCourse];
    const pathName = Object.keys(pathData)[0]; // Get first path
    const yearData = pathData[pathName];
    
    console.log(`Available years: ${Object.keys(yearData).join(', ')}`);
    
    // Test a few specific years that were failing
    const testYears = ['2021/2022', '2020/2021', '2019/2020'];
    
    for (const year of testYears) {
      if (yearData[year]) {
        const url = yearData[year];
        console.log(`\n--- Testing ${year} ---`);
        console.log(`URL: ${url}`);
        
        try {
          const result = await (examExtractor as any).extractExamsFromUrl(url);
          console.log(`✓ Success: Found ${Object.keys(result).length} year sections`);
          
          for (const [yearKey, exams] of Object.entries(result)) {
            console.log(`  Year "${yearKey}": ${(exams as any[]).length} exams`);
          }
        } catch (error) {
          console.error(`✗ Failed for ${year}:`, error);
        }
      }
    }
    
    // Cleanup
    await (examExtractor as any).cleanup();
    
  } catch (error) {
    console.error('✗ Test failed with exception:', error);
    process.exit(1);
  }
}

testSingleFailingURL();

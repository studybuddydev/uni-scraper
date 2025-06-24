#!/usr/bin/env node

import path from 'path';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import { CourseDataProcessor } from '../core/CourseDataProcessor';

async function testCourseProcessing() {
  try {
    console.log('=== Testing Course Data Processing ===');
    
    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = configManager.loadConfig();
    
    console.log(`Using university: ${config.university.name}`);
    
    // Initialize utilities
    const sessionId = `test-processing-${Date.now()}`;
    const logger = new Logger(config.output.logsDir, sessionId);
    
    // Find the latest raw course data file
    const rawDataPath = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/agentic-2025-06-24T14-35-11/agentic-2025-06-24T14-35-11-courses.json';
    
    console.log(`Processing raw course data from: ${rawDataPath}`);
    
    // Process the course data
    const courseProcessor = new CourseDataProcessor(config, logger);
    const processedData = courseProcessor.processRawCourseData(rawDataPath, sessionId);
    
    console.log(`✓ SUCCESS: Processed course data`);
    console.log(`  - Courses: ${Object.keys(processedData.courses).length}`);
    
    let totalPathYears = 0;
    for (const courseName in processedData.pathsyears) {
      for (const pathName in processedData.pathsyears[courseName]) {
        totalPathYears += Object.keys(processedData.pathsyears[courseName][pathName]).length;
      }
    }
    console.log(`  - Course/path/year combinations: ${totalPathYears}`);
    
    // Show some examples
    const firstCourses = Object.keys(processedData.courses).slice(0, 3);
    console.log('\nFirst 3 courses:');
    firstCourses.forEach((courseName, index) => {
      console.log(`${index + 1}. ${courseName}`);
      console.log(`   URL: ${processedData.courses[courseName]}`);
      
      if (processedData.pathsyears[courseName]) {
        const paths = Object.keys(processedData.pathsyears[courseName]);
        console.log(`   Paths: ${paths.join(', ')}`);
        
        if (paths.length > 0) {
          const years = Object.keys(processedData.pathsyears[courseName][paths[0]]);
          console.log(`   Years: ${years.join(', ')}`);
        }
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

testCourseProcessing();

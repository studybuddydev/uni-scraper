#!/usr/bin/env node

import path from 'path';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import { ExamExtractorNew } from '../core/ExamExtractorNew';

async function testExamExtraction() {
  try {
    console.log('=== Testing Exam Extraction ===');
    
    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = configManager.loadConfig();
    
    console.log(`Using university: ${config.university.name}`);
    console.log(`Expected course file: data/${config.university.name}/11-courses-${config.university.name}.json`);
    
    // Initialize utilities
    const sessionId = `test-exams-${Date.now()}`;
    const logger = new Logger(config.output.logsDir, sessionId);
    const progressTracker = new ProgressTracker();
    
    logger.info('Starting exam extraction test');
    
    // Create exam extractor
    const examExtractor = new ExamExtractorNew(config, logger, progressTracker);
    
    // Extract exams
    console.log('Starting exam extraction...');
    const result = await examExtractor.extractExamsFromCourseData();
    
    if (result.success) {
      const examCount = result.data!.length;
      console.log(`✓ SUCCESS: Found ${examCount} exams`);
      logger.info(`✓ Exam extraction successful! Found ${examCount} exams`);
      
      if (examCount > 0) {
        // Show first few exams as examples
        const firstExams = result.data!.slice(0, 3);
        console.log('\nFirst 3 exams:');
        firstExams.forEach((exam, index) => {
          console.log(`${index + 1}. [${exam.id}] ${exam.name}`);
          console.log(`   Course: ${exam.courseName} (${exam.courseId})`);
          console.log(`   URL: ${exam.url}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No exams found - this indicates an issue with the extraction logic');
      }
    } else {
      console.error('✗ FAILED: Exam extraction failed');
      console.error('Error:', result.error?.message);
      console.error('Stack:', result.error?.stack);
      logger.error('✗ Exam extraction failed', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('✗ Test failed with exception:', error);
    process.exit(1);
  }
}

testExamExtraction();

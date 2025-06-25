#!/usr/bin/env node

import path from 'path';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import { ExamExtractorNew } from '../core/ExamExtractorNew';

async function testExamExtraction() {
  try {
    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = configManager.loadConfig();
    
    // Initialize utilities
    const sessionId = `test-${Date.now()}`;
    const logger = new Logger(config.output.logsDir, sessionId);
    const progressTracker = new ProgressTracker();
    
    logger.info('Starting exam extraction test');
    
    // Create exam extractor
    const examExtractor = new ExamExtractorNew(config, logger, progressTracker, sessionId);
    
    // Extract exams
    const result = await examExtractor.extractExamsFromCourseData();
    
    if (result.success) {
      logger.info(`✓ Exam extraction successful! Found ${result.data!.length} exams`);
      console.log(`✓ Exam extraction successful! Found ${result.data!.length} exams`);
      
      // Show first few exams as examples
      const firstExams = result.data!.slice(0, 5);
      console.log('\nFirst 5 exams:');
      firstExams.forEach((exam, index) => {
        console.log(`${index + 1}. [${exam.id}] ${exam.name}`);
        console.log(`   Course: ${exam.courseName} (${exam.courseId})`);
        console.log(`   URL: ${exam.url}`);
        console.log('');
      });
    } else {
      logger.error('✗ Exam extraction failed', result.error);
      console.error('✗ Exam extraction failed:', result.error?.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testExamExtraction();

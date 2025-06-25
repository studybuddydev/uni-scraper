#!/usr/bin/env node

import path from 'path';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import { CourseDataProcessor } from '../core/CourseDataProcessor';
import { ExamExtractorNew } from '../core/ExamExtractorNew';

async function testFullExamPipeline() {
  try {
    console.log('=== Testing Full Exam Extraction Pipeline ===');
    
    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = configManager.loadConfig();
    
    console.log(`Using university: ${config.university.name}`);
    
    // Initialize utilities
    const sessionId = `test-full-${Date.now()}`;
    const logger = new Logger(config.output.logsDir, sessionId);
    const progressTracker = new ProgressTracker();
    
    // Step 1: Process course data (if needed)
    const rawDataPath = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/agentic-2025-06-24T17-30-45/agentic-2025-06-24T17-30-45-courses.json';
    console.log('Step 1: Processing course data...');
    
    const courseProcessor = new CourseDataProcessor(config, logger);
    const processedData = courseProcessor.processRawCourseData(rawDataPath, sessionId);
    console.log(`✓ Processed: ${Object.keys(processedData.courses).length} courses`);
    
    // Step 2: Extract exams
    console.log('Step 2: Extracting exams...');
    const examExtractor = new ExamExtractorNew(config, logger, progressTracker, sessionId);
    const processedDataPath = `/tmp/test-courses-processed-${sessionId}.json`;
    
    // Save processed data temporarily for the test
    require('fs').writeFileSync(processedDataPath, JSON.stringify(processedData, null, 2));
    
    const examResult = await examExtractor.extractExamsFromCourseData(processedDataPath);
    
    if (examResult.success) {
      const examCount = examResult.data!.length;
      console.log(`✓ SUCCESS: Extracted ${examCount} exams`);
      
      if (examCount > 0) {
        // Show statistics
        const courseStats = new Map<string, number>();
        examResult.data!.forEach(exam => {
          const course = exam.courseName || 'Unknown';
          courseStats.set(course, (courseStats.get(course) || 0) + 1);
        });
        
        console.log(`\nStatistics:`);
        console.log(`- Total exams: ${examCount}`);
        console.log(`- Courses with exams: ${courseStats.size}`);
        
        // Show examples
        console.log('\nFirst 5 exams:');
        examResult.data!.slice(0, 5).forEach((exam, index) => {
          console.log(`${index + 1}. [${exam.id}] ${exam.name}`);
          console.log(`   Course: ${exam.courseName} (${exam.courseId})`);
        });
        
        // Show top courses by exam count
        const topCourses = Array.from(courseStats.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        console.log('\nTop 5 courses by exam count:');
        topCourses.forEach(([course, count], index) => {
          console.log(`${index + 1}. ${course}: ${count} exams`);
        });
        
      } else {
        console.log('⚠️  No exams found - this indicates an issue with the extraction logic');
      }
    } else {
      console.error('✗ FAILED: Exam extraction failed');
      console.error('Error:', examResult.error?.message);
      console.error('Stack:', examResult.error?.stack);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('✗ Test failed with exception:', error);
    process.exit(1);
  }
}

testFullExamPipeline();

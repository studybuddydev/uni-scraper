#!/usr/bin/env node

import { ScrapingOrchestrator } from '../core/ScrapingOrchestrator';
import { ExamExtractor } from '../core/ExamExtractor';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import path from 'path';
import fs from 'fs';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: extract-exams <courses-file> [session-id]');
    console.log('');
    console.log('Examples:');
    console.log('  extract-exams courses-2024-01-15.json');
    console.log('  extract-exams courses-2024-01-15.json custom-session');
    process.exit(1);
  }
  
  const coursesFile = args[0];
  const customSessionId = args[1];
  
  try {
    console.log('🔬 Starting Exam Extraction');
    console.log('='.repeat(30));
    
    // Load configuration
    const configPath = path.join(process.cwd(), 'src/agentic_magic/config/scraping.config.json');
    const configManager = ConfigManager.getInstance();
    const config = configManager.loadConfig(configPath);
    
    // Load courses file
    if (!fs.existsSync(coursesFile)) {
      throw new Error(`Courses file not found: ${coursesFile}`);
    }
    
    const courses = JSON.parse(fs.readFileSync(coursesFile, 'utf-8'));
    console.log(`📚 Loaded ${courses.length} course paths from ${coursesFile}`);
    
    // Initialize components
    const sessionId = customSessionId || `exams-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
    const logger = new Logger(config.output.logsDir, sessionId);
    const progressTracker = new ProgressTracker();
    
    // Setup progress tracking
    progressTracker.onProgress((status) => {
      if (status.total > 0) {
        const progressBar = progressTracker.getProgressBar();
        const summary = progressTracker.getSummary();
        process.stdout.write(`\r${progressBar}\n${summary}`);
      }
    });
    
    console.log(`🎯 Session ID: ${sessionId}`);
    console.log(`🏫 University: ${config.university.name}`);
    console.log(`📊 Processing ${courses.length} course paths`);
    console.log('');
    
    // Extract exam URLs
    const examUrls = courses.map((course: any) => course.urlPath).filter(Boolean);
    console.log(`🔗 Found ${examUrls.length} exam URLs to process`);
    
    // Run exam extraction
    const examExtractor = new ExamExtractor(config, logger, progressTracker);
    const result = await examExtractor.extractExamsFromUrls(examUrls);
    
    if (!result.success) {
      throw new Error(`Exam extraction failed: ${result.error?.message}`);
    }
    
    const exams = result.data!;
    
    // Save results
    const outputDir = path.join(config.output.dataDir, sessionId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, 'exams.json');
    const outputJsonlFile = path.join(outputDir, 'exams.jsonl');
    
    // Save JSON format
    fs.writeFileSync(outputFile, JSON.stringify(exams, null, 2));
    
    // Save JSONL format
    const jsonlContent = exams.map(exam => JSON.stringify(exam)).join('\n');
    fs.writeFileSync(outputJsonlFile, jsonlContent);
    
    // Print summary
    console.log('\n');
    console.log('✅ Exam extraction completed!');
    console.log(`📊 Found ${exams.length} exams`);
    console.log(`📁 Results saved to: ${outputFile}`);
    console.log(`📁 JSONL format: ${outputJsonlFile}`);
    console.log(`⏱️  Duration: ${(result.metadata.duration / 1000).toFixed(2)}s`);
    
    // Show sample results
    if (exams.length > 0) {
      console.log('\n📋 Sample exams:');
      exams.slice(0, 3).forEach((exam, index) => {
        console.log(`  ${index + 1}. ${exam.name} (${exam.id})`);
      });
      if (exams.length > 3) {
        console.log(`  ... and ${exams.length - 3} more`);
      }
    }
    
    // Show statistics
    const uniqueCourses = new Set(exams.map(exam => exam.courseId)).size;
    console.log(`\n📊 Statistics:`);
    console.log(`  • Unique courses: ${uniqueCourses}`);
    console.log(`  • Average exams per course: ${(exams.length / uniqueCourses).toFixed(1)}`);
    
    progressTracker.stop();
    
  } catch (error) {
    console.error('💥 Exam extraction failed:', error);
    process.exit(1);
  }
}

main();

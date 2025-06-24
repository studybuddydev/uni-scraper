#!/usr/bin/env node

import { ScrapingOrchestrator } from '../core/ScrapingOrchestrator';
import { CourseDiscovery } from '../core/CourseDiscovery';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import path from 'path';
import fs from 'fs';

async function main() {
  try {
    console.log('🔍 Starting Course Discovery');
    console.log('='.repeat(30));
    
    // Load configuration
    const configPath = path.join(process.cwd(), 'src/agentic_magic/config/scraping.config.json');
    const configManager = ConfigManager.getInstance();
    const config = configManager.loadConfig(configPath);
    
    // Initialize components
    const sessionId = `courses-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
    const logger = new Logger(config.output.logsDir, sessionId);
    const progressTracker = new ProgressTracker();
    
    // Setup progress tracking
    progressTracker.onProgress((status) => {
      if (status.total > 0) {
        const progressBar = progressTracker.getProgressBar();
        process.stdout.write(`\r${progressBar} | ETA: ${status.eta.toFixed(0)}s`);
      }
    });
    
    console.log(`🎯 Session ID: ${sessionId}`);
    console.log(`🏫 University: ${config.university.name}`);
    console.log(`📊 Type: ${config.university.type}`);
    console.log('');
    
    // Run course discovery
    const courseDiscovery = new CourseDiscovery(config, logger, progressTracker);
    const result = await courseDiscovery.discoverCourses();
    
    if (!result.success) {
      throw new Error(`Course discovery failed: ${result.error?.message}`);
    }
    
    const courses = result.data!;
    
    // Save results
    const outputDir = path.join(config.output.dataDir, sessionId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, 'courses.json');
    fs.writeFileSync(outputFile, JSON.stringify(courses, null, 2));
    
    // Print summary
    console.log('\n');
    console.log('✅ Course discovery completed!');
    console.log(`📊 Found ${courses.length} course paths`);
    console.log(`📁 Results saved to: ${outputFile}`);
    console.log(`⏱️  Duration: ${(result.metadata.duration / 1000).toFixed(2)}s`);
    
    // Show sample results
    if (courses.length > 0) {
      console.log('\n📋 Sample courses:');
      courses.slice(0, 3).forEach((course, index) => {
        console.log(`  ${index + 1}. ${course.courseName} (${course.year})`);
      });
      if (courses.length > 3) {
        console.log(`  ... and ${courses.length - 3} more`);
      }
    }
    
    progressTracker.stop();
    
  } catch (error) {
    console.error('💥 Course discovery failed:', error);
    process.exit(1);
  }
}

main();

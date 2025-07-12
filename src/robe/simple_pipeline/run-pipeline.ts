/**
 * Simple University Scraper Pipeline
 * 
 * A clear, robust 2-step process for scraping university course and exam data:
 * 
 * Step 1: Discover courses and extract basic exam information
 * Step 2: Scrape detailed exam data with all syllabus information
 * 
 * This pipeline handles all edge cases including modal paths, modules, fractions,
 * and produces clean, understandable data output.
 */

import { runStep1 } from './step1-courses';
import { runStep2 } from './step2-exams';
import { ScrapingConfig } from './config';

/**
 * Run the complete 2-step pipeline
 */
export async function runFullPipeline(config?: Partial<ScrapingConfig>): Promise<string> {
  const fullConfig: ScrapingConfig = {
    university: 'unibs',
    type: 'triennale',
    url: '/corsi/2025?gruppo=1617109934164',
    numberOfYears: 5,
    ...config
  };

  console.log('🎯 Starting Simple University Scraper Pipeline');
  console.log('📋 Configuration:', fullConfig);
  console.log('');

  // Step 1: Course Discovery
  console.log('=====================================');
  console.log('🚀 STEP 1: Course Discovery');
  console.log('=====================================');
  
  const sessionDir = await runStep1(fullConfig);
  
  console.log('');
  console.log('=====================================');
  console.log('🚀 STEP 2: Exam Detail Scraping');
  console.log('=====================================');
  
  // Step 2: Exam Scraping
  await runStep2(sessionDir);
  
  console.log('');
  console.log('🎉 PIPELINE COMPLETE!');
  console.log(`📁 All data saved in: ${sessionDir}`);
  console.log('');
  console.log('📊 Output files:');
  console.log('   • dataCourses.json - Course discovery results');
  console.log('   • dataExams.json - Complete exam data');
  console.log('   • dataExams.jsonl - Exam data in JSONL format');
  console.log('   • config.json - Configuration used');
  
  return sessionDir;
}

/**
 * Run just Step 1 (Course Discovery)
 */
export async function runStep1Only(config?: Partial<ScrapingConfig>): Promise<string> {
  const fullConfig: ScrapingConfig = {
    university: 'unibs',
    type: 'triennale',
    url: '/corsi/2025?gruppo=1617109934164',
    numberOfYears: 5,
    ...config
  };

  console.log('🎯 Running Step 1: Course Discovery Only');
  console.log('📋 Configuration:', fullConfig);
  
  return await runStep1(fullConfig);
}

/**
 * Run just Step 2 (Exam Detail Scraping)
 */
export async function runStep2Only(sessionDir: string): Promise<void> {
  console.log('🎯 Running Step 2: Exam Detail Scraping Only');
  console.log(`📁 Using session: ${sessionDir}`);
  
  return await runStep2(sessionDir);
}

// Allow running from command line
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run full pipeline with default config
    runFullPipeline().catch(console.error);
  } else if (args[0] === 'step1') {
    // Run only step 1
    runStep1Only().catch(console.error);
  } else if (args[0] === 'step2' && args[1]) {
    // Run only step 2 with session directory
    runStep2Only(args[1]).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node run-pipeline.js              # Run full pipeline');
    console.log('  node run-pipeline.js step1         # Run only step 1');
    console.log('  node run-pipeline.js step2 <dir>   # Run only step 2');
  }
}

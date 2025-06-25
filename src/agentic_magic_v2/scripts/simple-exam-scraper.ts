#!/usr/bin/env node

/**
 * Simple Script to Run Exam Detail Scraping
 * 
 * This script allows you to quickly scrape detailed exam information
 * using the existing exam data files from previous runs.
 */

import fs from 'fs';
import path from 'path';

// Import the existing exam detail scraper
const { ExamDetailScraper } = require('../agentic_magic/scripts/scrape-exam-details');

interface ScrapingOptions {
  inputFile: string;
  batchSize?: number;
  delayBetweenRequests?: number;
  maxRetries?: number;
  outputDir?: string;
}

class SimpleExamScraper {
  private options: ScrapingOptions;

  constructor(options: ScrapingOptions) {
    this.options = {
      batchSize: 5,
      delayBetweenRequests: 2000,
      maxRetries: 3,
      outputDir: './data',
      ...options
    };
  }

  public async run(): Promise<void> {
    console.log('🚀 Starting Exam Detail Scraping...');
    console.log(`📁 Input file: ${this.options.inputFile}`);
    console.log(`⚙️  Batch size: ${this.options.batchSize}`);
    console.log(`⏱️  Delay between requests: ${this.options.delayBetweenRequests}ms`);
    console.log(`🔄 Max retries: ${this.options.maxRetries}`);
    console.log('');

    // Validate input file
    if (!fs.existsSync(this.options.inputFile)) {
      throw new Error(`Input file not found: ${this.options.inputFile}`);
    }

    // Load exam data
    const exams = JSON.parse(fs.readFileSync(this.options.inputFile, 'utf8'));
    console.log(`📊 Loaded ${exams.length} exams to process`);

    // Create scraper instance
    const scraper = new ExamDetailScraper(this.options.inputFile);

    try {
      // Run the scraping
      await scraper.scrapeExamDetails(this.options.inputFile);
      
      console.log('✅ Scraping completed successfully!');
      console.log('📁 Check the output directory for results');
      
    } catch (error) {
      console.error('❌ Scraping failed:', error);
      throw error;
    }
  }

  public static async runFromArgs(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log('Usage: npm run scrape-simple <input-file> [options]');
      console.log('');
      console.log('Options:');
      console.log('  --batch-size <number>        Number of items to process in parallel (default: 5)');
      console.log('  --delay <number>             Delay between requests in ms (default: 2000)');
      console.log('  --max-retries <number>       Maximum retry attempts (default: 3)');
      console.log('  --output-dir <path>          Output directory (default: ./data)');
      console.log('');
      console.log('Examples:');
      console.log('  npm run scrape-simple ./data/agentic-2025-06-25T14-58-23/agentic-2025-06-25T14-58-23-3-exams.json');
      console.log('  npm run scrape-simple ./data/exams.json --batch-size 3 --delay 3000');
      return;
    }

    const inputFile = args[0];
    const options: ScrapingOptions = { inputFile };

    // Parse command line options
    for (let i = 1; i < args.length; i += 2) {
      const option = args[i];
      const value = args[i + 1];

      switch (option) {
        case '--batch-size':
          options.batchSize = parseInt(value, 10);
          break;
        case '--delay':
          options.delayBetweenRequests = parseInt(value, 10);
          break;
        case '--max-retries':
          options.maxRetries = parseInt(value, 10);
          break;
        case '--output-dir':
          options.outputDir = value;
          break;
        default:
          console.warn(`Unknown option: ${option}`);
      }
    }

    const scraper = new SimpleExamScraper(options);
    await scraper.run();
  }
}

// Auto-run if called directly
if (require.main === module) {
  SimpleExamScraper.runFromArgs().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { SimpleExamScraper };

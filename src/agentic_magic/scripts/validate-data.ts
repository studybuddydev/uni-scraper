#!/usr/bin/env node

import { DataValidator } from '../core/DataValidator';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import path from 'path';
import fs from 'fs';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: validate-data <data-file> [data-type]');
    console.log('');
    console.log('Arguments:');
    console.log('  data-file    JSON file containing courses or exams data');
    console.log('  data-type    Optional: "courses" or "exams" (auto-detected if not specified)');
    console.log('');
    console.log('Examples:');
    console.log('  validate-data ./data/agentic-2024-01-15/courses.json');
    console.log('  validate-data ./data/agentic-2024-01-15/exams.json exams');
    process.exit(1);
  }
  
  const dataFile = args[0];
  const dataType = args[1];
  
  try {
    console.log('✅ Starting Data Validation');
    console.log('='.repeat(30));
    
    // Check if file exists
    if (!fs.existsSync(dataFile)) {
      throw new Error(`Data file not found: ${dataFile}`);
    }
    
    // Load configuration
    const configPath = path.join(process.cwd(), 'src/agentic_magic/config/scraping.config.json');
    const configManager = ConfigManager.getInstance();
    const config = configManager.loadConfig(configPath);
    
    // Initialize components
    const sessionId = `validation-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
    const logger = new Logger(config.output.logsDir, sessionId);
    const validator = new DataValidator(logger);
    
    // Load data
    console.log(`📂 Loading data from: ${dataFile}`);
    const rawData = fs.readFileSync(dataFile, 'utf-8');
    const data = JSON.parse(rawData);
    
    if (!Array.isArray(data)) {
      throw new Error('Data file must contain an array of items');
    }
    
    console.log(`📊 Loaded ${data.length} items`);
    
    // Auto-detect data type if not specified
    let detectedType = dataType;
    if (!detectedType) {
      if (data.length > 0) {
        const firstItem = data[0];
        detectedType = 'exams' in firstItem ? 'courses' : 'exams';
        console.log(`🔍 Auto-detected data type: ${detectedType}`);
      } else {
        throw new Error('Cannot detect data type from empty array');
      }
    }
    
    console.log(`🎯 Session ID: ${sessionId}`);
    console.log(`📋 Data type: ${detectedType}`);
    console.log('');
    
    // Validate data
    console.log('🔍 Running validation...');
    const startTime = Date.now();
    
    const validationResult = validator.validateBatch(data);
    
    const duration = Date.now() - startTime;
    
    // Print results
    console.log('\n📊 Validation Results:');
    console.log('='.repeat(50));
    console.log(`Total Items: ${validationResult.totalItems}`);
    console.log(`Valid Items: ${validationResult.validItems} (${((validationResult.validItems / validationResult.totalItems) * 100).toFixed(1)}%)`);
    console.log(`Invalid Items: ${validationResult.invalidItems} (${((validationResult.invalidItems / validationResult.totalItems) * 100).toFixed(1)}%)`);
    console.log(`Items with Warnings: ${validationResult.warnings.length}`);
    console.log(`Duration: ${duration}ms`);
    
    // Save detailed report
    const outputDir = path.join(config.output.reportsDir, sessionId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const reportFile = path.join(outputDir, 'validation-report.txt');
    const detailedReport = validator.generateValidationReport([
      ...validationResult.errors,
      ...validationResult.warnings
    ]);
    
    fs.writeFileSync(reportFile, detailedReport);
    console.log(`\n📁 Detailed report saved to: ${reportFile}`);
    
    // Show sample errors and warnings
    if (validationResult.errors.length > 0) {
      console.log('\n❌ Sample Validation Errors:');
      validationResult.errors.slice(0, 3).forEach((error, index) => {
        console.log(`  ${index + 1}. Item ${error.index}:`);
        error.validation.errors.slice(0, 2).forEach(err => {
          console.log(`     • ${err.field}: ${err.message}`);
        });
      });
      if (validationResult.errors.length > 3) {
        console.log(`     ... and ${validationResult.errors.length - 3} more errors`);
      }
    }
    
    if (validationResult.warnings.length > 0) {
      console.log('\n⚠️  Sample Validation Warnings:');
      validationResult.warnings.slice(0, 3).forEach((warning, index) => {
        console.log(`  ${index + 1}. Item ${warning.index}:`);
        warning.validation.warnings.slice(0, 2).forEach(warn => {
          console.log(`     • ${warn.field}: ${warn.message}`);
        });
      });
      if (validationResult.warnings.length > 3) {
        console.log(`     ... and ${validationResult.warnings.length - 3} more warnings`);
      }
    }
    
    if (validationResult.invalidItems === 0) {
      console.log('\n🎉 All items passed validation!');
    } else {
      console.log(`\n📋 ${validationResult.invalidItems} items need attention. Check the detailed report for more information.`);
    }
    
  } catch (error) {
    console.error('💥 Validation failed:', error);
    process.exit(1);
  }
}

main();

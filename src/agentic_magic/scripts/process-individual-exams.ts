#!/usr/bin/env ts-node

import { ScrapingConfig } from '../types';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import { ConfigManager } from '../utils/ConfigManager';
import { IndividualExamProcessor } from '../core/IndividualExamProcessor';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('🔍 Starting Individual Exam Processing');
  console.log('=====================================');
  
  // Load configuration
  const configManager = ConfigManager.getInstance();
  const config: ScrapingConfig = configManager.loadConfig();
  
  // Generate session ID or use existing one
  const sessionId = process.argv[2] || findLatestSession(config);
  
  if (!sessionId) {
    console.error('❌ No session ID provided and no existing session found');
    console.log('Usage: npm run process-individual-exams [session-id]');
    process.exit(1);
  }
  
  console.log(`📁 Using session: ${sessionId}`);
  
  // Initialize utilities
  const logger = new Logger(config.output.logsDir, sessionId);
  const progressTracker = new ProgressTracker();
  
  // Create processor
  const processor = new IndividualExamProcessor(config, logger, progressTracker, sessionId);
  
  // Find intermediate exams file
  const sessionDir = path.join(process.cwd(), config.output.dataDir, sessionId);
  const intermediateFile = path.join(sessionDir, `${sessionId}-exams-intermediate.json`);
  
  if (!fs.existsSync(intermediateFile)) {
    console.error(`❌ Intermediate exam file not found: ${intermediateFile}`);
    process.exit(1);
  }
  
  console.log(`📄 Found intermediate file: ${intermediateFile}`);
  
  try {
    // Process all exams individually
    await processor.processAllExamsFromIntermediate(intermediateFile);
    
    // Generate final dataExams file
    await processor.generateFinalDataExams();
    
    console.log('✅ Individual exam processing completed successfully!');
    
  } catch (error) {
    console.error('❌ Individual exam processing failed:', error);
    logger.error('Individual exam processing failed', error);
    process.exit(1);
  }
}

function findLatestSession(config: ScrapingConfig): string | null {
  const dataDir = path.join(process.cwd(), config.output.dataDir);
  
  if (!fs.existsSync(dataDir)) {
    return null;
  }
  
  const sessionDirs = fs.readdirSync(dataDir)
    .filter(dir => dir.startsWith('agentic-'))
    .sort()
    .reverse();
  
  return sessionDirs.length > 0 ? sessionDirs[0] : null;
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

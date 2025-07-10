#!/usr/bin/env ts-node

import { ScrapingOrchestrator } from '../core/ScrapingOrchestrator';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('🔍 Starting Individual Exam Processing via Orchestrator');
  console.log('======================================================');
  
  // Get session ID from command line argument or find latest
  const sessionId = process.argv[2];
  
  if (!sessionId) {
    console.error('❌ Please provide a session ID');
    console.log('Usage: npm run agentic:process-individual-exams [session-id]');
    process.exit(1);
  }
  
  console.log(`📁 Using session: ${sessionId}`);
  
  try {
    // Create orchestrator
    const orchestrator = new ScrapingOrchestrator();
    
    // Run individual exam processing
    await orchestrator.runIndividualExamProcessing(sessionId);
    
    console.log('✅ Individual exam processing completed successfully!');
    
  } catch (error) {
    console.error('❌ Individual exam processing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

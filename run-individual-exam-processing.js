#!/usr/bin/env node

/**
 * Script to run individual exam processing
 * Usage: node run-individual-exam-processing.js <session-id>
 */

const { ScrapingOrchestrator } = require('./dist/agentic_magic/core/ScrapingOrchestrator');
const path = require('path');

async function main() {
  console.log('🔍 Starting Individual Exam Processing');
  console.log('=====================================');
  
  // Get session ID from command line argument
  const sessionId = process.argv[2];
  
  if (!sessionId) {
    console.error('❌ Please provide a session ID');
    console.log('Usage: node run-individual-exam-processing.js <session-id>');
    console.log('Example: node run-individual-exam-processing.js agentic-2025-07-08T17-33-34');
    process.exit(1);
  }
  
  console.log(`📁 Using session: ${sessionId}`);
  
  try {
    // Create orchestrator
    const orchestrator = new ScrapingOrchestrator();
    
    // Run individual exam processing
    await orchestrator.runIndividualExamProcessing(sessionId);
    
    console.log('✅ Individual exam processing completed successfully!');
    console.log('📁 Check the session directory for:');
    console.log('   - individual-exams/ folder with individual JSON files');
    console.log('   - final dataExams.json file');
    
  } catch (error) {
    console.error('❌ Individual exam processing failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

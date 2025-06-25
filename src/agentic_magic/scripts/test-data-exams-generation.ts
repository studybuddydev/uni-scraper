#!/usr/bin/env node

import { ConfigManager } from '../utils/ConfigManager';
import { ScrapingOrchestrator } from '../core/ScrapingOrchestrator';

async function testDataExamsGeneration() {
  try {
    console.log('=== Testing dataExams and dataCourses Generation ===');
    
    // Initialize orchestrator (it will load config internally)
    const orchestrator = new ScrapingOrchestrator();
    
    // Run full pipeline
    await orchestrator.runFullPipeline();
    
    console.log('✓ Test completed! Check the data directory for dataExams and dataCourses files.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testDataExamsGeneration().catch(console.error);

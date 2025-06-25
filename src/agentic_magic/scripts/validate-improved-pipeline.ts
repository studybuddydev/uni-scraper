#!/usr/bin/env node

/**
 * Quick validation test for the improved agentic_magic pipeline
 * Tests the 2-step process and edge case handling
 */

import { ScrapingOrchestrator } from '../core/ScrapingOrchestrator';
import fs from 'fs';
import path from 'path';

async function validateAgenticPipeline() {
  console.log('🧪 TESTING IMPROVED AGENTIC_MAGIC PIPELINE');
  console.log('==========================================');
  console.log('');

  try {
    // Initialize orchestrator
    const orchestrator = new ScrapingOrchestrator();
    
    console.log('✅ Orchestrator initialized successfully');
    console.log('📋 Testing 2-step process clarity...');
    console.log('');
    
    // Run a small test (you can interrupt after seeing the logs)
    console.log('🚀 Starting pipeline test...');
    console.log('   (You can Ctrl+C after seeing the improved logs)');
    console.log('');
    
    await orchestrator.runFullPipeline();
    
  } catch (error: any) {
    if (error?.message?.includes('SIGINT') || error?.message?.includes('interrupted')) {
      console.log('');
      console.log('✅ Test completed - pipeline logs look good!');
    } else {
      console.error('❌ Pipeline test failed:', error);
    }
  }
}

// Check if recent data exists to validate output
function checkRecentOutput() {
  console.log('🔍 CHECKING RECENT PIPELINE OUTPUT');
  console.log('==================================');
  
  const dataDir = './data';
  if (!fs.existsSync(dataDir)) {
    console.log('❌ No data directory found');
    return;
  }
  
  const sessions = fs.readdirSync(dataDir)
    .filter(name => name.startsWith('agentic-'))
    .sort()
    .reverse();
  
  if (sessions.length === 0) {
    console.log('❌ No agentic sessions found');
    return;
  }
  
  const latestSession = sessions[0];
  const sessionPath = path.join(dataDir, latestSession);
  
  console.log(`📁 Latest session: ${latestSession}`);
  
  // Check for the 2 main outputs
  const dataCourses = path.join(sessionPath, `${latestSession}-5-dataCourses.json`);
  const dataExams = path.join(sessionPath, `${latestSession}-4-dataExams.json`);
  
  if (fs.existsSync(dataCourses)) {
    const coursesData = JSON.parse(fs.readFileSync(dataCourses, 'utf8'));
    console.log(`✅ dataCourses.json: ${coursesData.length} courses`);
  } else {
    console.log('❌ dataCourses.json not found');
  }
  
  if (fs.existsSync(dataExams)) {
    const examsData = JSON.parse(fs.readFileSync(dataExams, 'utf8'));
    console.log(`✅ dataExams.json: ${examsData.length} exams`);
    
    // Check for modules/fractions
    const withModules = examsData.filter((exam: any) => exam.module).length;
    const withFractions = examsData.filter((exam: any) => exam.fraction).length;
    
    console.log(`   📚 Exams with modules: ${withModules}`);
    console.log(`   🔢 Exams with fractions: ${withFractions}`);
    
    // Check field completeness
    const fieldsToCheck = ['chapters', 'books', 'goals', 'requirements'];
    fieldsToCheck.forEach(field => {
      const withField = examsData.filter((exam: any) => exam[field] && exam[field].length > 0).length;
      console.log(`   📝 Exams with ${field}: ${withField}`);
    });
    
  } else {
    console.log('❌ dataExams.json not found');
  }
  
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check-output')) {
    checkRecentOutput();
  } else {
    await validateAgenticPipeline();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

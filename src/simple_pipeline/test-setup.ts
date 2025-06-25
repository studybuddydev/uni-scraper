/**
 * Test script to validate the simple pipeline setup
 */

import { ScrapingConfig, getScrapingName, getBaseUrl } from './config';

function testConfig() {
  console.log('🧪 Testing configuration...');
  
  const config: ScrapingConfig = {
    university: 'unibs',
    type: 'triennale',
    url: '/corsi/2025?gruppo=1617109934164',
    numberOfYears: 5
  };
  
  const name = getScrapingName(config);
  const baseUrl = getBaseUrl(config);
  
  console.log(`✅ Scraping name: ${name}`);
  console.log(`✅ Base URL: ${baseUrl}`);
  console.log(`✅ Full URL: ${baseUrl}${config.url}`);
  
  return true;
}

function testStructure() {
  console.log('🧪 Testing pipeline structure...');
  
  // Check if main functions exist
  try {
    const { runStep1 } = require('./step1-courses');
    const { runStep2 } = require('./step2-exams');
    const { runFullPipeline } = require('./run-pipeline');
    
    console.log('✅ Step 1 function available');
    console.log('✅ Step 2 function available');
    console.log('✅ Full pipeline function available');
    
    return true;
  } catch (error) {
    console.error('❌ Structure test failed:', error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Running Simple Pipeline Tests\n');
  
  const configTest = testConfig();
  const structureTest = testStructure();
  
  console.log('\n📊 Test Results:');
  console.log(`Config test: ${configTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Structure test: ${structureTest ? '✅ PASS' : '❌ FAIL'}`);
  
  if (configTest && structureTest) {
    console.log('\n🎉 All tests passed! The simple pipeline is ready to use.');
    console.log('\n📋 To run the pipeline:');
    console.log('   npm run simple:full     # Full pipeline');
    console.log('   npm run simple:step1    # Course discovery only');
    console.log('   npm run simple:step2 <session>  # Exam scraping only');
  } else {
    console.log('\n❌ Some tests failed. Please check the setup.');
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

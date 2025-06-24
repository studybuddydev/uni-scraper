#!/usr/bin/env node

import { ScrapingOrchestrator } from '../core/ScrapingOrchestrator';
import { ConfigManager } from '../utils/ConfigManager';
import path from 'path';

async function main() {
  try {
    console.log('🚀 Starting Agentic Magic University Scraper');
    console.log('='.repeat(50));
    
    // Check if config exists
    const configPath = path.join(process.cwd(), 'src/agentic_magic/config/scraping.config.json');
    const configManager = ConfigManager.getInstance();
    
    try {
      configManager.loadConfig(configPath);
    } catch (error) {
      console.error('❌ Configuration file not found or invalid.');
      console.log('📝 Creating configuration file from template...');
      
      try {
        configManager.createConfigFromTemplate();
        console.log('✅ Configuration file created successfully!');
        console.log('🔧 Please edit src/agentic_magic/config/scraping.config.json before running again.');
        process.exit(0);
      } catch (templateError) {
        console.error('❌ Failed to create configuration file:', templateError);
        process.exit(1);
      }
    }
    
    // Initialize orchestrator
    const orchestrator = new ScrapingOrchestrator(configPath);
    
    console.log(`🎯 Session ID: ${orchestrator.getSessionId()}`);
    console.log(`🏫 University: ${orchestrator.getConfig().university.name}`);
    console.log(`📊 Type: ${orchestrator.getConfig().university.type}`);
    console.log('');
    
    // Run full pipeline
    await orchestrator.runFullPipeline();
    
    console.log('');
    console.log('🎉 Scraping completed successfully!');
    console.log(`📁 Check the reports directory for detailed results.`);
    
  } catch (error) {
    console.error('💥 Scraping failed:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n🛑 Scraping interrupted by user');
  process.exit(0);
});

main();

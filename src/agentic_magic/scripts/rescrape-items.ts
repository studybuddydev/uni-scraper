#!/usr/bin/env node

import { ScrapingOrchestrator } from '../core/ScrapingOrchestrator';
import { ConfigManager } from '../utils/ConfigManager';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: rescrape-items <item-type> <item-ids...>');
    console.log('');
    console.log('Arguments:');
    console.log('  item-type    Type of items: "course" or "exam"');
    console.log('  item-ids     One or more IDs to re-scrape');
    console.log('');
    console.log('Examples:');
    console.log('  rescrape-items course unibs05851');
    console.log('  rescrape-items exam unibs702816 unibs703503');
    console.log('  rescrape-items course unibs05851 unibs05742');
    process.exit(1);
  }
  
  const itemType = args[0];
  const itemIds = args.slice(1);
  
  if (!['course', 'exam'].includes(itemType)) {
    console.error('❌ Invalid item type. Must be "course" or "exam"');
    process.exit(1);
  }
  
  if (itemIds.length === 0) {
    console.error('❌ No item IDs provided');
    process.exit(1);
  }
  
  try {
    console.log('🎯 Starting Selective Re-scraping');
    console.log('='.repeat(35));
    
    // Load configuration
    const configPath = path.join(process.cwd(), 'src/agentic_magic/config/scraping.config.json');
    const configManager = ConfigManager.getInstance();
    configManager.loadConfig(configPath);
    
    // Initialize orchestrator
    const orchestrator = new ScrapingOrchestrator(configPath);
    
    console.log(`🎯 Session ID: ${orchestrator.getSessionId()}`);
    console.log(`📊 Item type: ${itemType}`);
    console.log(`🔢 Items to re-scrape: ${itemIds.length}`);
    console.log(`📋 IDs: ${itemIds.join(', ')}`);
    console.log('');
    
    // Re-scrape items
    const items = itemType === 'course' 
      ? { courses: itemIds }
      : { exams: itemIds };
    
    await orchestrator.reScrapeItems(items);
    
    console.log('');
    console.log('✅ Re-scraping completed successfully!');
    
  } catch (error) {
    console.error('💥 Re-scraping failed:', error);
    process.exit(1);
  }
}

main();

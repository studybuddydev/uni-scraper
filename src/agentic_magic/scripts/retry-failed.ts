#!/usr/bin/env node

import { ScrapingOrchestrator } from '../core/ScrapingOrchestrator';
import { ConfigManager } from '../utils/ConfigManager';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: retry-failed <session-id|latest> [item-type]');
    console.log('');
    console.log('Arguments:');
    console.log('  session-id   Session ID to retry (or "latest" for most recent)');
    console.log('  item-type    Optional: "courses", "exams", or "all" (default: all)');
    console.log('');
    console.log('Examples:');
    console.log('  retry-failed latest');
    console.log('  retry-failed agentic-2024-01-15T14-30-00');
    console.log('  retry-failed latest exams');
    process.exit(1);
  }
  
  const sessionId = args[0];
  const itemType = args[1] || 'all';
  
  try {
    console.log('🔄 Starting Failed Items Retry');
    console.log('='.repeat(35));
    
    // Load configuration
    const configPath = path.join(process.cwd(), 'src/agentic_magic/config/scraping.config.json');
    const configManager = ConfigManager.getInstance();
    configManager.loadConfig(configPath);
    
    // Initialize orchestrator
    const orchestrator = new ScrapingOrchestrator(configPath);
    
    console.log(`🎯 New Session ID: ${orchestrator.getSessionId()}`);
    console.log(`🔄 Retrying from: ${sessionId}`);
    console.log(`📊 Item type: ${itemType}`);
    console.log('');
    
    // Retry failed items
    await orchestrator.retryFailedItems(sessionId);
    
    console.log('');
    console.log('✅ Retry completed successfully!');
    
  } catch (error) {
    console.error('💥 Retry failed:', error);
    process.exit(1);
  }
}

main();

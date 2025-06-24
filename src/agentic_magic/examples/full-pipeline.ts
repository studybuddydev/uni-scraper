import { ScrapingOrchestrator } from '../index';

async function example() {
  // Initialize with custom config
  const orchestrator = new ScrapingOrchestrator('./custom-config.json');
  
  try {
    // Run full pipeline
    console.log('Starting full scraping pipeline...');
    await orchestrator.runFullPipeline();
    
    console.log('Pipeline completed successfully!');
    console.log(`Session ID: ${orchestrator.getSessionId()}`);
    
  } catch (error) {
    console.error('Pipeline failed:', error);
  }
}

example();

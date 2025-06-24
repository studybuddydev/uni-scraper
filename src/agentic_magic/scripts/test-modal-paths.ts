#!/usr/bin/env node

import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import { CourseDiscovery } from '../core/CourseDiscovery';

async function testModalPathHandling() {
  try {
    console.log('=== Testing Modal Path Handling for GIURISPRUDENZA ===');
    
    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = configManager.loadConfig();
    
    // Initialize utilities
    const sessionId = `test-modal-${Date.now()}`;
    const logger = new Logger(config.output.logsDir, sessionId);
    const progressTracker = new ProgressTracker();
    
    // Create course discovery
    const courseDiscovery = new CourseDiscovery(config, logger, progressTracker);
    
    // Test rediscovering GIURISPRUDENZA specifically
    const giurisprudenzaUrl = 'https://unibs.coursecatalogue.cineca.it/corsi/2025/1498';
    console.log(`Testing course discovery for: ${giurisprudenzaUrl}`);
    
    const result = await courseDiscovery.reDiscoverCourse(giurisprudenzaUrl);
    
    if (result.success && result.data) {
      console.log(`✓ SUCCESS: Found ${result.data.length} course entries for GIURISPRUDENZA`);
      
      // Show the discovered paths
      const groupedByPath = result.data.reduce((acc, entry) => {
        if (!acc[entry.path]) acc[entry.path] = [];
        acc[entry.path].push(entry);
        return acc;
      }, {} as Record<string, typeof result.data>);
      
      console.log('\nDiscovered paths:');
      for (const [pathName, entries] of Object.entries(groupedByPath)) {
        console.log(`\nPath: ${pathName || 'Default'}`);
        console.log(`  Years: ${entries.length}`);
        entries.forEach((entry, index) => {
          console.log(`    ${index + 1}. ${entry.year}`);
          console.log(`       URL: ${entry.urlPath}`);
        });
      }
    } else {
      console.error('❌ FAILED:', result.error);
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

if (require.main === module) {
  testModalPathHandling().catch(console.error);
}

export { testModalPathHandling };

#!/usr/bin/env ts-node

import path from 'path';
import { CourseDiscovery } from '../core/CourseDiscovery';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import { RetryManager } from '../utils/RetryManager';

async function testSingleCourse() {
  const sessionId = `test-single-course-${Date.now()}`;
  
  // Load configuration
  const configManager = ConfigManager.getInstance();
  const config = configManager.loadConfig();
  
  const logsDir = path.join(process.cwd(), 'logs');
  const logger = new Logger(logsDir, sessionId, 'debug');
  const progressTracker = new ProgressTracker();
  const retryManager = new RetryManager(logger);

  logger.info('Testing single course with modal path selection');

  const discovery = new CourseDiscovery(config, logger, progressTracker);

  // Test GIURISPRUDENZA specifically
  const courseUrl = 'https://unibs.coursecatalogue.cineca.it/corsi/2025/1498';
  
  logger.info(`Testing course: ${courseUrl}`);
  
  const result = await discovery.reDiscoverCourse(courseUrl);
  
  if (result.success) {
    logger.info(`✅ Success! Found ${result.data!.length} degree paths`);
    result.data!.forEach((path, index) => {
      logger.info(`${index + 1}. ${path.courseName} - Path: "${path.path}" - Year: ${path.year}`);
      logger.info(`   URL: ${path.urlPath}`);
    });
  } else {
    logger.error('❌ Failed:', result.error);
  }

  logger.info('Test completed');
}

testSingleCourse().catch(console.error);

testSingleCourse().catch(console.error);

import { CourseDiscovery, ConfigManager, Logger, ProgressTracker } from '../index';

async function example() {
  // Load configuration
  const configManager = ConfigManager.getInstance();
  const config = configManager.loadConfig('./config/scraping.config.json');
  
  // Initialize components
  const sessionId = 'custom-session-' + Date.now();
  const logger = new Logger('./logs', sessionId);
  const progressTracker = new ProgressTracker();
  
  // Set up progress tracking
  progressTracker.onProgress((status) => {
    console.log(`Progress: ${status.percentage.toFixed(1)}% (${status.completed}/${status.total})`);
    if (status.currentItem) {
      console.log(`Current: ${status.currentItem}`);
    }
  });
  
  try {
    // Discover courses
    console.log('Starting course discovery...');
    const courseDiscovery = new CourseDiscovery(config, logger, progressTracker);
    const result = await courseDiscovery.discoverCourses();
    
    if (result.success) {
      console.log(`Found ${result.data!.length} courses`);
      
      // Print first few courses
      result.data!.slice(0, 3).forEach((course, index) => {
        console.log(`${index + 1}. ${course.courseName} (${course.year})`);
      });
    } else {
      console.error('Course discovery failed:', result.error);
    }
    
  } catch (error) {
    console.error('Example failed:', error);
  } finally {
    progressTracker.stop();
  }
}

example();

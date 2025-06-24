# Agentic Magic - Enhanced University Scraping Pipeline

A robust, error-resilient university scraping pipeline with comprehensive failure tracking, reporting, and selective re-scraping capabilities.

## Features

- **Robust Error Handling**: Comprehensive error tracking with detailed failure reports
- **Retry Mechanisms**: Exponential backoff with configurable retry limits
- **Progress Tracking**: Visual progress indicators and real-time status updates
- **Selective Re-scraping**: Re-scrape individual courses/exams or failed items
- **Data Validation**: Integrity checks and validation before saving
- **Comprehensive Reporting**: JSON/CSV reports with detailed error information
- **Resume Capability**: Continue interrupted scraping sessions
- **Backup & Recovery**: Automatic backups and restore functionality

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Configure your scraping target
cp src/agentic_magic/config/scraping.config.example.json src/agentic_magic/config/scraping.config.json
# Edit the config file with your university settings

# Run full pipeline
npm run agentic:full

# Or run individual steps
npm run agentic:courses
npm run agentic:exams
```

## Configuration

Edit `src/agentic_magic/config/scraping.config.json`:

```json
{
  "university": {
    "id": "unibs",
    "name": "Università degli Studi di Brescia",
    "baseUrl": "https://unibs.coursecatalogue.cineca.it",
    "type": "triennale"
  },
  "scraping": {
    "concurrency": 3,
    "delayBetweenRequests": 1000,
    "maxRetries": 3,
    "retryDelay": 2000,
    "timeout": 30000
  },
  "output": {
    "dataDir": "./data",
    "logsDir": "./logs",
    "reportsDir": "./reports",
    "backupDir": "./backups"
  }
}
```

## Pipeline Steps

### 1. Course Discovery (`CourseDiscovery`)
Discovers all courses and their metadata from the university catalog.

```bash
npm run agentic:courses
```

### 2. Exam Extraction (`ExamExtractor`)
Extracts all exams for discovered courses.

```bash
npm run agentic:exams
```

### 3. Syllabus Scraping (`SyllabusEnricher`)
Scrapes detailed syllabus information for each exam.

```bash
npm run agentic:syllabus
```

## Selective Re-scraping

### Re-scrape Failed Items
```typescript
import { ScrapingOrchestrator } from './core/ScrapingOrchestrator';

const orchestrator = new ScrapingOrchestrator();

// Re-scrape all failed items from last run
await orchestrator.retryFailedItems('latest');

// Re-scrape failed items from specific session
await orchestrator.retryFailedItems('2024-01-15_14-30-00');
```

### Re-scrape Specific Items
```typescript
// Re-scrape specific course
await orchestrator.reScrapeCourse('unibs05851');

// Re-scrape specific exam
await orchestrator.reScrapeExam('unibs702816');

// Re-scrape multiple items
await orchestrator.reScrapeItems({
  courses: ['unibs05851', 'unibs05742'],
  exams: ['unibs702816', 'unibs703503']
});
```

## Error Handling & Recovery

### Automatic Retries
- Exponential backoff for network errors
- Configurable retry limits per operation
- Smart retry logic based on error type

### Comprehensive Logging
- Structured JSON logs with timestamps
- Error categorization and stack traces
- Performance metrics and timing data

### Progress Tracking
```typescript
import { ProgressTracker } from './utils/ProgressTracker';

const tracker = new ProgressTracker();
tracker.onProgress((status) => {
  console.log(`Progress: ${status.completed}/${status.total} (${status.percentage}%)`);
});
```

## Reports & Analytics

### Detailed Reports
The pipeline generates comprehensive reports:

- **JSON Reports**: Machine-readable detailed status
- **CSV Reports**: Spreadsheet-friendly analysis format
- **HTML Dashboard**: Visual overview with charts
- **Error Summary**: Categorized failure analysis

### Report Contents
- Success/failure statistics
- Timing and performance metrics
- Error categorization and details
- Data quality assessments
- Comparison with previous runs

## Data Validation

### Built-in Validators
- Course structure validation
- Exam data completeness checks
- URL validity verification
- Date format validation
- Required field presence

### Custom Validation
```typescript
import { DataValidator } from './core/DataValidator';

const validator = new DataValidator();
validator.addRule('custom-rule', (data) => {
  // Your validation logic
  return { valid: true, errors: [] };
});
```

## Integration with Existing Pipeline

The enhanced pipeline is designed to coexist with your existing setup:

- **Non-destructive**: Won't modify existing data files
- **Compatible**: Uses same data structures and formats
- **Configurable**: Can run alongside existing scripts
- **Modular**: Individual components can be used independently

## API Reference

### Core Classes

#### `ScrapingOrchestrator`
Main orchestration class that coordinates all scraping operations.

```typescript
const orchestrator = new ScrapingOrchestrator(config);
await orchestrator.runFullPipeline();
```

#### `CourseDiscovery`
Handles course discovery and metadata extraction.

```typescript
const discovery = new CourseDiscovery(config);
const courses = await discovery.discoverCourses();
```

#### `ExamExtractor`
Extracts exam information from course pages.

```typescript
const extractor = new ExamExtractor(config);
const exams = await extractor.extractExams(courseUrls);
```

#### `SyllabusEnricher`
Scrapes detailed syllabus information.

```typescript
const enricher = new SyllabusEnricher(config);
const syllabus = await enricher.enrichExams(examUrls);
```

### Utility Classes

#### `ErrorReporter`
Generates detailed error reports and analytics.

#### `DataValidator`
Validates scraped data against defined schemas.

#### `BackupManager`
Handles backup and restore operations.

#### `ProgressTracker`
Tracks and reports scraping progress.

## Configuration Options

### University Settings
- `university.id`: University identifier
- `university.baseUrl`: Base URL for scraping
- `university.type`: Degree type (triennale, magistrale, etc.)

### Scraping Settings
- `scraping.concurrency`: Number of concurrent requests
- `scraping.delayBetweenRequests`: Delay between requests (ms)
- `scraping.maxRetries`: Maximum retry attempts
- `scraping.retryDelay`: Base delay for exponential backoff
- `scraping.timeout`: Request timeout (ms)

### Output Settings
- `output.dataDir`: Directory for scraped data
- `output.logsDir`: Directory for log files
- `output.reportsDir`: Directory for reports
- `output.backupDir`: Directory for backups

## Error Types & Handling

### Network Errors
- Connection timeouts
- DNS resolution failures
- HTTP error codes
- Rate limiting responses

### Parsing Errors
- Missing DOM elements
- Unexpected page structure
- Invalid data formats
- Encoding issues

### Validation Errors
- Missing required fields
- Invalid data types
- Constraint violations
- Schema mismatches

## Performance Optimization

### Concurrency Control
- Configurable concurrent request limits
- Request queuing and throttling
- Smart load balancing

### Caching
- HTTP response caching
- Parsed data caching
- URL deduplication

### Memory Management
- Streaming data processing
- Garbage collection optimization
- Memory usage monitoring

## Monitoring & Alerting

### Real-time Monitoring
- Progress tracking
- Error rate monitoring
- Performance metrics
- Resource usage

### Alerting
- High error rate alerts
- Performance degradation warnings
- Data quality issues
- System resource alerts

## Troubleshooting

### Common Issues

1. **High Error Rate**
   - Check network connectivity
   - Verify university website accessibility
   - Review rate limiting settings

2. **Memory Issues**
   - Reduce concurrency settings
   - Enable streaming mode
   - Monitor memory usage

3. **Validation Failures**
   - Review data schemas
   - Check for website changes
   - Validate configuration

### Debug Mode
Enable debug logging for detailed troubleshooting:

```bash
DEBUG=agentic:* npm run agentic:full
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

This project is licensed under the ISC License.

# Individual Exam Processing

This feature allows you to process exams individually, saving each exam's detailed data as a separate JSON file. This approach provides:

1. **Resumable Processing**: If the scraping breaks, you can restart and it will continue from where it left off
2. **Individual File Access**: Each exam is saved as a separate JSON file for easy access
3. **Progress Tracking**: Clear visibility of which exams have been processed
4. **Error Isolation**: Failed exams don't affect the processing of other exams

## Prerequisites

You must have:
1. A completed Step 1 (dataCourses generation) 
2. An `*-exams-intermediate.json` file from the pipeline

## Usage

### Method 1: Using the npm script (Recommended)

```bash
# Build the project first
npm run build

# Run individual exam processing
npm run agentic:process-individual-exams <session-id>

# Example:
npm run agentic:process-individual-exams agentic-2025-07-08T17-33-34
```

### Method 2: Using the standalone script

```bash
# Build the project first
npm run build

# Run the script directly
node run-individual-exam-processing.js <session-id>

# Example:
node run-individual-exam-processing.js agentic-2025-07-08T17-33-34
```

### Method 3: Using the orchestrator programmatically

```typescript
import { ScrapingOrchestrator } from './src/agentic_magic/core/ScrapingOrchestrator';

const orchestrator = new ScrapingOrchestrator();
await orchestrator.runIndividualExamProcessing('agentic-2025-07-08T17-33-34');
```

## Output Structure

The processing creates the following structure in your session directory:

```
data/ciclounico/agentic-2025-07-08T17-33-34/
├── individual-exams/
│   ├── 11013_FILOSOFIA_DEL_DIRITTO.json
│   ├── A000178_ISTITUZIONI_DIRITTO_PRIVATO.json
│   ├── A000360_ISTITUZIONI_DIRITTO_ROMANO.json
│   └── ... (thousands of individual exam files)
├── agentic-2025-07-08T17-33-34-dataExams.json  # Final consolidated file
└── ... (other pipeline files)
```

## Individual Exam File Format

Each exam file contains:

```json
{
  "id": "A000178",
  "name": "ISTITUZIONI DIRITTO PRIVATO",
  "url": "https://...",
  "academicYear": "2025/2026",
  "semester": "Primo Semestre",
  "cfu": 12,
  "hours": 80,
  "courseId": "04181R",
  "courseName": "[04181R] GIURISPRUDENZA",
  "pathName": "PERCORSO GIUSPRIVATISTICO",
  "year": "2025/2026",
  "syllabusExtracted": true,
  "extractionTimestamp": "2025-07-09T10:30:00.000Z",
  "courseType": "Corso di Laurea Magistrale",
  "activityType": "Caratterizzante",
  "goals": "...",
  "chapters": "...",
  "books": "...",
  "requirements": "...",
  "teachingMethods": "...",
  "learningAssessment": "...",
  "extendedProgram": "...",
  "onlineResources": "...",
  "other": "..."
}
```

## Error Handling

- **Protocol errors**: Exams with connection/protocol errors are skipped and NOT saved to avoid cluttering the output
  - "Protocol error: Connection closed"
  - "WebSocket connection" errors
  - "Target closed" errors
  - Network timeout errors
- **Other errors**: Saved with `syllabusExtracted: false` and `extractionError` field for manual review
- **Missing intermediate file**: Process will exit with error message
- **Resume capability**: Re-running the script will skip already processed exams

The processor will log a summary at the end showing:
- ✅ Successfully processed exams (saved with full data)
- ⚠️ Protocol errors (skipped, not saved)
- ❌ Other errors (saved with error info for manual review)

## Configuration

The processing uses the same configuration as the main pipeline:

- **Concurrency**: Controlled by `scraping.concurrency` in config
- **Delays**: Controlled by `scraping.delayBetweenRequests`
- **Retries**: Controlled by `scraping.maxRetries` and `scraping.retryDelay`
- **Timeout**: Controlled by `scraping.timeout`

## Performance Tips

For large datasets (thousands of exams):

1. **Reduce concurrency**: Set `scraping.concurrency` to 1 in config
2. **Increase delays**: Set `scraping.delayBetweenRequests` to 2000ms or more
3. **Increase timeouts**: Set `scraping.timeout` to 90000ms or more
4. **Monitor progress**: The script shows progress with batch numbers

## Troubleshooting

### "Protocol error: Connection closed"
- Reduce concurrency to 1
- Increase delays between requests
- Increase timeout values

### "Intermediate file not found"
- Run the full pipeline first to generate the intermediate file
- Check that the session ID is correct

### "Out of memory"
- The script processes exams in batches to avoid memory issues
- If still occurring, reduce batch size in the code

## Integration with Main Pipeline

This individual processing is designed to replace Step 2 of the main pipeline:

**OLD**: Pipeline Step 2 processes all exams in memory
**NEW**: Individual processing saves each exam separately

You can integrate this into your workflow by:

1. Run Steps 1 (dataCourses generation) 
2. Run individual exam processing (this feature)
3. Use the final `*-dataExams.json` file as the result

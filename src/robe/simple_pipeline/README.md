# Simple University Scraper Pipeline

A clear, robust, and maintainable pipeline for scraping university course and exam data from Italian university catalogs (Cineca system).

## 🎯 Overview

This pipeline provides a **simple 2-step process** that handles all edge cases and produces clean, understandable data:

1. **Step 1**: Course Discovery - Finds all courses and their exam URLs
2. **Step 2**: Exam Detail Scraping - Extracts detailed information for each exam

## 🚀 Quick Start

### Run the Complete Pipeline

```bash
# Build the project
npm run build

# Run the full pipeline with default settings (UNIBS Triennale)
node dist/src/simple_pipeline/run-pipeline.js

# Or run individual steps
node dist/src/simple_pipeline/run-pipeline.js step1
node dist/src/simple_pipeline/run-pipeline.js step2 <session-directory>
```

### Configuration

Edit `src/simple_pipeline/config.ts` to change the scraping target:

```typescript
export const defaultConfig: ScrapingConfig = {
  university: 'unibs',        // 'unibs' or 'unitn'
  type: 'triennale',          // 'triennale', 'magistrale', 'ciclounico'
  url: '/corsi/2025?gruppo=1617109934164',  // Starting URL path
  numberOfYears: 5,           // Years to process
};
```

## 📊 Output

The pipeline creates a timestamped session directory in `data/` with:

- **`dataCourses.json`** - Course discovery results
- **`dataExams.json`** - Complete exam data with all details
- **`dataExams.jsonl`** - Exam data in JSONL format (one JSON per line)
- **`config.json`** - Configuration used for this run

## 🔧 Pipeline Details

### Step 1: Course Discovery

**Purpose**: Discover all courses and extract basic exam information

**Process**:
1. Scrapes the main course listing page
2. For each course, iterates through all available years
3. Handles multiple career paths (modal windows)
4. Extracts exam URLs for each course-year-path combination

**Output**: `dataCourses.json` with structure:
```json
[
  {
    "courseName": "Ingegneria Informatica",
    "year": "2024/2025",
    "path": "Percorso Generico",
    "urlCourse": "https://...",
    "urlYear": "https://...",
    "urlPath": "https://...",
    "exams": [
      {
        "id": "500036",
        "name": "Analisi Matematica I",
        "url": "https://..."
      }
    ]
  }
]
```

### Step 2: Exam Detail Scraping

**Purpose**: Extract complete detailed information for each exam

**Process**:
1. For each exam URL from Step 1
2. Handles **modules and fractions** (recursive extraction)
3. Extracts all syllabus information (content, books, goals, etc.)
4. Normalizes field names from Italian to English
5. Generates unique IDs and metadata

**Output**: `dataExams.json` with structure:
```json
[
  {
    "code": "unibs-500036-1",
    "name": "Analisi Matematica I",
    "url": "https://...",
    "universityId": "unibs",
    "cfu": 12,
    "hours": 120,
    "teachers": ["Prof. Mario Rossi"],
    "courseName": "Ingegneria Informatica",
    "year": 1,
    "module": null,
    "fraction": null,
    "chapters": "Calcolo differenziale...",
    "books": "Analisi Matematica di Bramanti...",
    "goals": "Lo studente apprenderà...",
    "requirements": "Matematica di base...",
    // ... all other fields
  }
]
```

## 🛡️ Robust Edge Case Handling

The pipeline handles all the complex cases found in university catalogs:

### Course Structure Cases
- **Simple courses**: Direct exam listing
- **Multi-path courses**: Multiple career paths (e.g., "Percorso A", "Percorso B")
- **Multi-year courses**: Different exam sets per academic year

### Exam Structure Cases
- **Simple exams**: Single exam page
- **Modular exams**: Exams split into multiple modules
- **Fractional exams**: Exams split into fractions (time periods)
- **Mixed cases**: Exams with both modules AND fractions

### Data Extraction Cases
- **Multiple field variations**: Handles different Italian field names for the same concept
- **Missing data**: Graceful handling of missing or incomplete information
- **Nested structures**: Properly extracts data from complex HTML structures
- **Encoding issues**: Proper handling of Italian characters and formatting

## 📋 Field Mapping

The pipeline automatically maps Italian field names to clean English keys:

| Italian Field | English Key | Description |
|---------------|-------------|-------------|
| Tipo di corso | courseType | Type of course |
| Anno di offerta | offerYear | Offering year |
| Contenuti | chapters | Course content/chapters |
| Testi | books | Required textbooks |
| Obiettivi formativi | goals | Learning objectives |
| Prerequisiti | requirements | Prerequisites |
| Metodi didattici | teachingMethods | Teaching methods |
| Verifica dell'apprendimento | learningAssessment | Assessment methods |

## 🔄 Reliability Features

### Error Handling
- Comprehensive try/catch blocks
- Graceful degradation for missing data
- Detailed logging of errors and progress

### Progress Saving
- Periodic saves during long operations
- Resume capability for interrupted runs
- Session-based output (never overwrites existing data)

### Respectful Scraping
- Built-in delays between requests
- Batch processing with progress tracking
- Browser resource management

## 📁 File Organization

```
src/simple_pipeline/
├── config.ts           # Configuration types and defaults
├── step1-courses.ts    # Course discovery logic
├── step2-exams.ts      # Exam detail scraping logic
├── run-pipeline.ts     # Main pipeline orchestrator
└── README.md          # This documentation

data/
└── simple-{university}-{type}-{timestamp}/
    ├── config.json         # Configuration used
    ├── dataCourses.json    # Step 1 output
    ├── dataExams.json      # Step 2 output
    └── dataExams.jsonl     # JSONL format
```

## 🆚 vs Legacy Descrapper

### Advantages of Simple Pipeline

1. **Clarity**: Clear 2-step process vs scattered numbered files
2. **Maintainability**: Well-documented, typed code
3. **Robustness**: Comprehensive error handling
4. **Safety**: Session-based output, never overwrites data
5. **Usability**: Simple configuration and execution

### Migration from Legacy

The simple pipeline produces the same data structure as the legacy descrapper's final output (steps 31 and 34), but with:
- Better field normalization
- More complete error handling
- Cleaner data structure
- Easier configuration

## 🐛 Troubleshooting

### Common Issues

**Build Errors**: Make sure TypeScript is compiled
```bash
npm run build
```

**Network Timeouts**: The pipeline includes automatic retries and delays

**Missing Data**: Check the logs - some courses may have structural differences

**Memory Issues**: For large universities, consider running steps separately:
```bash
# Run step 1 first
node dist/src/simple_pipeline/run-pipeline.js step1

# Then run step 2 with the session directory
node dist/src/simple_pipeline/run-pipeline.js step2 data/simple-unibs-triennale-TIMESTAMP
```

### Logging

All operations are logged to console with clear progress indicators:
- 🔍 Discovery operations
- 📚 Course processing
- 📂 Path processing
- ✅ Successful operations
- ❌ Error conditions

## 🔮 Future Enhancements

Potential improvements for future versions:
- Parallel processing for large datasets
- Data validation and quality checks
- Integration with database storage
- Web UI for configuration and monitoring
- Export to different formats (CSV, Excel, etc.)

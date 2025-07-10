# Raw Output Changes - IndividualExamProcessor

## Summary

Updated the `IndividualExamProcessor` to output raw, unstructured data exactly like the legacy descrapper, eliminating AI processing and structured formatting. The LLM will handle data structuring in a separate step.

## Key Changes

### 1. Raw Data Extraction
- **Before**: Tried to structure data with AI parsing for chapters, books, teachers
- **After**: Outputs raw string values directly from scraped content, no processing

### 2. Field Mapping
- Uses the exact same `keyMapping` from the legacy descrapper (`31-analysis-exams.ts`)
- Maps raw scraped fields to standardized field names
- Includes all fields: `goals`, `chapters`, `books`, `requirements`, `teachingMethods`, `learningAssessment`, etc.

### 3. Legacy Format Transformation
- `transformToLegacyFormat()` method converts exam data to exact legacy format
- Includes all legacy fields: `baseUrl`, `url`, `universityId`, `groupCode`, `code`, `courseId`, `color`, etc.
- Uses the same random color generation logic
- Handles duplicate codes with incrementing counter

### 4. Data Structure
```typescript
// Raw output (no LLM processing):
{
  "baseUrl": "https://unibs.coursecatalogue.cineca.it/...",
  "url": "https://unibs.coursecatalogue.cineca.it/...",
  "universityId": "unibs",
  "groupCode": "unibs-exam123",
  "code": "unibs-exam123-1", 
  "name": "DIRITTO COSTITUZIONALE II",
  "goals": "Gli obiettivi formativi sono la conoscenza dei principi...", // RAW STRING
  "chapters": "Il Corso affronterà i principi e gli istituti...", // RAW STRING
  "books": "A. Crosetti, D. Vaiano, Beni culturali...", // RAW STRING
  "requirements": "Conoscenza di base del diritto...", // RAW STRING
  // ... other raw fields
}
```

### 5. Removed Processing
- Eliminated `parseChaptersFromText()` - no structured chapters
- Eliminated `parseBooksFromText()` - no structured books  
- Eliminated `teachers` parsing - teachers extracted as raw strings
- All content fields remain as raw strings for LLM processing

## Benefits

1. **Exact Legacy Compatibility**: Output matches legacy descrapper format exactly
2. **No Data Loss**: Raw content preserved without AI interpretation
3. **Separation of Concerns**: Scraping vs. AI processing are now separate steps
4. **Easier Debugging**: Raw data is easier to validate and debug
5. **Future-Proof**: LLM processing can be improved without re-scraping

## Next Steps

1. Run the individual exam processing pipeline
2. Verify raw output matches legacy format
3. Apply LLM post-processing to structure the raw data
4. Compare final structured output with legacy results

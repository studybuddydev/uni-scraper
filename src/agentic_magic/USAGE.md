# Configuration
cp src/agentic_magic/config/scraping.config.example.json src/agentic_magic/config/scraping.config.json

# Build project
npm run build

# Run full pipeline
node dist/agentic_magic/scripts/run-full-pipeline.js

# Or run individual steps
node dist/agentic_magic/scripts/discover-courses.js
node dist/agentic_magic/scripts/extract-exams.js [courses-file]

# Validation and retry
node dist/agentic_magic/scripts/validate-data.js [data-file]
node dist/agentic_magic/scripts/retry-failed.js [session-id]
node dist/agentic_magic/scripts/rescrape-items.js [type] [ids...]

# Examples
node dist/agentic_magic/scripts/retry-failed.js latest
node dist/agentic_magic/scripts/rescrape-items.js course unibs05851
node dist/agentic_magic/scripts/validate-data.js ./data/agentic-2024-01-15/exams.json

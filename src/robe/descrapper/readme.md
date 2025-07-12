ts-node src/descrapper/10-courses.ts
ts-node src/descrapper/11-courses-parse.ts
ts-node src/descrapper/20-course-exams.ts
ts-node src/descrapper/21-courses-exam-parser.ts
ts-node src/descrapper/30-exams.ts

# Descrapper Pipeline

This directory contains a series of scripts to scrape course and exam data from university websites based on the CINECA catalogue system. The scripts are numbered to indicate the order of execution.

## Configuration

-   **`config.ts`**: Configures the target university (`unicode`), degree type (`type`), and number of academic years to scrape. The `scripingName` is generated from these values and used for output filenames.

## Scraping Pipeline

The pipeline is executed by running the scripts in numerical order.

1.  **`10-courses.ts`**
    -   **Purpose**: Scrapes the initial list of all degree programs for the configured university. For each degree, it finds the URLs that list the exams for each available academic year.
    -   **Output**: A JSON file named `10-courses-<scripingName>.json` containing a raw list of course names, years, study paths, and their corresponding URLs.

2.  **`11-courses-parse.ts`**
    -   **Purpose**: Parses the raw data from the previous step. It organizes the data by course, then by study path, then by academic year, creating a clean mapping to the exam list URL. It also handles and logs duplicates.
    -   **Output**: A JSON file named `11-courses-<scripingName>.json`.

3.  **`20-course-exams.ts`**
    -   **Purpose**: Iterates through the URLs generated in the previous step. For each URL (which represents the exams for a specific course/path/year), it scrapes the list of individual exams, extracting their ID, name, and URL.
    -   **Output**: A JSON file named `20-exams-<scripingName>.json` containing a nested structure of courses, paths, years, and the exams for each.

4.  **`21-courses-exam-parser.ts`**
    -   **Purpose**: Flattens the nested structure from the previous step into a simple list of unique exams. It deduplicates exams based on their URL.
    -   **Output**: A JSON file named `21-exams-<scripingName>.json`. This serves as a manifest of all exams to be scraped in detail.

5.  **`30-exams.ts`**
    -   **Purpose**: Scrapes the detailed syllabus for each exam URL from the manifest file. It handles complex exams with modules or fractions (sub-exams). It includes batching and retry logic to manage the large number of requests.
    -   **Output**: A JSON file named `30-exams-<scripingName>.json` where keys are exam URLs and values are the scraped raw syllabus data.

6.  **`31-analysis-exams.ts`**
    -   **Purpose**: Parses the raw syllabus data from the previous step. It maps the Italian field names to a standardized English schema (e.g., `Contenuti` -> `chapters`), assigns unique IDs, and structures the data.
    -   **Output**: Two files: `31-exams-<scripingName>.json` and `31-exams-<scripingName>.jsonl`.

7.  **`32-analysis-courses.ts`**
    -   **Purpose**: Links the processed exams back to their parent courses. It creates a final course structure containing the course details and a list of its exam IDs, grouped by year.
    -   **Output**: A JSON file named `32-courseexams-<scripingName>.json`.

8.  **`33-data-exams-with-AI.ts`**
    -   **Purpose**: Enriches the exam data using an AI model. It reads the JSONL file from step 6, sends the unstructured "chapters" text to the OpenAI API, and parses the structured response back into the exam object.
    -   **Output**: The final, enriched exam data in both JSON and JSONL formats: `33-dataExams-<scripingName>.json` and `33-dataExams-<scripingName>.jsonl`.

9.  **`34-data-courses.ts`**
    -   **Purpose**: Validates the final data. It compares the courses and their expected exams with the exams that were successfully processed, generating a list of any missing exams. It also creates the final, clean `DataCourse` file.
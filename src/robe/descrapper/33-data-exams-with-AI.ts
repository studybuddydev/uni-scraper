import puppeteer from 'puppeteer';
import fs from 'fs';
import readline from 'readline';
import { config } from './config';
import 'dotenv/config'
import OpenAI from "openai";
const client = new OpenAI(
    {
        apiKey: process.env.OPENAI_API_KEY,
    }
);
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { parse } from 'path';


const title = config.scripingName;

interface DataExamRaw {
    baseUrl: string;
    url: string;
    universityId: string;
    groupCode: string;
    code: string;
    courseId: string;
    name: string;
    lastUpdated: string;
    deleted: string | null;
    fraction: string | null;
    module: string | null;
    color: string;
    cfu: number;
    hours: number | null;
    teachers: string[];
    courseName: string;
    coursePath: string | null;
    year: number;
    courseType: string;
    offerYear: string;
    activityType: string;
    field: string;
    language: string;
    teachingActivityType: string;
    teachingPeriod: string;
    teachingMode: string;
    disciplinarySector: string;
    location: string;
    chapters: string;
    books: string;
    goals: string;
    requirements: string;
    teachingMethods: string;
    learningAssessment: string;
    other: string;
}

interface DataExam {
    id: string;
    parentExam: string;
    universityId: string;
    course: string;
    courseId: string;
    name: string;
    lastUpdated: string;
    deleted: string | null;
    goals: string;
    chapters: {
        name: string;
        showTasks: boolean;
        tasks: {
            name: string;
        }[];
        postIts: {
            color: string;
            content: string;
        }[];
        links: any[];
    }[];
    urls: {
        name: string;
        url: string;
    }[];
    icon: string;
    color: string;
    examMode: string;
    requirements: string;
    cfu: string;
    language: string;
    teachers: {
        name: string;
    }[];
    books: {
        books: {
            name: string;
            authors: string[];
            year: number;
            notes: string[];
        }[];
    };
}

async function readJsonlFile(filePath: string): Promise<DataExamRaw[]> {
    const exams: DataExamRaw[] = [];

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.trim()) {
            try {
                const data = JSON.parse(line);
            
                exams.push(data);
                console.log(`Parsed exam: ${data.name}, ${data.chapters}`);
            } catch (error) {
                console.error(`Error parsing line: ${line}`);
            }
        }
    }

    return exams;
}

// Helper function for delay
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function transformExam(exam: DataExamRaw): Promise<DataExam | null> {

    console.log(`Transforming exam ${exam.chapters} ...`);
    try {
        const generatedChaptersArray = await generateChapters(exam.chapters);
        
        return {
            id: `${config.unicode}-${exam.code}`,
            parentExam: exam.groupCode ? `${config.unicode}-${exam.groupCode}` : '',
            universityId: config.unicode,
            course: exam.courseName,
            courseId: exam.courseId,
            name: exam.name,
            lastUpdated: new Date().toISOString(),
            deleted: exam.deleted,
            goals: exam.goals,
            chapters: generatedChaptersArray,
            urls: [
                {
                    name: 'Syllabus',
                    url: exam.url
                }
            ],
            icon: '',
            color: exam.color,
            examMode: exam.learningAssessment,
            requirements: exam.requirements,
            cfu: String(exam.cfu),
            language: exam.language,
            teachers: exam.teachers.map(teacher => ({ name: teacher })),
            books: {
                books: []
            }
        };
    } catch (error) {
        console.error(`Error during transformation of exam ${exam.code} (${exam.name}):`, error);
        return null; 
    }
}

async function processExams() {
    try {
        const inputFile = `./data/${title}/31-exams-${title}.jsonl`;
        const outputFile = `./data/${title}/33-dataExams-${title}.jsonl`;

        console.log(`Reading exams from ${inputFile}...`);
        const exams = await readJsonlFile(inputFile);
        console.log(`Found ${exams.length} exams.`);

        

        // API limits: gpt-4o-mini 500 RPM.
        // Batch size of 5. Delay of 1000ms (1 second).
        // This means 5 requests per second, translating to 300 RPM. This is well within limits.
        const BATCH_SIZE = 5; 
        const DELAY_BETWEEN_BATCHES_MS = 1000; 

        const allTransformedExams: DataExam[] = [];
        let successfullyProcessedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < exams.length; i += BATCH_SIZE) {
            const batchExams = exams.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch starting with exam ${i + 1} of ${exams.length}. Batch size: ${batchExams.length}.`);

            const batchPromises = batchExams.map(exam => transformExam(exam));
            
            const results = await Promise.allSettled(batchPromises);

            results.forEach((result, index) => {
                const originalExamIndex = i + index; // Get the actual index from the original exams array
                if (result.status === 'fulfilled') {
                    if (result.value) {
                        allTransformedExams.push(result.value);
                        successfullyProcessedCount++;
                        // Log success for individual exam if needed, or rely on batch summary
                    } else {
                        // transformExam resolved with null (handled error internally)
                        failedCount++;
                        console.warn(`Transformation returned null for exam ${originalExamIndex + 1}/${exams.length}: ${exams[originalExamIndex].name}`);
                    }
                } else { // status === 'rejected'
                    failedCount++;
                    console.error(`Error processing exam ${originalExamIndex + 1}/${exams.length}: ${exams[originalExamIndex].name}. Reason:`, result.reason);
                }
            });
            
            console.log(`Batch finished. Processed ${i + batchExams.length} of ${exams.length} exams. So far: ${successfullyProcessedCount} successful, ${failedCount} failed.`);

            if (i + BATCH_SIZE < exams.length) {
                console.log(`Waiting for ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
                await delay(DELAY_BETWEEN_BATCHES_MS);
            }
        }

        console.log(`Total exams processed: ${successfullyProcessedCount} successfully, ${failedCount} failed.`);

        // Save as JSON
        fs.writeFileSync(`./data/${title}/33-dataExams-${title}.json`, JSON.stringify(allTransformedExams, null, 2));
        console.log('End json');

        // Save as JSONL
        const outputStream = fs.createWriteStream(outputFile);
        for (const exam of allTransformedExams) {
            outputStream.write(JSON.stringify(exam) + '\n');
        }
        outputStream.end();
        console.log('End jsonl');

        return allTransformedExams;
    } catch (error) {
        console.error('Overall error in processExams:', error);
        return [];
    }
}

async function generateChapters(chaptersText: string): Promise<DataExam['chapters']> {
    if (!chaptersText || chaptersText.trim() === "") {
        console.log('Chapters text is empty, returning empty array for chapters. ' + chaptersText);
        return [];
    }

    const systemPrompt = `
    You are a helpful and precise assistant for university students. Your task is to analyze course material (e.g., notes, summaries, or outlines) and extract a structured list of chapters and their optional subchapters.

    Instructions:
    - Only extract real chapter and subchapter titles. Do not include decorative lines, symbols, or empty sections (e.g., "=====", "---", "###", etc.).
    - Return the result as a JSON object in the following format:

    {
    "chapters": [
        {
        "name": "Chapter title",
        "showTasks": false,
        "tasks": [{"name": "Subchapter 1"}, {"name": "Subchapter 2"}],
        "postIts": [],
        "links": []
        },
        ...
    ]
    }

    - If a chapter contains subtopics or bullet points that represent subchapters, include them in the tasks array as objects like {"name": "Subchapter 1"}.
    - If a chapter has no subchapters, leave tasks as an empty array.
    - balance the number of chapters and suchapters it makes no sense to have 1 chapter with 10 subchapters.
    - Always keep postIts and links as empty arrays.
    - Never invent or guess chapter names. Only extract what's clearly written in the text.
    - If no chapters are found, return: { "chapters": [] }

    The goal is to help students organize and study their course material clearly and accurately.
    `;
    const userPrompt = `Chapters: ${chaptersText}`;

    const chapterSchema = z.object({
        chapters: z.array(z.object({
            name: z.string(),
            showTasks: z.boolean(),
            tasks: z.array(z.object({
                name: z.string()
            })),
            postIts: z.array(z.object({ // Assuming empty array, but schema allows content
                color: z.string(),
                content: z.string()
            })),
            links: z.array(z.object({ // Assuming empty array, but schema allows content
                name: z.string(),
                url: z.string()
            }))
        }))
    });


    try {
        const response = await client.responses.parse({
            model: "gpt-4o-mini",
            input: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: userPrompt,
                },
            ],
            text: {
                format: zodTextFormat(chapterSchema, "chapters"),
            },
        });

        const parsedOutput = response.output_parsed;

        if (parsedOutput === null || !parsedOutput.chapters) {
            console.log('Parsed chapters is null or chapters array is missing from OpenAI response, returning empty array.');
            return [];
        }
        return parsedOutput.chapters;
    } catch (error) {
        console.error("Error calling OpenAI API or parsing response in generateChapters:", error);
        return []; // Return empty array on error to allow other exams to process
    }
}

// Run the process
processExams();

export { processExams, readJsonlFile, transformExam };

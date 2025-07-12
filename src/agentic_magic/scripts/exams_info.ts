import { readdir, readFile } from 'fs/promises';
import path from 'path';

const EXAMS_FOLDER_PATH = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/ciclounico/agentic-2025-07-08T17-33-34/individual-exams';
async function readExamFiles() {
    try {
        // Get all files in the directory
        const files = await readdir(EXAMS_FOLDER_PATH);
        
        // Read each file and store its content
        const examsData = await Promise.all(
            files.map(async (filename) => {
                const filePath = path.join(EXAMS_FOLDER_PATH, filename);
                const content = await readFile(filePath, 'utf-8');
                
                try {
                    // Parse JSON content
                    const examData = JSON.parse(content);
                    return {
                        filename,
                        data: examData
                    };
                } catch (parseError) {
                    console.error(`Error parsing ${filename}:`);
                    return {
                        filename,
                        data: null,
                        error: 'Parse error'
                    };
                }
            })
        );
        
        console.log(`Successfully read ${examsData.filter(exam => !exam.error).length} exam files.`);
        return examsData;
    } catch (error) {
        console.error('Error reading exam files:', error);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        const exams = await readExamFiles();
        // Count exams with empty requirements
        const emptyRequirementsCount = exams.filter(exam => 
            exam.data && 
            (!exam.data.requirements || 
             exam.data.requirements === '' || 
             (Array.isArray(exam.data.requirements) && exam.data.requirements.length === 0))
        ).length;
        
        console.log(`Total exams read: ${exams.length}`);
        console.log(`Exams with empty requirements: ${emptyRequirementsCount}`);
    } catch (error) {
        console.error('Failed to process exams:', error);
    }
}

main();
// Import the JSON file
import degrees from '/Users/alessiogandelli/dev/studybuddy/uni-scraper/unibs.json';
import fs from 'fs';


// Type definitions
type Exam = {
    title: string;
    cfu: string;
    hours: string;
    semester: string;
};

type YearlyExams = {
    year: string;
    exams: Exam[];
};

type Degree = {
    title: string;
    examsByYear: YearlyExams[];
};

// Helper function to check if the exam should be included
function shouldIncludeExam(exam: Exam, seenTitles: Set<string>): boolean {
    if (exam.title.trim() === "") {
        return false; // Remove exams with empty titles
    }
    if (seenTitles.has(exam.title)) {
        return false; // Remove duplicate exams
    }
    seenTitles.add(exam.title);
    return true;
}

// Main function to remove duplicates and empty titles from a single degree
function removeDuplicatesAndEmptyTitles(course: Degree): Degree {
    const seenTitles = new Set<string>();

    course.examsByYear.forEach((yearlyExams) => {
        yearlyExams.exams = yearlyExams.exams.filter((exam) => shouldIncludeExam(exam, seenTitles));
    });

    return course;
}

// Function to clean all degrees
export function cleanAllDegrees(degrees: Degree[]): Degree[] {
    return degrees.map(removeDuplicatesAndEmptyTitles);
}

// Clean the imported degrees
//const cleanedDegrees = cleanAllDegrees(degrees);

// Log the cleaned data

//fs.writeFileSync('./data/unibs.json', JSON.stringify(cleanedDegrees, null, 2), 'utf8');
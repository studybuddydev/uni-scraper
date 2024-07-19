import * as fs from 'fs';
import * as path from 'path';

interface Exam {
    title: string;
    id: string;
    href: string;
    cfu: string;
    hours: string;
    semester: string;
    annoDiOfferta: string;
    year: number;
}

interface Course {
    name: string;
    id: string;
    uni: string;
    exams: Exam[];
}

interface SummaryCourse {
    name: string;
    code: string;
}

interface Summary {
    name: string;
    id: string;
    corsi: SummaryCourse[];
}

const readJsonFiles = (folderPath: string): Course[] => {
    const files = fs.readdirSync(folderPath);
    let courses: Course[] = [];

    files.forEach(file => {
        const filePath = path.join(folderPath, file);
        if (path.extname(filePath) === '.json') {
            const data = fs.readFileSync(filePath, 'utf8');
            const course: Course = JSON.parse(data);
          
            courses = courses.concat(course);
            
        }
    });

    return courses;
};

const generateSummary = (courses: Course[]): Summary => {
    const summaryCourses: SummaryCourse[] = courses.map(course => ({
        name: course.name,
        code: course.id
    }));

    return {
        name: "Università di Trento",
        id: "unitn",
        corsi: summaryCourses
    };
};

const folderPath = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unitn';  // Replace with the path to your folder containing JSON files
const courses = readJsonFiles(folderPath);

fs.writeFileSync('./data/unitn_esami.json', JSON.stringify(courses, null, 2));

const summary = generateSummary(courses);


fs.writeFileSync('./data/unitn.json', JSON.stringify(summary, null, 2));

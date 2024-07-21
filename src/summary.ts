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
interface newExam {
    title: string;
    id: string;
    url: string;
    cfu: number;
    hours: number;
    semester: string;
    teachingYear: string;
    year: number;
}

interface Course {
    name: string;
    id: string;
    uni: string;
    exams: Exam[];
}
interface newCourse {
    name: string;
    id: string;
    uni: string;
    exams: newExam[];
}

interface SummaryCourse {
    name: string;
    code: string;
}

interface Summary {
    name: string;
    id: string;
    courses: SummaryCourse[];
}

const readJsonFiles = (folderPath: string): newCourse[] => {
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

    const cleanCourses = cleanExams(courses)

    return cleanCourses;
};

const generateSummary = (courses: newCourse[], uniName:string): Summary => {
    const summaryCourses: SummaryCourse[] = courses.map(course => ({
        name: course.name,
        code: course.id
    }));

    const extendedNames: {[key:string]:string} = {
        unitn: "Università di Trento",
        unibs: "Università di Brescia"
    };

    return {
        name: extendedNames[uniName],
        id: uniName,
        courses: summaryCourses
    };
};


function cleanExams(courses: Course[]) {

    const newCourses = []
    

    for (const course of courses) {


        let newCourse: newCourse = {
            name: course.name,
            id: course.id,
            uni: course.uni,
            exams: []
        }


        let newExams = []

        for (const exam of course.exams) {

            let newExam: newExam = {
                title : exam.title,
                id: exam.id,
                url: exam.href,
                cfu: parseInt(exam.cfu.replace('CFU', '')),
                hours: parseInt(exam.hours.replace('ore', '')),
                semester: exam.semester,
                teachingYear: exam.annoDiOfferta.replace('Anno di offerta ', ''),
                year: exam.year

            }

            newExams.push(newExam)


        }

        newCourse.exams = newExams

        newCourses.push(newCourse)

    }

    return newCourses



}



function main(folderPath:string, uniName:string){

    console.log(uniName);
    

    const courses = readJsonFiles(folderPath);

    fs.writeFileSync(`./data/${uniName}_esami.json`, JSON.stringify(courses, null, 2));

    const summary = generateSummary(courses, uniName);

    fs.writeFileSync(`./data/${uniName}.json`, JSON.stringify(summary, null, 2));
}



const folderPathbs = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs';  // Replace with the path to your folder containing JSON files

const folderPathtn = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unitn';  // Replace with the path to your folder containing JSON files

main(folderPathbs, 'unibs')
main(folderPathtn, 'unitn')
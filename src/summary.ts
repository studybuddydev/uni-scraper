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
    type: string;
}

interface DataCourse {
    id: string;
    universityId: string;
    name: string;
    lastUpdated: Date;
    deleted: Date | null;

    description?: string;
    goals?: string;
    requirements?: string;

    exams?: {
        examId: string;
        year?: string;
        semester?: string;
    }[];
    urls?: {
        name: string;
        url: string;
    }[];

    type?: string;
    language?: string;
    accessMode?: string;
    deparment?: string;
    note?: string;
}

interface SummaryCourse {
    name: string;
    code: string;
    type:string;
}

interface DataUniversities {
    id: string;
    name: string;
    lastUpdated: Date;
    deleted: Date | null;

    description?: string;
    urls?: {
        name: string;
        url: string;
    }[];
    courseIds?: string[];
    note?: string;
}




const createDataCourse = (folderPath: string): DataCourse[] => {
    const files = fs.readdirSync(folderPath);
    let courses: Course[] = [];


    files.forEach(file => {
        const filePath = path.join(folderPath, file);
        if (path.extname(filePath) === '.json') {
            const type = filePath.includes('triennali') ? 'triennale' :
              filePath.includes('magistrali') ? 'magistrale' :
              filePath.includes('Unico') ? 'cicloUnico' :
              'unknown'; // Default value if none of the conditions are met
            
            const data = fs.readFileSync(filePath, 'utf8');
            const course: Course[] = JSON.parse(data);
            for(let c of course){
                c.type = type
            }
            courses = courses.concat(course);
        }
    });

   
    

    const cleanCourses = cleanExams(courses)

    return cleanCourses;
};


const createDataUni = (courses: DataCourse[], uniName:string): DataUniversities => {
    // const summaryCourses: SummaryCourse[] = courses.map(course => ({
    //     name: course.name,
    //     code: course.id,
    //     type: course.type
    // }));

    const extendedNames: {[key:string]:string} = {
        unitn: "Università di Trento",
        unibs: "Università di Brescia"
    };

    return {
        id: uniName,
        name: extendedNames[uniName],
        lastUpdated: new Date(),
        deleted: null,
        courseIds: courses.map(course => course.id)
    };
};


function cleanExams(courses: Course[]) {

    const newCourses = []
    

    for (const course of courses) {


        let newCourse: DataCourse = {
            id: course.id,
            universityId: course.uni,
            name: course.name,
            lastUpdated: new Date(),
            deleted: null,

            type: course.type,
            exams: [],
           
        }


        let newExams = []

        for (const exam of course.exams) {

            let newExam = {
                examId: exam.id,
                year: exam.year + '',
                semester: exam.semester,
                url: exam.href

            }

            newExams.push(newExam)


        }

        newCourse.exams = newExams

        newCourses.push(newCourse)

    }
    //console.log(newCourses);
    

    return newCourses



}

function createDataExam(folderPath:string){
    const files = fs.readdirSync(folderPath);
    let exams:any = [];

    
    

    files.forEach(file => {
        const filePath = path.join(folderPath, file);
        if (path.extname(filePath) === '.json') {
            
            
            const data = fs.readFileSync(filePath, 'utf8');
            const course: Course[] = JSON.parse(data);

            exams = exams.concat(course);
        }
    });


    

    return exams
}



function main(folderPath:string, uniName:string){

    console.log(uniName);
    const folderExams = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/syllabus'
    

    const courses = createDataCourse(folderPath);

    fs.writeFileSync(`./data/${uniName}_courses.json`, JSON.stringify(courses, null, 2));

    const summary = createDataUni(courses, uniName);

    fs.writeFileSync(`./data/${uniName}.json`, JSON.stringify(summary, null, 2));

    const exams = createDataExam(folderExams)
    console.log(JSON.stringify(exams, null, 2));
    

    fs.writeFileSync(`./data/${uniName}_exams.json`, JSON.stringify(exams, null, 2));
}



const folderPathbs = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs';  // Replace with the path to your folder containing JSON files

const folderPathtn = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unitn';  // Replace with the path to your folder containing JSON files

main(folderPathbs, 'unibs')
main(folderPathtn, 'unitn')
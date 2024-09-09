import * as fs from 'fs';
import * as path from 'path';




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


    const uniqueExams = Array.from(new Map(exams.map((exam:any) => [exam.id, exam])).values());

    

    return uniqueExams
}


function createAvailableDataCourse(fileExams: string) {

    const pathCourses = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/unibs_courses.json';

    const allCoursesFile = fs.readFileSync(pathCourses, 'utf8');
    const allcourses: DataCourse[] = JSON.parse(allCoursesFile);

    const data = fs.readFileSync(fileExams, 'utf8');
    const exams: DataExam[] = JSON.parse(data);

    let courses: DataCourse[] = [];

    for (const course of allcourses) {

        let newCourse: DataCourse = {
            id: course.id,
            universityId: course.universityId,
            name: course.name,
            lastUpdated: new Date(),
            deleted: null,
            exams: [],
            type: course.type
        }

        for (const exam of course.exams??[]) {
  

            let newExam = {
                examId: exam.examId,
                year: exam.year,
                semester: exam.semester
            }

            if (exams.find(e => e.id === exam.examId)) {
                newCourse.exams?.push(newExam)
            }

            // find all exams with the same id
            const relatedExams = exams.filter(e => e.parentExam === exam.examId);

            for (const relatedExam of relatedExams) {
                let newRelatedExam = {
                    examId: relatedExam.id,
                    parentExam: relatedExam.parentExam?? undefined,
                    year: exam.year,
                    semester: exam.semester

                }
                newCourse.exams?.push(newRelatedExam)
            }
            

        }
        if (newCourse.exams?.length?? 0 > 0) {
            courses.push(newCourse);
        }

    }

    return courses;

}




function main(folderPath:string, uniName:string){

    

    //create dataexams
    const folderExams = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/syllabus'
    const exams = createDataExam(folderExams)
    const fileExams = `./data/DataExams.json`
    fs.writeFileSync(fileExams, JSON.stringify(exams, null, 2));

    
    const courses = createAvailableDataCourse(fileExams);

    fs.writeFileSync(`./data/DataCourses.json`, JSON.stringify(courses, null, 2));

    const summary = createDataUni(courses, uniName);

    fs.writeFileSync(`./data/${uniName}.json`, JSON.stringify(summary, null, 2));
}





const folderPathbs = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs';  // Replace with the path to your folder containing JSON files

const folderPathtn = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unitn';  // Replace with the path to your folder containing JSON files

main(folderPathbs, 'unibs')
//main(folderPathtn, 'unitn')
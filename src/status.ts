

import fs from 'fs';
const pathCourses = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/unibs_courses.json';

const allCoursesFile = fs.readFileSync(pathCourses, 'utf8');
const allcourses: DataCourse[] = JSON.parse(allCoursesFile);



// create an objext with course name and number of exams
let courses: any = [];


for (const course of allcourses) {
    
    courses.push({
        name: course.name,
        exams: course.exams?.length ?? 0
    })
}

console.log(courses);




import fs from 'fs';

const path = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/unibs_courses.json';

const allCoursesFile = fs.readFileSync(path, 'utf8');


const allcourses = JSON.parse(allCoursesFile);

// create a dictionary that maps course id to course name
let course_id_to_name: { [id: string]: string } = {};

for (const course of allcourses) {
    course_id_to_name[course.id] = course.name;
}


//save file 

fs.writeFileSync('/Users/alessiogandelli/dev/studybuddy/uni-scraper/data/unibs/course_id_to_name.json', JSON.stringify(course_id_to_name, null, 2));




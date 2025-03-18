import puppeteer from 'puppeteer';
import fs from 'fs';

function doFile(title: string) {
  const filename = `./data/10-courses-${title}.json`;
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));

  // --  START COURSES
  const courses: any = {}
  for (const x of data) {
    if (!courses[x.courseName]) courses[x.courseName] = new Set()
    courses[x.courseName].add(x.urlCourse)
  }
  // check if duplicates
  for (const x in courses) {
    if (courses[x].size > 1) {
      console.log('DUPLICATE COURSE:', x, courses[x])
      delete courses[x]
    } else {
      courses[x] = Array.from(courses[x])[0]
    }
  }
  // console.log('courses:', courses)
  // --  END COURSES

  // --  START PATHS YEARS
  const yearMapping: any = { '2025/2026': 0, '2024/2025': 1, '2023/2024': 2, '2022/2023': 3, '2021/2022': 4, '2020/2021': 5, '2019/2020': 6, '2018/2019': 7, '2017/2018': 8, '2016/2017': 9, '2015/2016': 10 }
  const pathsyears: any = {}
  for (const x of data) {
    const yearMapped = yearMapping[x.year]
    if (!pathsyears[x.courseName]) pathsyears[x.courseName] = {}
    if (!pathsyears[x.courseName][x.path]) pathsyears[x.courseName][x.path] = {}
    if (!pathsyears[x.courseName][x.path][yearMapped]) pathsyears[x.courseName][x.path][yearMapped] = new Set()
    pathsyears[x.courseName][x.path][yearMapped].add({ year: x.year, url: x.urlPath })
  }
  // check if duplicates
  for (const x in pathsyears) {
    for (const y in pathsyears[x]) {
      for (const z in pathsyears[x][y]) {
        if (pathsyears[x][y][z].size > 1) {
          console.log('DUPLICATE PATH YEAR:', x, y, z, pathsyears[x][y][z])
          delete pathsyears[x][y][z]
        } else {
          pathsyears[x][y][z] = Array.from(pathsyears[x][y][z])[0]
        }
      }
    }
  }
  // console.log('pathsyear:', pathsyears)
  // --  END PATHS YEARS

  const res = { courses, pathsyears }
  fs.writeFileSync(`./data/11-courses-${title}.json`, JSON.stringify(res, null, 2));
}

doFile('triennaliUNITN');

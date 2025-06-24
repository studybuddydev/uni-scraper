import fs from 'fs';
import path from 'path';
import { ScrapingConfig } from '../types';
import { Logger } from '../utils/Logger';

interface RawCourseData {
  courseName: string;
  year: string;
  path: string;
  urlCourse: string;
  urlYear: string;
  urlPath: string;
}

interface ProcessedCourseData {
  courses: { [courseName: string]: string };
  pathsyears: {
    [courseName: string]: {
      [pathName: string]: {
        [year: string]: string;
      };
    };
  };
}

export class CourseDataProcessor {
  private config: ScrapingConfig;
  private logger: Logger;

  constructor(config: ScrapingConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  public processRawCourseData(rawDataPath: string, sessionId: string): ProcessedCourseData {
    this.logger.info(`Processing raw course data from: ${rawDataPath}`);
    
    if (!fs.existsSync(rawDataPath)) {
      throw new Error(`Raw course data file not found: ${rawDataPath}`);
    }

    const rawData: RawCourseData[] = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));
    this.logger.info(`Loaded ${rawData.length} raw course entries`);

    // Process courses (deduplicate by course name)
    const courses: any = {};
    for (const entry of rawData) {
      if (!courses[entry.courseName]) {
        courses[entry.courseName] = new Set();
      }
      courses[entry.courseName].add(entry.urlCourse);
    }

    // Check for duplicates and resolve
    for (const courseName in courses) {
      if (courses[courseName].size > 1) {
        this.logger.warn(`DUPLICATE COURSE: ${courseName}`, Array.from(courses[courseName]));
        delete courses[courseName];
      } else {
        courses[courseName] = Array.from(courses[courseName])[0];
      }
    }

    this.logger.info(`Processed ${Object.keys(courses).length} unique courses`);

    // Process paths and years
    const pathsyears: any = {};
    for (const entry of rawData) {
      const year = entry.year;
      const pathName = entry.path.length > 0 ? entry.path : 'NA';
      
      if (!pathsyears[entry.courseName]) {
        pathsyears[entry.courseName] = {};
      }
      if (!pathsyears[entry.courseName][pathName]) {
        pathsyears[entry.courseName][pathName] = {};
      }
      if (!pathsyears[entry.courseName][pathName][year]) {
        pathsyears[entry.courseName][pathName][year] = new Set();
      }
      pathsyears[entry.courseName][pathName][year].add(entry.urlPath);
    }

    // Check for duplicates and resolve
    let totalPathYears = 0;
    for (const courseName in pathsyears) {
      for (const pathName in pathsyears[courseName]) {
        for (const year in pathsyears[courseName][pathName]) {
          if (pathsyears[courseName][pathName][year].size > 1) {
            this.logger.warn(`DUPLICATE PATH YEAR: ${courseName} - ${pathName} - ${year}`, Array.from(pathsyears[courseName][pathName][year]));
            delete pathsyears[courseName][pathName][year];
          } else {
            pathsyears[courseName][pathName][year] = Array.from(pathsyears[courseName][pathName][year])[0];
            totalPathYears++;
          }
        }
      }
    }

    this.logger.info(`Processed ${totalPathYears} course/path/year combinations`);

    const result: ProcessedCourseData = { courses, pathsyears };
    
    // Save the processed data in the SESSION directory, not the university directory
    const sessionDataDir = path.dirname(rawDataPath); // Use same directory as raw data
    const outputPath = path.join(sessionDataDir, `${sessionId}-courses-processed.json`);
    
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    this.logger.info(`Processed course data saved to: ${outputPath}`);

    return result;
  }
}

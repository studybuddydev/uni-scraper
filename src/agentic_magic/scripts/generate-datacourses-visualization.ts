#!/usr/bin/env node

/**
 * DataCourses Visualization Generator
 * 
 * This script creates an HTML visualization of the dataCourses.json file
 * to help validate the scraping results and see course/exam structure.
 */

import fs from 'fs';
import path from 'path';

interface GenerateVisualizationOptions {
  sessionDir?: string;
  outputPath?: string;
  openInBrowser?: boolean;
}

class DataCoursesVisualizationGenerator {
  private sessionDir: string;
  private outputPath: string;

  constructor(options: GenerateVisualizationOptions = {}) {
    // Use the specific file path you mentioned
    if (!options.sessionDir) {
      this.sessionDir = './data/agentic-2025-06-25T18-14-14';
    } else {
      this.sessionDir = options.sessionDir;
    }
    
    this.outputPath = options.outputPath || path.join(this.sessionDir, 'dataCourses-visualization.html');
    
    if (!this.sessionDir) {
      throw new Error('No session directory found. Please run the scraping pipeline first.');
    }
  }

  private findLatestSession(): string {
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) {
      throw new Error('Data directory not found');
    }

    const sessions = fs.readdirSync(dataDir)
      .filter(name => name.startsWith('agentic-'))
      .sort()
      .reverse();

    if (sessions.length === 0) {
      throw new Error('No agentic sessions found');
    }

    return path.join(dataDir, sessions[0]);
  }

  private findDataCoursesFile(): string {
    const exactFileName = `agentic-2025-06-25T18-14-14-dataCourses.json`;
    const exactFilePath = path.join(this.sessionDir, exactFileName);
    
    if (fs.existsSync(exactFilePath)) {
      return exactFileName;
    }

    // Fallback to other possible files
    const possibleFiles = [
      `dataCourses.json`,
      `${path.basename(this.sessionDir)}-dataCourses.json`,
      `${path.basename(this.sessionDir)}-5-dataCourses.json`
    ];

    for (const fileName of possibleFiles) {
      const filePath = path.join(this.sessionDir, fileName);
      if (fs.existsSync(filePath)) {
        return fileName;
      }
    }

    throw new Error(`No dataCourses.json file found in ${this.sessionDir}. Available files: ${fs.readdirSync(this.sessionDir).join(', ')}`);
  }

  private generateVisualizationHTML(dataFileName: string): string {
    const templatePath = path.resolve('./src/agentic_magic/visualization/dataCourses-viewer.html');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    
    // Update the data URL in the script
    htmlContent = htmlContent.replace(
      /const DATA_URL = '[^']*';/,
      `const DATA_URL = './${dataFileName}';`
    );

    // Update the title with session info
    const sessionName = path.basename(this.sessionDir);
    htmlContent = htmlContent.replace(
      '<title>DataCourses Visualization</title>',
      `<title>DataCourses Visualization - ${sessionName}</title>`
    );

    htmlContent = htmlContent.replace(
      '<h1>📚 DataCourses Analysis</h1>',
      `<h1>📚 DataCourses Analysis</h1><p style="font-size: 0.9em; opacity: 0.8;">${sessionName}</p>`
    );

    return htmlContent;
  }

  private analyzeDataCourses(dataCoursesPath: string): any {
    const data = JSON.parse(fs.readFileSync(dataCoursesPath, 'utf8'));
    
    const analysis = {
      totalCourses: data.length,
      totalExams: 0,
      totalCFU: 0,
      coursesByType: {} as { [key: string]: number },
      examsByYear: {} as { [key: string]: number },
      examsBySemester: {} as { [key: string]: number },
      missingData: {
        coursesWithoutExams: 0,
        examsWithoutCFU: 0,
        examsWithoutYear: 0,
        examsWithoutSemester: 0
      }
    };

    data.forEach((course: any) => {
      // Count by type
      const type = course.type || 'unknown';
      analysis.coursesByType[type] = (analysis.coursesByType[type] || 0) + 1;

      // Analyze exams
      const exams = course.exams || [];
      if (exams.length === 0) {
        analysis.missingData.coursesWithoutExams++;
      }

      exams.forEach((exam: any) => {
        analysis.totalExams++;
        
        const cfu = exam.CFU || 0;
        analysis.totalCFU += cfu;
        
        if (!cfu) analysis.missingData.examsWithoutCFU++;
        if (!exam.year) analysis.missingData.examsWithoutYear++;
        if (!exam.semester) analysis.missingData.examsWithoutSemester++;

        // Count by year
        const year = exam.year || 'unknown';
        analysis.examsByYear[year] = (analysis.examsByYear[year] || 0) + 1;

        // Count by semester
        const semester = exam.semester || 'unknown';
        analysis.examsBySemester[semester] = (analysis.examsBySemester[semester] || 0) + 1;
      });
    });

    return analysis;
  }

  public generate(): string {
    console.log('🎨 Generating DataCourses Visualization...');
    console.log(`📁 Session: ${this.sessionDir}`);

    // Find the dataCourses file
    const dataFileName = this.findDataCoursesFile();
    const dataFilePath = path.join(this.sessionDir, dataFileName);
    
    console.log(`📊 Data file: ${dataFileName}`);

    // Analyze the data
    const analysis = this.analyzeDataCourses(dataFilePath);
    
    console.log('');
    console.log('📈 DATA ANALYSIS:');
    console.log(`   📚 Total Courses: ${analysis.totalCourses}`);
    console.log(`   📝 Total Exams: ${analysis.totalExams}`);
    console.log(`   🎯 Total CFU: ${analysis.totalCFU}`);
    console.log('');
    
    if (Object.keys(analysis.coursesByType).length > 1) {
      console.log('📋 Courses by Type:');
      Object.entries(analysis.coursesByType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
      console.log('');
    }

    if (analysis.missingData.coursesWithoutExams > 0 || 
        analysis.missingData.examsWithoutCFU > 0 || 
        analysis.missingData.examsWithoutYear > 0 || 
        analysis.missingData.examsWithoutSemester > 0) {
      console.log('⚠️  MISSING DATA DETECTED:');
      if (analysis.missingData.coursesWithoutExams > 0) {
        console.log(`   📚 Courses without exams: ${analysis.missingData.coursesWithoutExams}`);
      }
      if (analysis.missingData.examsWithoutCFU > 0) {
        console.log(`   🎯 Exams without CFU: ${analysis.missingData.examsWithoutCFU}`);
      }
      if (analysis.missingData.examsWithoutYear > 0) {
        console.log(`   📅 Exams without year: ${analysis.missingData.examsWithoutYear}`);
      }
      if (analysis.missingData.examsWithoutSemester > 0) {
        console.log(`   📆 Exams without semester: ${analysis.missingData.examsWithoutSemester}`);
      }
      console.log('');
    }

    // Generate the HTML
    const htmlContent = this.generateVisualizationHTML(dataFileName);
    
    // Write the HTML file
    fs.writeFileSync(this.outputPath, htmlContent, 'utf8');
    
    console.log(`✅ Visualization generated: ${this.outputPath}`);
    console.log('');
    console.log('🌐 To view the visualization:');
    console.log(`   1. Open a terminal in: ${this.sessionDir}`);
    console.log(`   2. Run: python3 -m http.server 8000`);
    console.log(`   3. Open: http://localhost:8000/dataCourses-visualization.html`);
    console.log('');
    console.log('💡 Or simply open the HTML file in your browser if the data file is accessible.');

    return this.outputPath;
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const sessionDir = args[0]; // Optional session directory

  try {
    const generator = new DataCoursesVisualizationGenerator({ sessionDir });
    const outputPath = generator.generate();
    
    // Optional: Open in browser (macOS)
    if (process.platform === 'darwin' && args.includes('--open')) {
      const { exec } = require('child_process');
      exec(`open "${outputPath}"`);
    }
    
  } catch (error: any) {
    console.error('❌ Error generating visualization:', error?.message || error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DataCoursesVisualizationGenerator };

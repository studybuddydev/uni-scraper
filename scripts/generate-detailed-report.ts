#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface ExamData {
  id: string;
  universityId: string;
  course: string;
  courseId: string;
  name: string;
  url: string;
  lastUpdated: string;
  deleted: null;
  metadata: {
    scrapingSession: string;
    scrapingTimestamp: string;
    sourceUrl: string;
    hasModules: boolean;
    hasFractions: boolean;
  };
}

interface CourseProcessedData {
  courses: Record<string, string>;
  pathsyears: Record<string, Record<string, Record<string, string>>>;
}

interface CourseStats {
  name: string;
  examCount: number;
  paths: Record<string, Record<string, number>>;
  totalExams: number;
}

async function generateDetailedReport(sessionId: string) {
  const dataDir = path.join(process.cwd(), 'data', sessionId);
  const reportsDir = path.join(process.cwd(), 'reports', sessionId);
  
  // Read the data files
  const coursesProcessedPath = path.join(dataDir, `${sessionId}-courses-processed.json`);
  const examsJsonlPath = path.join(dataDir, `${sessionId}-exams.jsonl`);
  const reportPath = path.join(reportsDir, `${sessionId}-dashboard.html`);
  
  if (!fs.existsSync(coursesProcessedPath) || !fs.existsSync(examsJsonlPath)) {
    console.error('Required data files not found');
    return;
  }
  
  // Parse courses data
  const coursesData: CourseProcessedData = JSON.parse(fs.readFileSync(coursesProcessedPath, 'utf8'));
  
  // Parse exams data
  const examsData: ExamData[] = [];
  const examsContent = fs.readFileSync(examsJsonlPath, 'utf8');
  const lines = examsContent.trim().split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        examsData.push(JSON.parse(line));
      } catch (e) {
        console.warn('Failed to parse exam line:', line.substring(0, 100));
      }
    }
  }
  
  // Analyze data
  const courseStats: Record<string, CourseStats> = {};
  
  // Initialize course stats from courses data
  for (const [courseName, courseUrl] of Object.entries(coursesData.courses)) {
    courseStats[courseName] = {
      name: courseName,
      examCount: 0,
      paths: {},
      totalExams: 0
    };
    
    // Initialize paths from pathsyears data
    if (coursesData.pathsyears[courseName]) {
      for (const [pathName, years] of Object.entries(coursesData.pathsyears[courseName])) {
        courseStats[courseName].paths[pathName] = {};
        for (const yearName of Object.keys(years)) {
          courseStats[courseName].paths[pathName][yearName] = 0;
        }
      }
    }
  }
  
  // Count exams per course/path/year
  for (const exam of examsData) {
    const courseKey = `[${exam.courseId}] ${exam.course}`;
    
    if (courseStats[courseKey]) {
      courseStats[courseKey].totalExams++;
      
      // Try to extract path and year from URL
      const url = exam.metadata.sourceUrl;
      const pathMatch = url.match(/schemaid=(\d+)/);
      const yearMatch = url.match(/coorte=(\d+)/);
      
      if (pathMatch && yearMatch) {
        const schemaId = pathMatch[1];
        const year = yearMatch[1];
        
        // Find matching path
        for (const [pathName, years] of Object.entries(courseStats[courseKey].paths)) {
          for (const [yearName, pathUrl] of Object.entries(coursesData.pathsyears[courseKey]?.[pathName] || {})) {
            if (pathUrl.includes(`schemaid=${schemaId}`)) {
              if (!courseStats[courseKey].paths[pathName]) {
                courseStats[courseKey].paths[pathName] = {};
              }
              if (!courseStats[courseKey].paths[pathName][yearName]) {
                courseStats[courseKey].paths[pathName][yearName] = 0;
              }
              courseStats[courseKey].paths[pathName][yearName]++;
              break;
            }
          }
        }
      }
    }
  }
  
  // Generate detailed HTML section
  const detailedSection = generateDetailedHtml(courseStats);
  
  // Read existing report
  let reportHtml = fs.readFileSync(reportPath, 'utf8');
  
  // Insert detailed section before the error distribution
  const insertPosition = reportHtml.indexOf('<div class="chart-container">');
  if (insertPosition !== -1) {
    reportHtml = reportHtml.slice(0, insertPosition) + 
                detailedSection + '\n\n    ' + 
                reportHtml.slice(insertPosition);
  } else {
    // Fallback: insert before closing body tag
    reportHtml = reportHtml.replace('</body>', detailedSection + '\n</body>');
  }
  
  // Write updated report
  fs.writeFileSync(reportPath, reportHtml);
  
  console.log(`✓ Updated detailed report: ${reportPath}`);
  console.log(`📊 Found ${Object.keys(courseStats).length} courses with ${examsData.length} total exams`);
}

function generateDetailedHtml(courseStats: Record<string, CourseStats>): string {
  const totalCourses = Object.keys(courseStats).length;
  const totalExams = Object.values(courseStats).reduce((sum, course) => sum + course.totalExams, 0);
  
  let html = `
    <div class="chart-container">
        <h3>Course and Exam Details</h3>
        <div style="margin-bottom: 20px;">
            <p><strong>Total Courses:</strong> ${totalCourses}</p>
            <p><strong>Total Exams:</strong> ${totalExams}</p>
        </div>
        
        <div style="max-height: 600px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8f9fa; position: sticky; top: 0;">
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">Course</th>
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: bold;">Total Exams</th>
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">Paths & Years</th>
                    </tr>
                </thead>
                <tbody>`;
  
  // Sort courses by total exams (descending)
  const sortedCourses = Object.entries(courseStats).sort((a, b) => b[1].totalExams - a[1].totalExams);
  
  for (const [courseName, stats] of sortedCourses) {
    const courseDisplayName = courseName.replace(/^\[[^\]]+\]\s*/, ''); // Remove course code for display
    
    let pathsHtml = '';
    const pathEntries = Object.entries(stats.paths);
    
    if (pathEntries.length > 0) {
      pathsHtml = '<div style="font-size: 0.9em;">';
      for (const [pathName, years] of pathEntries) {
        const yearEntries = Object.entries(years);
        if (yearEntries.length > 0) {
          const pathDisplayName = pathName || 'Default Path';
          pathsHtml += `<div style="margin-bottom: 8px;"><strong>${pathDisplayName}:</strong><br>`;
          
          for (const [yearName, examCount] of yearEntries) {
            if (examCount > 0) {
              pathsHtml += `<span style="margin-left: 15px; color: #666;">• ${yearName}: ${examCount} exams</span><br>`;
            }
          }
          pathsHtml += '</div>';
        }
      }
      pathsHtml += '</div>';
    } else {
      pathsHtml = '<span style="color: #999; font-style: italic;">No path details available</span>';
    }
    
    html += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 12px; vertical-align: top;">
                            <strong>${courseDisplayName}</strong>
                        </td>
                        <td style="border: 1px solid #ddd; padding: 12px; text-align: center; vertical-align: top;">
                            <span style="font-size: 1.2em; font-weight: bold; color: #007cba;">${stats.totalExams}</span>
                        </td>
                        <td style="border: 1px solid #ddd; padding: 12px; vertical-align: top;">
                            ${pathsHtml}
                        </td>
                    </tr>`;
  }
  
  html += `
                </tbody>
            </table>
        </div>
    </div>`;
  
  return html;
}

// Get session ID from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npm run detailed-report <session-id>');
  console.error('Example: npm run detailed-report agentic-2025-06-24T18-43-46');
  process.exit(1);
}

const sessionId = args[0];
generateDetailedReport(sessionId).catch(console.error);

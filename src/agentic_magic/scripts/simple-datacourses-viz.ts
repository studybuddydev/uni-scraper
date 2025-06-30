#!/usr/bin/env node

/**
 * Simple script to generate HTML visualization of dataCourses
 */

import fs from 'fs';
import path from 'path';

function generateDataCoursesVisualization(sessionDir?: string) {
  // Find the dataCourses file
  let dataCoursesPath: string;
  
  if (sessionDir) {
    // Use provided session directory
    const sessionName = path.basename(sessionDir);
    dataCoursesPath = path.join(sessionDir, `${sessionName}-dataCourses.json`);
  } else {
    // Find the latest session directory
    const dataDir = '/Users/alessiogandelli/dev/studybuddy/uni-scraper/data';
    const sessions = fs.readdirSync(dataDir)
      .filter(name => name.startsWith('agentic-'))
      .sort()
      .reverse();
    
    if (sessions.length === 0) {
      console.error('❌ No agentic sessions found');
      return;
    }
    
    const latestSession = sessions[0];
    dataCoursesPath = path.join(dataDir, latestSession, `${latestSession}-dataCourses.json`);
  }
  
  if (!fs.existsSync(dataCoursesPath)) {
    console.error('❌ DataCourses file not found:', dataCoursesPath);
    return;
  }

  const dataCourses = JSON.parse(fs.readFileSync(dataCoursesPath, 'utf8'));
  console.log(`📊 Loaded ${dataCourses.length} courses`);

  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DataCourses Visualization</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 40px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .header h1 {
            font-size: 2.5rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header p {
            color: #666;
            font-size: 1.1rem;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            padding: 30px;
            text-align: center;
            box-shadow: 0 15px 30px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 25px 50px rgba(0,0,0,0.15);
        }
        
        .stat-number {
            font-size: 3rem;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        
        .stat-label {
            color: #666;
            font-size: 1.1rem;
            font-weight: 500;
        }
        
        .course {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            margin-bottom: 20px;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 15px 30px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.3s ease;
        }
        
        .course:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        
        .course-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 25px;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.3s ease;
        }
        
        .course-header:hover {
            background: linear-gradient(135deg, #5a6fd8, #6b42a6);
        }
        
        .course-title {
            font-size: 1.3rem;
            font-weight: 600;
        }
        
        .course-id {
            font-size: 0.9rem;
            opacity: 0.8;
            margin-top: 5px;
        }
        
        .course-toggle {
            font-size: 1.2rem;
            transition: transform 0.3s ease;
        }
        
        .course-stats {
            display: flex;
            gap: 20px;
            font-size: 0.9rem;
        }
        
        .course-stat {
            background: rgba(255,255,255,0.2);
            padding: 5px 12px;
            border-radius: 20px;
        }
        
        .course-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease-out;
        }
        
        .course-content.expanded {
            max-height: 5000px;
        }
        
        .years {
            padding: 0;
        }
        
        .year {
            border-bottom: 1px solid #eee;
        }
        
        .year:last-child {
            border-bottom: none;
        }
        
        .year-header {
            background: #f8f9fa;
            padding: 20px;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            color: #495057;
            transition: background 0.3s ease;
        }
        
        .year-header:hover {
            background: #e9ecef;
        }
        
        .year-toggle {
            transition: transform 0.3s ease;
        }
        
        .year-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }
        
        .year-content.expanded {
            max-height: 3000px;
        }
        
        .semesters {
            padding: 15px;
            display: grid;
            gap: 15px;
        }
        
        .semester {
            border: 1px solid #e9ecef;
            border-radius: 12px;
            overflow: hidden;
            background: #fff;
        }
        
        .semester-header {
            background: #f1f3f4;
            padding: 15px;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            color: #495057;
            transition: background 0.3s ease;
        }
        
        .semester-header:hover {
            background: #e9ecef;
        }
        
        .semester-toggle {
            transition: transform 0.3s ease;
        }
        
        .cfu-badge {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
        }
        
        .semester-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }
        
        .semester-content.expanded {
            max-height: 2000px;
        }
        
        .exams {
            padding: 15px;
            display: grid;
            gap: 8px;
        }
        
        .exam {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s ease;
        }
        
        .exam:hover {
            background: #e9ecef;
            transform: translateX(5px);
        }
        
        .exam-info {
            flex: 1;
        }
        
        .exam-name {
            font-weight: 600;
            color: #495057;
            margin-bottom: 4px;
        }
        
        .exam-id {
            color: #6c757d;
            font-size: 0.85rem;
            font-family: 'Monaco', 'Menlo', monospace;
        }
        
        .exam-cfu {
            background: linear-gradient(135deg, #17a2b8, #138496);
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
            min-width: 60px;
            text-align: center;
        }
        
        .missing-cfu {
            background: linear-gradient(135deg, #dc3545, #c82333);
        }
        
        .summary {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 15px 30px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            margin-top: 30px;
        }
        
        .summary h2 {
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.5rem;
        }
        
        .issues {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin-top: 15px;
        }
        
        .issues h3 {
            color: #856404;
            margin-bottom: 15px;
        }
        
        .issues ul {
            color: #856404;
            margin-left: 20px;
        }
        
        .no-issues {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 20px;
            color: #155724;
            text-align: center;
            font-weight: 600;
        }
        
        .compact-view {
            display: none;
        }
        
        .view-toggle {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
            text-align: center;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        
        .toggle-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 0 10px;
        }
        
        .toggle-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }
        
        .toggle-btn.active {
            background: linear-gradient(135deg, #28a745, #20c997);
        }
    </style>
    <script>
        function toggleCourse(element) {
            const content = element.nextElementSibling;
            const toggle = element.querySelector('.course-toggle');
            
            content.classList.toggle('expanded');
            toggle.style.transform = content.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
        
        function toggleYear(element) {
            const content = element.nextElementSibling;
            const toggle = element.querySelector('.year-toggle');
            
            content.classList.toggle('expanded');
            toggle.style.transform = content.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
        
        function toggleSemester(element) {
            const content = element.nextElementSibling;
            const toggle = element.querySelector('.semester-toggle');
            
            content.classList.toggle('expanded');
            toggle.style.transform = content.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
        
        function expandAll() {
            document.querySelectorAll('.course-content, .year-content, .semester-content').forEach(el => {
                el.classList.add('expanded');
            });
            document.querySelectorAll('.course-toggle, .year-toggle, .semester-toggle').forEach(el => {
                el.style.transform = 'rotate(180deg)';
            });
        }
        
        function collapseAll() {
            document.querySelectorAll('.course-content, .year-content, .semester-content').forEach(el => {
                el.classList.remove('expanded');
            });
            document.querySelectorAll('.course-toggle, .year-toggle, .semester-toggle').forEach(el => {
                el.style.transform = 'rotate(0deg)';
            });
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 DataCourses Visualization</h1>
            <p>University: UNIBS | Generated: ${new Date().toLocaleDateString()}</p>
        </div>

        ${generateStats(dataCourses)}
        
        <div class="view-toggle">
            <button class="toggle-btn" onclick="expandAll()">📂 Expand All</button>
            <button class="toggle-btn" onclick="collapseAll()">📁 Collapse All</button>
        </div>

        <div class="courses">
            ${dataCourses.map((course: any) => generateCourseHTML(course)).join('')}
        </div>

        ${generateSummary(dataCourses)}
    </div>
</body>
</html>`;

  // Save HTML file
  const outputPath = path.join(path.dirname(dataCoursesPath), 'dataCourses-visualization.html');
  fs.writeFileSync(outputPath, html);
  
  console.log(`✅ Visualization generated: ${outputPath}`);
}

function generateStats(dataCourses: any[]) {
  const totalExams = dataCourses.reduce((sum, course) => sum + course.exams.length, 0);
  const totalCFU = dataCourses.reduce((sum, course) => 
    sum + course.exams.reduce((examSum: number, exam: any) => examSum + (exam.CFU || 0), 0), 0);
  const examsWithCFU = dataCourses.reduce((sum, course) => 
    sum + course.exams.filter((exam: any) => exam.CFU).length, 0);

  return `
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${dataCourses.length}</div>
            <div>Courses</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${totalExams}</div>
            <div>Total Exams</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${totalCFU}</div>
            <div>Total CFU</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${examsWithCFU}</div>
            <div>Exams with CFU</div>
        </div>
    </div>
  `;
}

function generateCourseHTML(course: any) {
  // Group exams by year and semester
  const examsByYear: { [year: string]: { [semester: string]: any[] } } = {};
  
  course.exams.forEach((exam: any) => {
    const year = exam.year || 'Unknown';
    const semester = exam.semester || 'Unknown';
    
    if (!examsByYear[year]) examsByYear[year] = {};
    if (!examsByYear[year][semester]) examsByYear[year][semester] = [];
    
    examsByYear[year][semester].push(exam);
  });

  const yearsHTML = Object.entries(examsByYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, semesters]) => {
      const semestersHTML = Object.entries(semesters)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([semester, exams]) => {
          const totalCFU = exams.reduce((sum, exam) => sum + (exam.CFU || 0), 0);
          const examsHTML = exams.map(exam => `
            <div class="exam">
                <div>
                    <div class="exam-name">${exam.name}</div>
                    <div class="exam-id">${exam.examId}</div>
                </div>
                <div class="exam-cfu ${exam.CFU ? '' : 'missing-cfu'}">
                    ${exam.CFU || 'No CFU'}
                </div>
            </div>
          `).join('');

          return `
            <div class="semester">
                <div class="semester-header">
                    <span>${semester}</span>
                    <span class="cfu-badge">${totalCFU} CFU</span>
                </div>
                <div class="exams">
                    ${examsHTML}
                </div>
            </div>
          `;
        }).join('');

      return `
        <div class="year">
            <div class="year-title">Year ${year}</div>
            <div class="semesters">
                ${semestersHTML}
            </div>
        </div>
      `;
    }).join('');

  return `
    <div class="course">
        <div class="course-header">
            ${course.name}
            <div class="course-id">${course.id}</div>
        </div>
        <div class="years">
            ${yearsHTML}
        </div>
    </div>
  `;
}

function generateSummary(dataCourses: any[]) {
  const issues: string[] = [];
  
  dataCourses.forEach(course => {
    const examsWithoutCFU = course.exams.filter((exam: any) => !exam.CFU);
    if (examsWithoutCFU.length > 0) {
      issues.push(`${course.name}: ${examsWithoutCFU.length} exams missing CFU`);
    }
  });

  return `
    <div class="summary">
        <h2>📋 Summary</h2>
        ${issues.length > 0 ? `
            <h3>⚠️ Issues Found:</h3>
            <ul>
                ${issues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
        ` : '<p>✅ No issues found - all exams have complete data!</p>'}
    </div>
  `;
}

// Run the generator
const sessionDir = process.argv[2]; // Allow passing session directory as argument
generateDataCoursesVisualization(sessionDir);

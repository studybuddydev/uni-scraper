#!/usr/bin/env ts-node

import { ScrapingConfig } from '../types';
import { ConfigManager } from '../utils/ConfigManager';
import path from 'path';
import fs from 'fs';

interface IndividualExamSummary {
  fileName: string;
  examId: string;
  examName: string;
  url: string;
  hasContent: {
    goals: boolean;
    chapters: boolean;
    books: boolean;
    requirements: boolean;
    teachingMethods: boolean;
    learningAssessment: boolean;
  };
  extractionSuccess: boolean;
  extractionError?: string;
  fileSize: number;
}

async function main() {
  console.log('📚 Loading Individual Exam Files');
  console.log('=================================');
  
  // Load configuration
  const configManager = ConfigManager.getInstance();
  const config: ScrapingConfig = configManager.loadConfig();
  
  // Get session ID from command line or find latest
  const sessionId = process.argv[2] || findLatestSession(config);
  
  if (!sessionId) {
    console.error('❌ No session ID provided and no existing session found');
    console.log('Usage: npm run load-individual-exams [session-id]');
    process.exit(1);
  }
  
  console.log(`📁 Using session: ${sessionId}`);
  
  // Find individual exams directory
  const sessionDir = path.join(process.cwd(), config.output.dataDir, sessionId);
  const individualExamsDir = path.join(sessionDir, 'individual-exams');
  
  if (!fs.existsSync(individualExamsDir)) {
    console.error(`❌ Individual exams directory not found: ${individualExamsDir}`);
    console.log('💡 Have you run the individual exam processing yet?');
    process.exit(1);
  }
  
  // Load all individual exam files
  const examFiles = fs.readdirSync(individualExamsDir)
    .filter(file => file.endsWith('.json'))
    .sort();
  
  if (examFiles.length === 0) {
    console.error('❌ No individual exam files found');
    process.exit(1);
  }
  
  console.log(`📄 Found ${examFiles.length} individual exam files`);
  console.log('');
  
  const summaries: IndividualExamSummary[] = [];
  let successfulExams = 0;
  let failedExams = 0;
  let examsWithContent = 0;
  
  // Analyze each exam file
  for (const file of examFiles) {
    try {
      const filePath = path.join(individualExamsDir, file);
      const stats = fs.statSync(filePath);
      const examData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      const hasContent = {
        goals: !!(examData.goals && examData.goals.trim().length > 0),
        chapters: !!(examData.chapters && examData.chapters.trim().length > 0),
        books: !!(examData.books && examData.books.trim().length > 0),
        requirements: !!(examData.requirements && examData.requirements.trim().length > 0),
        teachingMethods: !!(examData.teachingMethods && examData.teachingMethods.trim().length > 0),
        learningAssessment: !!(examData.learningAssessment && examData.learningAssessment.trim().length > 0)
      };
      
      const hasAnyContent = Object.values(hasContent).some(Boolean);
      if (hasAnyContent) examsWithContent++;
      
      const summary: IndividualExamSummary = {
        fileName: file,
        examId: examData.id || 'unknown',
        examName: examData.name || 'Unknown Exam',
        url: examData.url || '',
        hasContent,
        extractionSuccess: examData.syllabusExtracted === true,
        extractionError: examData.extractionError,
        fileSize: stats.size
      };
      
      summaries.push(summary);
      
      if (summary.extractionSuccess) {
        successfulExams++;
      } else {
        failedExams++;
      }
      
    } catch (error) {
      console.warn(`⚠️  Failed to parse ${file}: ${error}`);
      failedExams++;
    }
  }
  
  // Display summary statistics
  console.log('📊 Summary Statistics:');
  console.log(`   Total exam files: ${examFiles.length}`);
  console.log(`   ✅ Successful extractions: ${successfulExams}`);
  console.log(`   ❌ Failed extractions: ${failedExams}`);
  console.log(`   📝 Exams with content: ${examsWithContent}`);
  console.log(`   📊 Success rate: ${((successfulExams / examFiles.length) * 100).toFixed(1)}%`);
  console.log('');
  
  // Content analysis
  console.log('📋 Content Analysis:');
  const contentStats = {
    goals: summaries.filter(s => s.hasContent.goals).length,
    chapters: summaries.filter(s => s.hasContent.chapters).length,
    books: summaries.filter(s => s.hasContent.books).length,
    requirements: summaries.filter(s => s.hasContent.requirements).length,
    teachingMethods: summaries.filter(s => s.hasContent.teachingMethods).length,
    learningAssessment: summaries.filter(s => s.hasContent.learningAssessment).length
  };
  
  for (const [field, count] of Object.entries(contentStats)) {
    const percentage = ((count / examFiles.length) * 100).toFixed(1);
    console.log(`   ${field}: ${count}/${examFiles.length} (${percentage}%)`);
  }
  console.log('');
  
  // Show options
  console.log('🔍 Available Actions:');
  console.log('   1. Show failed exams');
  console.log('   2. Show exams with content');
  console.log('   3. Show sample exam data');
  console.log('   4. Show exams by content type');
  console.log('   5. Generate detailed report');
  console.log('   q. Quit');
  console.log('');
  
  // Interactive menu
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const askQuestion = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  };
  
  while (true) {
    const choice = await askQuestion('Choose an action (1-5, q): ');
    
    switch (choice.trim().toLowerCase()) {
      case '1':
        showFailedExams(summaries);
        break;
        
      case '2':
        showExamsWithContent(summaries);
        break;
        
      case '3':
        await showSampleExamData(individualExamsDir, summaries);
        break;
        
      case '4':
        showExamsByContentType(summaries);
        break;
        
      case '5':
        await generateDetailedReport(individualExamsDir, summaries, sessionId);
        break;
        
      case 'q':
      case 'quit':
        rl.close();
        return;
        
      default:
        console.log('❌ Invalid choice. Please try again.');
    }
    
    console.log('');
  }
}

function showFailedExams(summaries: IndividualExamSummary[]) {
  const failedExams = summaries.filter(s => !s.extractionSuccess);
  
  console.log(`❌ Failed Exams (${failedExams.length}):`);
  if (failedExams.length === 0) {
    console.log('   No failed exams found! 🎉');
    return;
  }
  
  failedExams.forEach((exam, index) => {
    console.log(`   ${index + 1}. ${exam.examName} (${exam.fileName})`);
    if (exam.extractionError) {
      console.log(`      Error: ${exam.extractionError}`);
    }
    console.log(`      URL: ${exam.url}`);
  });
}

function showExamsWithContent(summaries: IndividualExamSummary[]) {
  const examsWithContent = summaries.filter(s => 
    Object.values(s.hasContent).some(Boolean)
  );
  
  console.log(`📝 Exams with Content (${examsWithContent.length}):`);
  if (examsWithContent.length === 0) {
    console.log('   No exams with content found.');
    return;
  }
  
  examsWithContent.slice(0, 10).forEach((exam, index) => {
    const contentFields = Object.entries(exam.hasContent)
      .filter(([_, hasContent]) => hasContent)
      .map(([field, _]) => field);
    
    console.log(`   ${index + 1}. ${exam.examName}`);
    console.log(`      Content: ${contentFields.join(', ')}`);
    console.log(`      File: ${exam.fileName}`);
  });
  
  if (examsWithContent.length > 10) {
    console.log(`   ... and ${examsWithContent.length - 10} more`);
  }
}

async function showSampleExamData(individualExamsDir: string, summaries: IndividualExamSummary[]) {
  const examsWithContent = summaries.filter(s => 
    Object.values(s.hasContent).some(Boolean)
  );
  
  if (examsWithContent.length === 0) {
    console.log('❌ No exams with content found to display sample data.');
    return;
  }
  
  const sampleExam = examsWithContent[0];
  const filePath = path.join(individualExamsDir, sampleExam.fileName);
  
  try {
    const examData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`📄 Sample Exam Data: ${sampleExam.examName}`);
    console.log(`   File: ${sampleExam.fileName}`);
    console.log(`   URL: ${examData.url || 'N/A'}`);
    console.log('');
    
    // Show basic info
    console.log('📋 Basic Information:');
    console.log(`   Name: ${examData.name || 'N/A'}`);
    console.log(`   Course: ${examData.courseName || 'N/A'}`);
    console.log(`   CFU: ${examData.cfu || 'N/A'}`);
    console.log(`   Year: ${examData.year || 'N/A'}`);
    console.log('');
    
    // Show content fields
    const contentFields = ['goals', 'chapters', 'books', 'requirements', 'teachingMethods', 'learningAssessment'];
    
    for (const field of contentFields) {
      if (examData[field] && examData[field].trim().length > 0) {
        console.log(`📝 ${field.toUpperCase()}:`);
        const content = examData[field].trim();
        const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
        console.log(`   ${preview}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error(`❌ Failed to load sample exam data: ${error}`);
  }
}

function showExamsByContentType(summaries: IndividualExamSummary[]) {
  const contentTypes = ['goals', 'chapters', 'books', 'requirements', 'teachingMethods', 'learningAssessment'];
  
  console.log('📊 Exams by Content Type:');
  
  for (const contentType of contentTypes) {
    const examsWithType = summaries.filter(s => s.hasContent[contentType as keyof typeof s.hasContent]);
    console.log(`\n   📝 ${contentType.toUpperCase()} (${examsWithType.length} exams):`);
    
    if (examsWithType.length > 0) {
      examsWithType.slice(0, 5).forEach((exam, index) => {
        console.log(`      ${index + 1}. ${exam.examName} (${exam.fileName})`);
      });
      
      if (examsWithType.length > 5) {
        console.log(`      ... and ${examsWithType.length - 5} more`);
      }
    }
  }
}

async function generateDetailedReport(individualExamsDir: string, summaries: IndividualExamSummary[], sessionId: string) {
  const reportPath = path.join(individualExamsDir, '..', `individual-exams-report-${sessionId}.md`);
  
  let report = `# Individual Exams Report - ${sessionId}\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Summary
  report += `## Summary\n\n`;
  report += `- Total exam files: ${summaries.length}\n`;
  report += `- Successful extractions: ${summaries.filter(s => s.extractionSuccess).length}\n`;
  report += `- Failed extractions: ${summaries.filter(s => !s.extractionSuccess).length}\n`;
  report += `- Exams with content: ${summaries.filter(s => Object.values(s.hasContent).some(Boolean)).length}\n\n`;
  
  // Content statistics
  report += `## Content Statistics\n\n`;
  const contentStats = {
    goals: summaries.filter(s => s.hasContent.goals).length,
    chapters: summaries.filter(s => s.hasContent.chapters).length,
    books: summaries.filter(s => s.hasContent.books).length,
    requirements: summaries.filter(s => s.hasContent.requirements).length,
    teachingMethods: summaries.filter(s => s.hasContent.teachingMethods).length,
    learningAssessment: summaries.filter(s => s.hasContent.learningAssessment).length
  };
  
  for (const [field, count] of Object.entries(contentStats)) {
    const percentage = ((count / summaries.length) * 100).toFixed(1);
    report += `- ${field}: ${count}/${summaries.length} (${percentage}%)\n`;
  }
  report += '\n';
  
  // Failed exams
  const failedExams = summaries.filter(s => !s.extractionSuccess);
  if (failedExams.length > 0) {
    report += `## Failed Exams (${failedExams.length})\n\n`;
    failedExams.forEach((exam, index) => {
      report += `${index + 1}. **${exam.examName}** (${exam.fileName})\n`;
      if (exam.extractionError) {
        report += `   - Error: ${exam.extractionError}\n`;
      }
      report += `   - URL: ${exam.url}\n\n`;
    });
  }
  
  // Top exams with content
  const examsWithContent = summaries.filter(s => Object.values(s.hasContent).some(Boolean));
  if (examsWithContent.length > 0) {
    report += `## Sample Exams with Content\n\n`;
    examsWithContent.slice(0, 20).forEach((exam, index) => {
      const contentFields = Object.entries(exam.hasContent)
        .filter(([_, hasContent]) => hasContent)
        .map(([field, _]) => field);
      
      report += `${index + 1}. **${exam.examName}** (${exam.fileName})\n`;
      report += `   - Content: ${contentFields.join(', ')}\n`;
      report += `   - Size: ${(exam.fileSize / 1024).toFixed(1)} KB\n\n`;
    });
  }
  
  fs.writeFileSync(reportPath, report);
  console.log(`📄 Detailed report saved to: ${reportPath}`);
}

function findLatestSession(config: ScrapingConfig): string | null {
  const dataDir = path.join(process.cwd(), config.output.dataDir);
  
  if (!fs.existsSync(dataDir)) {
    return null;
  }
  
  const sessionDirs = fs.readdirSync(dataDir)
    .filter(dir => dir.startsWith('agentic-'))
    .sort()
    .reverse();
  
  return sessionDirs.length > 0 ? sessionDirs[0] : null;
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

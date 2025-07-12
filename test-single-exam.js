const { IndividualExamProcessor } = require('./dist/src/agentic_magic/core/IndividualExamProcessor');
const fs = require('fs');
const path = require('path');

async function testSingleExam() {
  console.log('🧪 Testing fraction processing for single exam...');
  
  // Create a test exam that we know has fractions
  const testExam = {
    id: "11013",
    name: "FILOSOFIA DEL DIRITTO",
    url: "https://unibs.coursecatalogue.cineca.it/insegnamenti/2025/8785_139960_2223/2025/8899/1498?coorte=2025&schemaid=3278",
    academicYear: "2025/2026",
    semester: "Secondo Semestre",
    cfu: 9,
    hours: 60,
    parentExamId: null,
    parentExamName: null,
    isSubexam: false,
    hasSubexams: false,
    courseId: "04181R",
    courseName: "[04181R] GIURISPRUDENZA",
    pathName: "PERCORSO GIUSPRIVATISTICO",
    year: "2025/2026"
  };

  const processor = new IndividualExamProcessor();
  
  try {
    // Process just this one exam
    const detailedExams = await processor.processIndividualExam(testExam);
    
    console.log(`✅ Processing complete! Generated ${detailedExams.length} exam files:`);
    
    for (const exam of detailedExams) {
      console.log(`  - ID: ${exam.id}`);
      console.log(`  - Name: ${exam.name}`);
      console.log(`  - File will be: ${exam.id}_${exam.name.replace(/[^a-zA-Z0-9]/g, '_')}_2025.json`);
      console.log('');
    }
    
    // Save them to see the actual files created
    for (const exam of detailedExams) {
      await processor.saveIndividualExam(exam);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSingleExam();

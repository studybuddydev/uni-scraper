import { DataValidator, Logger } from '../index';
import fs from 'fs';

async function example() {
  // Sample exam data
  const examData = {
    id: 'unibs702816',
    universityId: 'unibs',
    course: 'CORSO DI LAUREA IN INGEGNERIA MECCANICA E DEI MATERIALI',
    courseId: 'unibs05742',
    name: 'ANALISI MATEMATICA II',
    url: 'https://example.com/exam/702816',
    lastUpdated: new Date().toISOString(),
    deleted: null,
    goals: 'Lo scopo del corso è introdurre gli elementi...',
    examMode: 'L\'esame consiste in una prova scritta...',
    requirements: 'Calcolo differenziale e integrale...',
    cfu: 9,
    language: 'ITALIANO',
    teachers: [{ name: 'TREBESCHI PAOLA' }],
    books: {
      books: [
        {
          name: 'Lezioni di analisi matematica 2',
          authors: ['Giovanna Bonfanti', 'Paolo Secchi'],
          year: 2013
        }
      ]
    },
    chapters: [
      {
        name: 'Calcolo differenziale e integrale per funzioni reali di più variabili',
        showTasks: true,
        tasks: [{ name: 'Limiti, continuità, derivate parziali e direzionali' }],
        postIts: [
          {
            color: '#e6b905',
            content: 'In questi argomenti è fondamentale...'
          }
        ]
      }
    ]
  };
  
  // Initialize validator
  const logger = new Logger('./logs', 'validation-example');
  const validator = new DataValidator(logger);
  
  try {
    console.log('Validating exam data...');
    
    // Validate single exam
    const result = validator.validateExam(examData);
    
    console.log(`Validation result: ${result.valid ? 'VALID' : 'INVALID'}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Warnings: ${result.warnings.length}`);
    
    // Print errors and warnings
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(error => {
        console.log(`  - ${error.field}: ${error.message}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(warning => {
        console.log(`  - ${warning.field}: ${warning.message}`);
      });
    }
    
    // Add custom validation rule
    validator.addCustomRule('cfu-range', (data) => {
      const errors: any[] = [];
      const warnings: any[] = [];
      
      if (data.cfu) {
        const cfuMatch = data.cfu.match(/(\d+)\s*CFU/);
        if (cfuMatch) {
          const cfuValue = parseInt(cfuMatch[1]);
          if (cfuValue < 3 || cfuValue > 12) {
            warnings.push({
              field: 'cfu',
              message: 'CFU value outside typical range (3-12)',
              value: cfuValue
            });
          }
        }
      }
      
      return { valid: errors.length === 0, errors, warnings };
    });
    
    // Validate again with custom rule
    console.log('\nValidating with custom rule...');
    const resultWithCustomRule = validator.validateExam(examData);
    console.log(`Custom validation warnings: ${resultWithCustomRule.warnings.length}`);
    
  } catch (error) {
    console.error('Validation example failed:', error);
  }
}

example();

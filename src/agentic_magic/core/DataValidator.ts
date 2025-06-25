import { CourseData, ExamData, ValidationResult, ValidationError, ValidationWarning } from '../types';
import { Logger } from '../utils/Logger';

export class DataValidator {
  private logger: Logger;
  private customRules: Map<string, (data: any) => ValidationResult> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public validateCourse(course: CourseData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields validation
    if (!course.id) {
      errors.push({ field: 'id', message: 'Course ID is required' });
    }

    if (!course.name || course.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Course name is required' });
    }

    if (!course.universityId) {
      errors.push({ field: 'universityId', message: 'University ID is required' });
    }

    if (!course.type) {
      errors.push({ field: 'type', message: 'Course type is required' });
    }

    // Format validation
    if (course.id && !/^[a-zA-Z0-9]+$/.test(course.id)) {
      errors.push({ 
        field: 'id', 
        message: 'Course ID must contain only alphanumeric characters',
        value: course.id 
      });
    }

    if (course.name && course.name.length > 200) {
      warnings.push({
        field: 'name',
        message: 'Course name is unusually long',
        value: course.name.length
      });
    }

    // URL validation
    if (course.url && !this.isValidUrl(course.url)) {
      errors.push({
        field: 'url',
        message: 'Invalid URL format',
        value: course.url
      });
    }

    // Date validation
    if (course.lastUpdated && !this.isValidISODate(course.lastUpdated)) {
      errors.push({
        field: 'lastUpdated',
        message: 'Invalid date format, expected ISO string',
        value: course.lastUpdated
      });
    }

    // Exams validation
    if (course.exams) {
      course.exams.forEach((exam, index) => {
        if (!exam.examId) {
          errors.push({
            field: `exams[${index}].examId`,
            message: 'Exam ID is required'
          });
        }

        if (!exam.year) {
          errors.push({
            field: `exams[${index}].year`,
            message: 'Exam year is required'
          });
        }

        if (!exam.semester) {
          errors.push({
            field: `exams[${index}].semester`,
            message: 'Exam semester is required'
          });
        }
      });
    }

    // Apply custom rules
    const customResult = this.applyCustomRules('course', course);
    errors.push(...customResult.errors);
    warnings.push(...customResult.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  public validateExam(exam: ExamData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields validation
    if (!exam.id) {
      errors.push({ field: 'id', message: 'Exam ID is required' });
    }

    if (!exam.name || exam.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Exam name is required' });
    }

    if (!exam.universityId) {
      errors.push({ field: 'universityId', message: 'University ID is required' });
    }

    if (!exam.courseId) {
      errors.push({ field: 'courseId', message: 'Course ID is required' });
    }

    if (!exam.course) {
      errors.push({ field: 'course', message: 'Course name is required' });
    }

    // Format validation
    if (exam.id && !/^[a-zA-Z0-9]+$/.test(exam.id)) {
      errors.push({
        field: 'id',
        message: 'Exam ID must contain only alphanumeric characters',
        value: exam.id
      });
    }

    if (exam.name && exam.name.length > 200) {
      warnings.push({
        field: 'name',
        message: 'Exam name is unusually long',
        value: exam.name.length
      });
    }

    // URL validation
    if (exam.url && !this.isValidUrl(exam.url)) {
      errors.push({
        field: 'url',
        message: 'Invalid URL format',
        value: exam.url
      });
    }

    // Date validation
    if (exam.lastUpdated && !this.isValidISODate(exam.lastUpdated)) {
      errors.push({
        field: 'lastUpdated',
        message: 'Invalid date format, expected ISO string',
        value: exam.lastUpdated
      });
    }

    // CFU validation
    if (exam.cfu !== undefined) {
      let cfuValue: number | null = null;
      
      if (typeof exam.cfu === 'number') {
        // New format: direct number
        cfuValue = exam.cfu;
      } else if (typeof exam.cfu === 'string') {
        // Old format: string like "6 CFU"
        const cfuMatch = (exam.cfu as string).match(/(\d+)\s*CFU/i);
        if (!cfuMatch) {
          warnings.push({
            field: 'cfu',
            message: 'CFU format not recognized',
            value: exam.cfu
          });
        } else {
          cfuValue = parseInt(cfuMatch[1]);
        }
      }
      
      if (cfuValue !== null && (cfuValue < 1 || cfuValue > 30)) {
        warnings.push({
          field: 'cfu',
          message: 'CFU value seems unusual',
          value: cfuValue
        });
      }
    }

    // Language validation
    if (exam.language) {
      const validLanguages = ['ITALIANO', 'INGLESE', 'FRANCESE', 'TEDESCO', 'SPAGNOLO'];
      if (!validLanguages.includes(exam.language.toUpperCase())) {
        warnings.push({
          field: 'language',
          message: 'Unrecognized language',
          value: exam.language
        });
      }
    }

    // Teachers validation
    if (exam.teachers) {
      exam.teachers.forEach((teacher, index) => {
        if (!teacher.name || teacher.name.trim().length === 0) {
          errors.push({
            field: `teachers[${index}].name`,
            message: 'Teacher name is required'
          });
        }

        if (teacher.name && teacher.name.length > 100) {
          warnings.push({
            field: `teachers[${index}].name`,
            message: 'Teacher name is unusually long',
            value: teacher.name.length
          });
        }
      });
    }

    // Chapters validation
    if (exam.chapters) {
      exam.chapters.forEach((chapter, chapterIndex) => {
        if (!chapter.name || chapter.name.trim().length === 0) {
          errors.push({
            field: `chapters[${chapterIndex}].name`,
            message: 'Chapter name is required'
          });
        }

        if (chapter.tasks) {
          chapter.tasks.forEach((task, taskIndex) => {
            if (!task.name || task.name.trim().length === 0) {
              errors.push({
                field: `chapters[${chapterIndex}].tasks[${taskIndex}].name`,
                message: 'Task name is required'
              });
            }
          });
        }

        if (chapter.postIts) {
          chapter.postIts.forEach((postIt, postItIndex) => {
            if (!postIt.content || postIt.content.trim().length === 0) {
              errors.push({
                field: `chapters[${chapterIndex}].postIts[${postItIndex}].content`,
                message: 'PostIt content is required'
              });
            }

            if (!postIt.color || !postIt.color.match(/^#[0-9a-fA-F]{6}$/)) {
              errors.push({
                field: `chapters[${chapterIndex}].postIts[${postItIndex}].color`,
                message: 'PostIt color must be a valid hex color',
                value: postIt.color
              });
            }
          });
        }
      });
    }

    // Books validation
    if (exam.books?.books) {
      exam.books.books.forEach((book, index) => {
        if (!book.name || book.name.trim().length === 0) {
          errors.push({
            field: `books.books[${index}].name`,
            message: 'Book name is required'
          });
        }

        if (!book.authors || book.authors.length === 0) {
          warnings.push({
            field: `books.books[${index}].authors`,
            message: 'Book should have at least one author'
          });
        }

        if (book.year && (book.year < 1900 || book.year > new Date().getFullYear())) {
          warnings.push({
            field: `books.books[${index}].year`,
            message: 'Book year seems unusual',
            value: book.year
          });
        }
      });
    }

    // Apply custom rules
    const customResult = this.applyCustomRules('exam', exam);
    errors.push(...customResult.errors);
    warnings.push(...customResult.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  public addCustomRule(name: string, rule: (data: any) => ValidationResult): void {
    this.customRules.set(name, rule);
    this.logger.debug(`Added custom validation rule: ${name}`);
  }

  public removeCustomRule(name: string): boolean {
    const result = this.customRules.delete(name);
    if (result) {
      this.logger.debug(`Removed custom validation rule: ${name}`);
    }
    return result;
  }

  private applyCustomRules(type: string, data: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [name, rule] of this.customRules) {
      try {
        const result = rule(data);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      } catch (error) {
        this.logger.error(`Error in custom validation rule '${name}':`, error);
        warnings.push({
          field: '_validation',
          message: `Custom validation rule '${name}' failed`
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidISODate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      return date.toISOString() === dateString;
    } catch {
      return false;
    }
  }

  public validateBatch(items: (CourseData | ExamData)[]): {
    totalItems: number;
    validItems: number;
    invalidItems: number;
    errors: Array<{ index: number; item: any; validation: ValidationResult }>;
    warnings: Array<{ index: number; item: any; validation: ValidationResult }>;
  } {
    const results = items.map((item, index) => {
      const isCourse = 'exams' in item;
      const validation = isCourse ? 
        this.validateCourse(item as CourseData) : 
        this.validateExam(item as ExamData);
      
      return { index, item, validation };
    });

    const validItems = results.filter(r => r.validation.valid).length;
    const invalidItems = results.length - validItems;
    const errors = results.filter(r => !r.validation.valid);
    const warnings = results.filter(r => r.validation.warnings.length > 0);

    return {
      totalItems: items.length,
      validItems,
      invalidItems,
      errors,
      warnings
    };
  }

  public generateValidationReport(
    validationResults: Array<{ index: number; item: any; validation: ValidationResult }>
  ): string {
    const report = [];
    report.push('VALIDATION REPORT');
    report.push('================');
    report.push('');

    const totalItems = validationResults.length;
    const validItems = validationResults.filter(r => r.validation.valid).length;
    const invalidItems = totalItems - validItems;

    report.push(`Total Items: ${totalItems}`);
    report.push(`Valid Items: ${validItems} (${((validItems / totalItems) * 100).toFixed(1)}%)`);
    report.push(`Invalid Items: ${invalidItems} (${((invalidItems / totalItems) * 100).toFixed(1)}%)`);
    report.push('');

    if (invalidItems > 0) {
      report.push('VALIDATION ERRORS:');
      report.push('------------------');
      
      validationResults.forEach(result => {
        if (!result.validation.valid) {
          report.push(`Item ${result.index}:`);
          result.validation.errors.forEach(error => {
            report.push(`  - ${error.field}: ${error.message}`);
            if (error.value !== undefined) {
              report.push(`    Value: ${JSON.stringify(error.value)}`);
            }
          });
          report.push('');
        }
      });
    }

    const itemsWithWarnings = validationResults.filter(r => r.validation.warnings.length > 0);
    if (itemsWithWarnings.length > 0) {
      report.push('VALIDATION WARNINGS:');
      report.push('--------------------');
      
      itemsWithWarnings.forEach(result => {
        report.push(`Item ${result.index}:`);
        result.validation.warnings.forEach(warning => {
          report.push(`  - ${warning.field}: ${warning.message}`);
          if (warning.value !== undefined) {
            report.push(`    Value: ${JSON.stringify(warning.value)}`);
          }
        });
        report.push('');
      });
    }

    return report.join('\n');
  }
}

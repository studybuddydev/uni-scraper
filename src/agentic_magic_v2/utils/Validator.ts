import { ValidationResult, ValidationError, ValidationWarning, Course, Exam } from '../types';
import { validateRequiredFields } from './helpers';

/**
 * Data Validator for Agentic Magic v2
 */

export class Validator {
  private requiredCourseFields: string[];
  private requiredExamFields: string[];

  constructor() {
    this.requiredCourseFields = ['id', 'name', 'url', 'universityId'];
    this.requiredExamFields = ['id', 'name', 'url', 'universityId', 'courseId'];
  }

  public validateCourses(courses: Course[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [index, course] of courses.entries()) {
      const courseErrors = this.validateCourse(course, index);
      errors.push(...courseErrors.errors);
      warnings.push(...courseErrors.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalItems: courses.length,
        validItems: courses.length - errors.filter(e => e.severity === 'error').length,
        errorRate: errors.length / courses.length
      }
    };
  }

  public validateExams(exams: Exam[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [index, exam] of exams.entries()) {
      const examErrors = this.validateExam(exam, index);
      errors.push(...examErrors.errors);
      warnings.push(...examErrors.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalItems: exams.length,
        validItems: exams.length - errors.filter(e => e.severity === 'error').length,
        errorRate: errors.length / exams.length
      }
    };
  }

  public validateCourse(course: Course, index?: number): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const prefix = index !== undefined ? `Course ${index}` : 'Course';

    // Required fields validation
    const requiredValidation = validateRequiredFields(course, this.requiredCourseFields);
    if (!requiredValidation.isValid) {
      for (const field of requiredValidation.missingFields) {
        errors.push({
          field,
          message: `${prefix}: Required field '${field}' is missing or empty`,
          value: course[field as keyof Course],
          severity: 'error'
        });
      }
    }

    // URL validation
    if (course.url && !this.isValidUrl(course.url)) {
      errors.push({
        field: 'url',
        message: `${prefix}: Invalid URL format`,
        value: course.url,
        severity: 'error'
      });
    }

    // ID format validation
    if (course.id && !this.isValidId(course.id)) {
      warnings.push({
        field: 'id',
        message: `${prefix}: ID format might be invalid`,
        value: course.id,
        suggestion: 'IDs should be alphanumeric with optional hyphens/underscores'
      });
    }

    // Metadata validation
    if (!course.metadata) {
      warnings.push({
        field: 'metadata',
        message: `${prefix}: Missing metadata`,
        value: course.metadata,
        suggestion: 'Add metadata for better tracking'
      });
    }

    return { errors, warnings };
  }

  public validateExam(exam: Exam, index?: number): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const prefix = index !== undefined ? `Exam ${index}` : 'Exam';

    // Required fields validation
    const requiredValidation = validateRequiredFields(exam, this.requiredExamFields);
    if (!requiredValidation.isValid) {
      for (const field of requiredValidation.missingFields) {
        errors.push({
          field,
          message: `${prefix}: Required field '${field}' is missing or empty`,
          value: exam[field as keyof Exam],
          severity: 'error'
        });
      }
    }

    // URL validation
    if (exam.url && !this.isValidUrl(exam.url)) {
      errors.push({
        field: 'url',
        message: `${prefix}: Invalid URL format`,
        value: exam.url,
        severity: 'error'
      });
    }

    // Numeric field validation
    if (exam.cfu !== undefined && exam.cfu !== null) {
      if (!Number.isInteger(exam.cfu) || exam.cfu <= 0) {
        errors.push({
          field: 'cfu',
          message: `${prefix}: CFU must be a positive integer`,
          value: exam.cfu,
          severity: 'error'
        });
      }
    }

    if (exam.hours !== undefined && exam.hours !== null) {
      if (!Number.isInteger(exam.hours) || exam.hours <= 0) {
        errors.push({
          field: 'hours',
          message: `${prefix}: Hours must be a positive integer`,
          value: exam.hours,
          severity: 'error'
        });
      }
    }

    if (exam.year !== undefined && exam.year !== null) {
      if (!Number.isInteger(exam.year) || exam.year < 1 || exam.year > 6) {
        warnings.push({
          field: 'year',
          message: `${prefix}: Year should be between 1 and 6`,
          value: exam.year,
          suggestion: 'Check if the year value is correct'
        });
      }
    }

    // Array field validation
    if (exam.teachers && !Array.isArray(exam.teachers)) {
      errors.push({
        field: 'teachers',
        message: `${prefix}: Teachers must be an array`,
        value: exam.teachers,
        severity: 'error'
      });
    }

    // Content validation
    const contentFields = ['goals', 'chapters', 'books', 'requirements'];
    const hasAnyContent = contentFields.some(field => {
      const value = exam[field as keyof Exam];
      return value && typeof value === 'string' && value.trim().length > 0;
    });

    if (!hasAnyContent) {
      warnings.push({
        field: 'content',
        message: `${prefix}: No syllabus content found`,
        value: undefined,
        suggestion: 'Verify that syllabus extraction is working correctly'
      });
    }

    // Metadata validation
    if (!exam.metadata) {
      warnings.push({
        field: 'metadata',
        message: `${prefix}: Missing metadata`,
        value: exam.metadata,
        suggestion: 'Add metadata for better tracking'
      });
    } else {
      if (!exam.metadata.syllabusExtracted) {
        warnings.push({
          field: 'syllabusExtracted',
          message: `${prefix}: Syllabus not extracted`,
          value: exam.metadata.syllabusExtracted,
          suggestion: 'Ensure syllabus extraction was successful'
        });
      }
    }

    return { errors, warnings };
  }

  public validateDataConsistency(courses: Course[], exams: Exam[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for orphaned exams (exams without corresponding courses)
    const courseIds = new Set(courses.map(c => c.id));
    const orphanedExams = exams.filter(e => !courseIds.has(e.courseId));

    for (const exam of orphanedExams) {
      warnings.push({
        field: 'courseId',
        message: `Exam "${exam.name}" references non-existent course ID: ${exam.courseId}`,
        value: exam.courseId,
        suggestion: 'Check course discovery completeness'
      });
    }

    // Check for duplicate IDs
    const examIds = exams.map(e => e.id);
    const duplicateExamIds = examIds.filter((id, index) => examIds.indexOf(id) !== index);
    
    for (const duplicateId of [...new Set(duplicateExamIds)]) {
      errors.push({
        field: 'id',
        message: `Duplicate exam ID found: ${duplicateId}`,
        value: duplicateId,
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalItems: courses.length + exams.length,
        validItems: courses.length + exams.length - errors.length,
        errorRate: errors.length / (courses.length + exams.length)
      }
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidId(id: string): boolean {
    // Allow alphanumeric characters, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(id);
  }

  public setRequiredCourseFields(fields: string[]): void {
    this.requiredCourseFields = fields;
  }

  public setRequiredExamFields(fields: string[]): void {
    this.requiredExamFields = fields;
  }
}

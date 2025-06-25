/**
 * Agentic Magic v2 - University Course & Exam Scraper
 * 
 * A robust, modular scraping system for extracting comprehensive
 * university course and exam data from Cineca CourseKatalog.
 * 
 * Features:
 * - Complete course discovery with modal path handling
 * - Detailed exam extraction with syllabus information
 * - Robust error handling and retry mechanisms
 * - Comprehensive logging and progress tracking
 * - Data validation and quality assurance
 * - Configurable batch processing
 * - Session management and recovery
 */

export * from './core/Scraper';
export * from './core/Config';
export * from './core/Session';
export * from './types';
export * from './utils';

// Main API
export { AgenticScraper } from './AgenticScraper';

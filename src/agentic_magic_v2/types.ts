/**
 * Core Types for Agentic Magic v2
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface ScrapingConfig {
  university: {
    id: string;
    name: string;
    baseUrl: string;
    courseListUrl: string;
  };
  
  scraping: {
    batchSize: number;
    concurrency: number;
    delayBetweenRequests: number;
    delayBetweenBatches: number;
    timeout: number;
    userAgent: string;
    maxRetries: number;
    retryDelay: number;
  };
  
  browser: {
    headless: boolean;
    viewport: { width: number; height: number };
    args: string[];
  };
  
  output: {
    dataDir: string;
    logsDir: string;
    enableJsonl: boolean;
    enableCompression: boolean;
  };
  
  recovery: {
    enableCheckpoints: boolean;
    enableSessionRecovery: boolean;
    maxRecoveryAttempts: number;
  };
  
  validation: {
    enableStrictValidation: boolean;
    requiredFields: string[];
    maxErrorRate: number;
  };
}

export interface CourseDiscoveryConfig extends ScrapingConfig {
  discovery: {
    maxDepth: number;
    followModalPaths: boolean;
    extractYearLevels: boolean;
  };
}

export interface ExamDetailConfig extends ScrapingConfig {
  examExtraction: {
    extractSyllabus: boolean;
    followModules: boolean;
    followFractions: boolean;
    parseStructuredContent: boolean;
  };
}

// ============================================================================
// Data Types
// ============================================================================

export interface Course {
  id: string;
  universityId: string;
  name: string;
  url: string;
  code?: string;
  department?: string;
  degree?: string;
  level?: string;
  duration?: number;
  lastUpdated: string;
  metadata: {
    yearLevel?: number;
    modalPath?: string;
    scrapingSession: string;
    scrapingTimestamp: string;
  };
}

export interface Exam {
  id: string;
  universityId: string;
  courseId: string;
  courseName: string;
  name: string;
  url: string;
  
  // Basic Information
  code?: string;
  cfu?: number;
  hours?: number;
  year?: number;
  semester?: string;
  teachers?: string[];
  
  // Academic Details
  courseType?: string;
  activityType?: string;
  field?: string;
  language?: string;
  teachingActivityType?: string;
  evaluation?: string;
  teachingPeriod?: string;
  teachingMode?: string;
  disciplinarySector?: string;
  location?: string;
  
  // Syllabus Content
  goals?: string;              // Obiettivi formativi
  chapters?: string;           // Contenuti/Programma
  books?: string;              // Testi/Bibliografia
  requirements?: string;       // Prerequisiti
  teachingMethods?: string;    // Metodi didattici
  learningAssessment?: string; // Verifica dell'apprendimento
  extendedProgram?: string;    // Programma esteso
  libraryTexts?: string;       // Testi in biblioteca
  onlineResources?: string;    // Risorse online
  other?: string;              // Altre informazioni
  
  // Module/Fraction Information
  module?: string;
  fraction?: string;
  
  // Metadata
  color?: string;
  lastUpdated: string;
  deleted?: string | null;
  metadata: {
    scrapingSession: string;
    scrapingTimestamp: string;
    sourceUrl: string;
    hasModules?: boolean;
    hasFractions?: boolean;
    syllabusExtracted?: boolean;
    extractionErrors?: string[];
  };
}

export interface RawExamData {
  code: string;
  title: string;
  url: string;
  data: Record<string, any>;
  module?: string;
  fraction?: string;
}

// ============================================================================
// Processing Types
// ============================================================================

export interface CourseDiscoveryResult {
  course: string;
  url: string;
  year: number;
  yearLevel: number;
  path?: string;
}

export interface ProcessedCourseData {
  courses: Record<string, {
    name: string;
    urls: string[];
  }>;
  pathsyears: Record<string, {
    course: string;
    year: number;
    yearLevel: number;
    path?: string;
    url: string;
  }>;
}

// ============================================================================
// Session and Progress Types
// ============================================================================

export interface ScrapingSession {
  id: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  config: ScrapingConfig;
  
  progress: {
    coursesDiscovered: number;
    examsExtracted: number;
    syllabusScraped: number;
    totalSteps: number;
    currentStep: number;
    errors: number;
    warnings: number;
  };
  
  outputs: {
    courses?: string;
    exams?: string;
    dataExams?: string;
    dataCourses?: string;
    logs?: string;
  };
  
  errors: ScrapingError[];
}

// ============================================================================
// Error Types
// ============================================================================

export type ErrorType = 
  | 'validation' 
  | 'course_discovery' 
  | 'exam_extraction' 
  | 'syllabus_scraping' 
  | 'data_processing'
  | 'browser_initialization'
  | 'retry_exhausted'
  | 'batch_processing'
  | 'network'
  | 'parsing'
  | 'file_system';

export interface ScrapingError extends Error {
  type: ErrorType;
  code?: string;
  context?: any;
  retryable?: boolean;
}

// ============================================================================
// Result Types
// ============================================================================

export interface ScrapingResult<T> {
  success: boolean;
  data?: T;
  error?: ScrapingError;
  metadata?: {
    duration: number;
    attempts: number;
    timestamp: string;
  };
}

export interface BatchResult<T> {
  results: T[];
  errors: ScrapingError[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    duration: number;
  };
}

// ============================================================================
// Event Types
// ============================================================================

export interface ScrapingEvent {
  type: 'progress' | 'error' | 'warning' | 'info' | 'debug';
  message: string;
  data?: any;
  timestamp: string;
  sessionId: string;
}

export type EventHandler = (event: ScrapingEvent) => void;

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalItems: number;
    validItems: number;
    errorRate: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: any;
  suggestion?: string;
}

// ============================================================================
// Database/Output Types
// ============================================================================

export interface DataExam extends Exam {
  _id?: { $oid: string };
  groupCode: string;
  baseUrl: string;
}

export interface DataCourse {
  _id?: { $oid: string };
  id: string;
  universityId: string;
  name: string;
  lastUpdated: string;
  deleted: string | null;
  exams: Array<{
    id: string;
    name: string;
    cfu: number;
    year: string;
    semester: string;
    url: string;
  }>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ProgressMetrics {
  startTime: number;
  itemsProcessed: number;
  totalItems: number;
  errorsCount: number;
  averageTimePerItem: number;
  estimatedTimeRemaining: number;
}

export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  exponentialBackoff: boolean;
  shouldRetry?: (error: Error) => boolean;
}

// ============================================================================
// Field Mapping Types
// ============================================================================

export interface FieldMapping {
  [originalKey: string]: string;
}

export const EXAM_FIELD_MAPPING: FieldMapping = {
  'Tipo di corso': 'courseType',
  'Anno di offerta': 'offerYear',
  'Tipo Attività Formativa': 'activityType',
  'Ambito': 'field',
  'Lingua di erogazione': 'language',
  'Tipo attività didattica': 'teachingActivityType',
  'Valutazione': 'evaluation',
  'Periodo didattico': 'teachingPeriod',
  'Modalita didattica': 'teachingMode',
  'Settore scientifico disciplinare': 'disciplinarySector',
  'Sede': 'location',
  'Attività correlate': 'relatedActivities',
  'Altri Percorsi': 'otherPaths',
  'Tipologia interclasse': 'interclassType',
  'Ambito Interclasse': 'interclassField',

  'Contenuti': 'chapters',
  'Contenuti  per il gruppo studenti': 'chapters',
  'Contenuti/Programma del corso': 'chapters',

  'Testi': 'books',
  'Testi  per il gruppo studenti': 'books',
  'Libri di testo/Libri consigliati': 'books',

  'Obiettivi formativi': 'goals',
  'Obiettivi formativi e risultati di apprendimento attesi': 'goals',
  'Obiettivi formativi  per il gruppo studenti': 'goals',

  'Prerequisiti': 'requirements',
  'Prerequisiti  per il gruppo studenti': 'requirements',

  'Metodi didattici': 'teachingMethods',
  'Metodi didattici  per il gruppo studenti': 'teachingMethods',
  'Metodi didattici utilizzati e attività di apprendimento richieste allo studente': 'teachingMethods',

  "Verifica dell'apprendimento": 'learningAssessment',
  "Verifica dell'apprendimento  per il gruppo studenti": 'learningAssessment',
  "Metodi di accertamento e criteri di valutazione": 'learningAssessment',

  'Programma esteso': 'extendedProgram',
  'Programma esteso  per il gruppo studenti': 'extendedProgram',

  'Testi disponibili nel catalogo delle biblioteche': 'libraryTexts',
  'Testi disponibili nel catalogo delle biblioteche  per il gruppo studenti': 'libraryTexts',

  'Risorse online': 'onlineResources',
  'Risorse online  per il gruppo studenti': 'onlineResources',
  
  'Altro': 'other',
  'Altre informazioni': 'other',
  'Altro  per il gruppo studenti': 'other',
};

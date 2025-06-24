export interface ScrapingConfig {
  university: UniversityConfig;
  scraping: ScrapingSettings;
  validation: ValidationSettings;
  output: OutputSettings;
  recovery: RecoverySettings;
  monitoring: MonitoringSettings;
}

export interface UniversityConfig {
  id: string;
  name: string;
  baseUrl: string;
  type: string;
  coursesPath: string;
  numberOfYears: number;
}

export interface ScrapingSettings {
  concurrency: number;
  delayBetweenRequests: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  userAgent: string;
  enableCaching: boolean;
  respectRobotsTxt: boolean;
}

export interface ValidationSettings {
  enforceRequired: boolean;
  validateUrls: boolean;
  validateDates: boolean;
  maxTitleLength: number;
  maxDescriptionLength: number;
}

export interface OutputSettings {
  dataDir: string;
  logsDir: string;
  reportsDir: string;
  backupDir: string;
  sessionPrefix: string;
  enableBackups: boolean;
  compressionLevel: number;
}

export interface RecoverySettings {
  enableCheckpoints: boolean;
  checkpointInterval: number;
  maxSessionRetention: number;
}

export interface MonitoringSettings {
  enableMetrics: boolean;
  enableProgressTracking: boolean;
  enableResourceMonitoring: boolean;
  alertThresholds: {
    errorRate: number;
    memoryUsage: number;
    diskUsage: number;
  };
}

export interface CourseData {
  id: string;
  universityId: string;
  name: string;
  url: string;
  type: string;
  lastUpdated: string;
  deleted: string | null;
  exams: ExamReference[];
  metadata?: {
    scrapingSession: string;
    scrapingTimestamp: string;
    sourceUrl: string;
  };
}

export interface ExamReference {
  examId: string;
  parentExam?: string;
  year: string;
  semester: string;
}

export interface ExamData {
  id: string;
  parentExam?: string;
  universityId: string;
  course: string;
  courseId: string;
  name: string;
  url: string;
  lastUpdated: string;
  deleted: string | null;
  goals?: string;
  chapters?: ChapterData[];
  examMode?: string;
  requirements?: string;
  cfu?: string;
  language?: string;
  teachers?: TeacherData[];
  books?: BookData;
  metadata?: {
    scrapingSession: string;
    scrapingTimestamp: string;
    sourceUrl: string;
    hasModules: boolean;
    hasFractions: boolean;
  };
}

export interface ChapterData {
  name: string;
  showTasks: boolean;
  tasks: TaskData[];
  postIts: PostItData[];
}

export interface TaskData {
  name: string;
}

export interface PostItData {
  color: string;
  content: string;
}

export interface TeacherData {
  name: string;
}

export interface BookData {
  books: BookInfo[];
}

export interface BookInfo {
  name: string;
  authors: string[];
  year?: number;
}

export interface ScrapingResult<T> {
  success: boolean;
  data?: T;
  error?: ScrapingError;
  metadata: {
    url: string;
    timestamp: string;
    duration: number;
    retryCount: number;
  };
}

export interface ScrapingError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
  stack?: string;
}

export enum ErrorType {
  NETWORK = 'NETWORK',
  PARSING = 'PARSING',
  VALIDATION = 'VALIDATION',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTHENTICATION = 'AUTHENTICATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface ProgressStatus {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  rate: number;
  eta: number;
  currentItem?: string;
}

export interface SessionReport {
  sessionId: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  summary: {
    totalItems: number;
    successful: number;
    failed: number;
    skipped: number;
    successRate: number;
    duration: number;
  };
  courses?: {
    discovered: number;
    successful: number;
    failed: number;
    failedItems: string[];
  };
  exams?: {
    extracted: number;
    successful: number;
    failed: number;
    failedItems: string[];
  };
  errors: ErrorSummary;
  performance: PerformanceMetrics;
}

export interface ErrorSummary {
  byType: Record<ErrorType, number>;
  byCode: Record<string, number>;
  topErrors: Array<{
    message: string;
    count: number;
    examples: string[];
  }>;
}

export interface PerformanceMetrics {
  averageRequestTime: number;
  requestsPerSecond: number;
  memoryUsage: {
    peak: number;
    average: number;
  };
  networkStats: {
    totalRequests: number;
    failedRequests: number;
    retries: number;
    timeouts: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: any;
}

export interface BackupMetadata {
  sessionId: string;
  timestamp: string;
  type: 'courses' | 'exams' | 'full';
  fileCount: number;
  totalSize: number;
  checksum: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryOnErrors: ErrorType[];
}

export interface QueueItem<T> {
  id: string;
  data: T;
  priority: number;
  retryCount: number;
  lastAttempt?: string;
  error?: ScrapingError;
}

export interface Checkpoint {
  sessionId: string;
  timestamp: string;
  step: string;
  progress: ProgressStatus;
  processedItems: string[];
  pendingItems: string[];
  failedItems: string[];
}

import { ScrapingError } from '../types';

/**
 * Utility helper functions for Agentic Magic v2
 */

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a standardized scraping error
 */
export function createError(
  type: ScrapingError['type'],
  message: string,
  url?: string,
  context?: any
): ScrapingError {
  return {
    type,
    message,
    url,
    timestamp: new Date().toISOString(),
    attempts: 1,
    stackTrace: new Error().stack,
    ...(context && { examId: context.examId, courseId: context.courseId })
  };
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Sanitize filename for file system
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        (result as any)[key] = deepMerge((result as any)[key] || {}, source[key]!);
      } else {
        (result as any)[key] = source[key]!;
      }
    }
  }
  
  return result;
}

/**
 * Generate a random color from a predefined palette
 */
export function generateRandomColor(): string {
  const colors = [
    '#FFD1DC', '#AEC6CF', '#77DD77', '#FDFD96', '#CBAACB', '#FFB347',
    '#FF6961', '#99C5C4', '#E3E4FA', '#AAF0D1', '#FFDAB9', '#CFCFC4',
    '#B2FFFF', '#F49AC2', '#BDFCC9', '#D7BDE2', '#F9E79F', '#A9DFBF',
    '#AED6F1', '#F5CBA7', '#FADBD8', '#D5F5E3', '#FDEBD0', '#E8DAEF',
    '#D6EAF8', '#FCF3CF', '#D1F2EB', '#F6DDCC', '#EBDEF0', '#D4E6F1',
    '#FAD7A0', '#E5E8E8', '#F5B7B1', '#D2B4DE', '#A3E4D7', '#F7DC6F'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Generate a unique ID
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Generate MongoDB-style ObjectId
 */
export function generateObjectId(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16);
  const randomBytes = Array.from({ length: 16 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return timestamp + randomBytes.slice(0, 16);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        break;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove undefined values from object
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const result = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value;
    }
  }
  return result;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

/**
 * Validate required fields in object
 */
export function validateRequiredFields<T extends Record<string, any>>(
  obj: T,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(field => 
    !(field in obj) || obj[field] === undefined || obj[field] === null || obj[field] === ''
  );
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

/**
 * Estimate remaining time based on progress
 */
export function estimateRemainingTime(
  startTime: number,
  current: number,
  total: number
): number {
  if (current === 0) return 0;
  
  const elapsed = Date.now() - startTime;
  const averageTimePerItem = elapsed / current;
  const remaining = total - current;
  
  return remaining * averageTimePerItem;
}

/**
 * Normalize text (trim, remove extra spaces, etc.)
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n');
}

/**
 * Extract numeric value from string
 */
export function extractNumber(str: string): number | null {
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Check if string contains any of the provided keywords
 */
export function containsKeywords(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

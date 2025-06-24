import { ScrapingError, ErrorType, RetryConfig } from '../types';
import { Logger } from './Logger';

export class RetryManager {
  private logger: Logger;
  private retryConfig: RetryConfig;

  constructor(logger: Logger, retryConfig?: Partial<RetryConfig>) {
    this.logger = logger;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      retryOnErrors: [
        ErrorType.NETWORK,
        ErrorType.TIMEOUT,
        ErrorType.RATE_LIMIT,
        ErrorType.SERVER_ERROR
      ],
      ...retryConfig
    };
  }

  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        this.logger.debug(`Executing ${context} (attempt ${attempt + 1}/${config.maxRetries + 1})`);
        
        const result = await operation();
        
        if (attempt > 0) {
          this.logger.info(`${context} succeeded after ${attempt} retries`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const scrapingError = this.convertToScrapingError(error);
        
        this.logger.warn(`${context} failed on attempt ${attempt + 1}: ${scrapingError.message}`);
        
        // Don't retry if this is the last attempt or if error type is not retryable
        if (attempt === config.maxRetries || !this.shouldRetry(scrapingError, config)) {
          break;
        }
        
        const delay = this.calculateDelay(attempt, config);
        this.logger.debug(`Waiting ${delay}ms before retry`);
        await this.sleep(delay);
      }
    }
    
    this.logger.error(`${context} failed after all retry attempts`, lastError);
    throw lastError || new Error(`Operation failed: ${context}`);
  }

  private shouldRetry(error: ScrapingError, config: RetryConfig): boolean {
    return config.retryOnErrors.includes(error.type);
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add up to 10% jitter
    const delay = exponentialDelay + jitter;
    
    return Math.min(delay, config.maxDelay);
  }

  private convertToScrapingError(error: any): ScrapingError {
    if (error.type && Object.values(ErrorType).includes(error.type)) {
      return error as ScrapingError;
    }

    // Try to categorize the error
    let type = ErrorType.UNKNOWN;
    let message = error.message || 'Unknown error';

    if (error.code) {
      switch (error.code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
        case 'ECONNRESET':
          type = ErrorType.NETWORK;
          break;
        case 'ETIMEDOUT':
          type = ErrorType.TIMEOUT;
          break;
        default:
          if (error.code.startsWith('E')) {
            type = ErrorType.NETWORK;
          }
      }
    }

    // Check for HTTP status codes
    if (error.response?.status) {
      const status = error.response.status;
      if (status === 404) {
        type = ErrorType.NOT_FOUND;
      } else if (status === 429) {
        type = ErrorType.RATE_LIMIT;
      } else if (status >= 500) {
        type = ErrorType.SERVER_ERROR;
      } else if (status >= 400) {
        type = ErrorType.AUTHENTICATION;
      }
    }

    // Check for timeout in message
    if (message.toLowerCase().includes('timeout')) {
      type = ErrorType.TIMEOUT;
    }

    // Check for rate limiting
    if (message.toLowerCase().includes('rate limit') || 
        message.toLowerCase().includes('too many requests')) {
      type = ErrorType.RATE_LIMIT;
    }

    return {
      type,
      message,
      code: error.code,
      details: error.response?.data || error.details,
      stack: error.stack
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }

  public updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  public async executeWithCustomBackoff<T>(
    operation: () => Promise<T>,
    context: string,
    delays: number[]
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < delays.length + 1; attempt++) {
      try {
        this.logger.debug(`Executing ${context} (attempt ${attempt + 1}/${delays.length + 1})`);
        
        const result = await operation();
        
        if (attempt > 0) {
          this.logger.info(`${context} succeeded after ${attempt} retries`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const scrapingError = this.convertToScrapingError(error);
        
        this.logger.warn(`${context} failed on attempt ${attempt + 1}: ${scrapingError.message}`);
        
        // Don't retry if this is the last attempt
        if (attempt === delays.length) {
          break;
        }
        
        const delay = delays[attempt];
        this.logger.debug(`Waiting ${delay}ms before retry`);
        await this.sleep(delay);
      }
    }
    
    this.logger.error(`${context} failed after all retry attempts`, lastError);
    throw lastError || new Error(`Operation failed: ${context}`);
  }

  public createRateLimitAwareRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRequestsPerMinute: number = 60
  ): () => Promise<T> {
    const requestTimes: number[] = [];
    
    return async (): Promise<T> => {
      // Clean old requests (older than 1 minute)
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      while (requestTimes.length > 0 && requestTimes[0] < oneMinuteAgo) {
        requestTimes.shift();
      }
      
      // If we're at the limit, wait
      if (requestTimes.length >= maxRequestsPerMinute) {
        const oldestRequest = requestTimes[0];
        const waitTime = oldestRequest + 60000 - now;
        if (waitTime > 0) {
          this.logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
          await this.sleep(waitTime);
        }
      }
      
      // Record this request
      requestTimes.push(now);
      
      return this.executeWithRetry(operation, context);
    };
  }
}

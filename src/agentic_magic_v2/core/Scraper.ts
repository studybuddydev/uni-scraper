import puppeteer, { Browser, Page } from 'puppeteer';
import { ScrapingConfig, ScrapingResult, ScrapingError, RetryOptions } from '../types';
import { Logger } from '../utils/Logger';
import { sleep, createError } from '../utils/helpers';

/**
 * Base Scraper Class
 * 
 * Provides common functionality for all scrapers including:
 * - Browser management
 * - Retry logic
 * - Error handling
 * - Rate limiting
 */

export abstract class BaseScraper<T> {
  protected config: ScrapingConfig;
  protected logger: Logger;
  protected browser: Browser | null = null;

  constructor(config: ScrapingConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the browser instance
   */
  protected async initializeBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: this.config.browser.headless,
        defaultViewport: this.config.browser.viewport,
        args: this.config.browser.args
      });

      this.logger.info('Browser initialized successfully');
      return this.browser;
    } catch (error) {
      throw createError('browser_initialization', `Failed to initialize browser: ${error}`);
    }
  }

  /**
   * Create a new page with common configuration
   */
  protected async createPage(): Promise<Page> {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(this.config.scraping.userAgent);

    // Set viewport
    await page.setViewport(this.config.browser.viewport);

    // Set timeout
    page.setDefaultTimeout(this.config.scraping.timeout);

    return page;
  }

  /**
   * Navigate to a URL with retry logic
   */
  protected async navigateWithRetry(page: Page, url: string, options?: { waitUntil?: any }): Promise<void> {
    const retryOptions: RetryOptions = {
      maxAttempts: this.config.scraping.maxRetries,
      delay: this.config.scraping.retryDelay,
      exponentialBackoff: true
    };

    await this.withRetry(async () => {
      await page.goto(url, {
        waitUntil: options?.waitUntil || 'networkidle0',
        timeout: this.config.scraping.timeout
      });
    }, retryOptions, `Navigation to ${url}`);
  }

  /**
   * Execute a function with retry logic
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
    context: string = 'Operation'
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === options.maxAttempts) {
          break;
        }

        if (options.shouldRetry && !options.shouldRetry(lastError)) {
          break;
        }

        const delay = options.exponentialBackoff 
          ? options.delay * Math.pow(2, attempt - 1)
          : options.delay;

        this.logger.warn(`${context} failed (attempt ${attempt}/${options.maxAttempts}): ${lastError.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }

    throw createError('retry_exhausted', `${context} failed after ${options.maxAttempts} attempts: ${lastError!.message}`);
  }

  /**
   * Process items in batches with rate limiting
   */
  protected async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = this.config.scraping.batchSize
  ): Promise<{ results: R[]; errors: ScrapingError[] }> {
    const results: R[] = [];
    const errors: ScrapingError[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(items.length / batchSize);

      this.logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

      // Process batch items concurrently but with limited concurrency
      const batchPromises = batch.map(async (item) => {
        try {
          const result = await processor(item);
          return { success: true, result, error: null };
        } catch (error) {
          const scrapingError = createError('batch_processing', `Failed to process item: ${error}`, undefined, item);
          return { success: false, result: null, error: scrapingError };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Collect results and errors
      for (const result of batchResults) {
        if (result.success) {
          results.push(result.result!);
        } else {
          errors.push(result.error!);
        }
      }

      // Rate limiting between batches
      if (i + batchSize < items.length) {
        this.logger.debug(`Waiting ${this.config.scraping.delayBetweenBatches}ms before next batch...`);
        await sleep(this.config.scraping.delayBetweenBatches);
      }
    }

    return { results, errors };
  }

  /**
   * Extract text content safely
   */
  protected async extractText(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (!element) return null;
      
      return await page.evaluate((el) => el.textContent?.trim() || null, element);
    } catch {
      return null;
    }
  }

  /**
   * Extract multiple text elements
   */
  protected async extractTexts(page: Page, selector: string): Promise<string[]> {
    try {
      return await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map(el => el.textContent?.trim() || '').filter(text => text);
      }, selector);
    } catch {
      return [];
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.logger.info('Browser closed successfully');
      } catch (error) {
        this.logger.warn(`Error closing browser: ${error}`);
      }
    }
  }

  /**
   * Check if browser is ready
   */
  protected isBrowserReady(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}

/**
 * Abstract scraper for specific scraping tasks
 */
export abstract class TaskScraper<TInput, TOutput> extends BaseScraper<TOutput> {
  /**
   * Main scraping method - must be implemented by subclasses
   */
  public abstract scrape(input: TInput): Promise<ScrapingResult<TOutput>>;

  /**
   * Validate input data
   */
  protected abstract validateInput(input: TInput): void;

  /**
   * Process scraped data
   */
  protected abstract processData(rawData: any): TOutput;
}

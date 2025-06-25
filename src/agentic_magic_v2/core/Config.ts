import { ScrapingConfig } from '../types';

/**
 * Configuration Management for Agentic Magic v2
 */

export const DEFAULT_CONFIG: ScrapingConfig = {
  university: {
    id: 'unibs',
    name: 'Università degli Studi di Brescia',
    baseUrl: 'https://unibs.coursecatalogue.cineca.it',
    courseListUrl: 'https://unibs.coursecatalogue.cineca.it/corsi-di-studio'
  },
  
  scraping: {
    batchSize: 5,
    concurrency: 3,
    delayBetweenRequests: 2000,
    delayBetweenBatches: 5000,
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    maxRetries: 3,
    retryDelay: 2000
  },
  
  browser: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  },
  
  output: {
    dataDir: './data',
    logsDir: './logs',
    enableJsonl: true,
    enableCompression: false
  },
  
  recovery: {
    enableCheckpoints: true,
    enableSessionRecovery: true,
    maxRecoveryAttempts: 3
  },
  
  validation: {
    enableStrictValidation: false,
    requiredFields: ['id', 'name', 'url'],
    maxErrorRate: 0.1
  }
};

export class Config {
  private config: ScrapingConfig;

  constructor(customConfig?: Partial<ScrapingConfig>) {
    this.config = this.mergeConfigs(DEFAULT_CONFIG, customConfig || {});
  }

  public get(): ScrapingConfig {
    return { ...this.config };
  }

  public update(updates: Partial<ScrapingConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
  }

  public getUniversityConfig() {
    return this.config.university;
  }

  public getScrapingConfig() {
    return this.config.scraping;
  }

  public getBrowserConfig() {
    return this.config.browser;
  }

  public getOutputConfig() {
    return this.config.output;
  }

  public getRecoveryConfig() {
    return this.config.recovery;
  }

  public getValidationConfig() {
    return this.config.validation;
  }

  private mergeConfigs(base: ScrapingConfig, updates: Partial<ScrapingConfig>): ScrapingConfig {
    return {
      university: { ...base.university, ...updates.university },
      scraping: { ...base.scraping, ...updates.scraping },
      browser: { ...base.browser, ...updates.browser },
      output: { ...base.output, ...updates.output },
      recovery: { ...base.recovery, ...updates.recovery },
      validation: { ...base.validation, ...updates.validation }
    };
  }

  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate university config
    if (!this.config.university.id) {
      errors.push('University ID is required');
    }
    if (!this.config.university.baseUrl) {
      errors.push('University base URL is required');
    }
    if (!this.config.university.courseListUrl) {
      errors.push('University course list URL is required');
    }

    // Validate scraping config
    if (this.config.scraping.batchSize <= 0) {
      errors.push('Batch size must be greater than 0');
    }
    if (this.config.scraping.concurrency <= 0) {
      errors.push('Concurrency must be greater than 0');
    }
    if (this.config.scraping.timeout <= 0) {
      errors.push('Timeout must be greater than 0');
    }

    // Validate output config
    if (!this.config.output.dataDir) {
      errors.push('Data directory is required');
    }
    if (!this.config.output.logsDir) {
      errors.push('Logs directory is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public static fromFile(configPath: string): Config {
    try {
      const fs = require('fs');
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return new Config(configData);
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error}`);
    }
  }

  public toFile(configPath: string): void {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure directory exists
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config to ${configPath}: ${error}`);
    }
  }
}

import fs from 'fs';
import path from 'path';
import { ScrapingConfig } from '../types';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: ScrapingConfig | null = null;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public loadConfig(configPath?: string): ScrapingConfig {
    if (this.config) {
      return this.config;
    }

    // Use process.cwd() to get paths relative to project root
    const defaultConfigPath = path.join(process.cwd(), 'src/agentic_magic/config/scraping.config.json');
    const finalConfigPath = configPath || defaultConfigPath;

    if (!fs.existsSync(finalConfigPath)) {
      throw new Error(`Configuration file not found: ${finalConfigPath}`);
    }

    try {
      const configContent = fs.readFileSync(finalConfigPath, 'utf-8');
      this.config = JSON.parse(configContent) as ScrapingConfig;
      this.validateConfig(this.config);
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  public getConfig(): ScrapingConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  public updateConfig(updates: Partial<ScrapingConfig>): void {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    this.config = { ...this.config, ...updates };
    this.validateConfig(this.config);
  }

  private validateConfig(config: ScrapingConfig): void {
    const required = [
      'university.id',
      'university.baseUrl',
      'scraping.concurrency',
      'output.dataDir'
    ];

    for (const field of required) {
      const value = this.getNestedValue(config, field);
      if (value === undefined || value === null) {
        throw new Error(`Required configuration field missing: ${field}`);
      }
    }

    // Validate ranges
    if (config.scraping.concurrency < 1 || config.scraping.concurrency > 20) {
      throw new Error('Concurrency must be between 1 and 20');
    }

    if (config.scraping.maxRetries < 0 || config.scraping.maxRetries > 10) {
      throw new Error('Max retries must be between 0 and 10');
    }

    // Validate URLs
    try {
      new URL(config.university.baseUrl);
    } catch {
      throw new Error('Invalid base URL in configuration');
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  public createConfigFromTemplate(): void {
    // Use process.cwd() to get paths relative to project root
    const templatePath = path.join(process.cwd(), 'src/agentic_magic/config/scraping.config.example.json');
    const configPath = path.join(process.cwd(), 'src/agentic_magic/config/scraping.config.json');

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Configuration template not found at: ${templatePath}`);
    }

    if (fs.existsSync(configPath)) {
      throw new Error('Configuration file already exists');
    }

    fs.copyFileSync(templatePath, configPath);
    console.log(`Configuration file created at: ${configPath}`);
    console.log('Please edit the configuration file before running the scraper.');
  }
}

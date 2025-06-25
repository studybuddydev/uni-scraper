/**
 * Configuration for the simplified university scraper pipeline
 */

export interface ScrapingConfig {
  university: 'unibs' | 'unitn';
  type: 'triennale' | 'magistrale' | 'ciclounico';
  url: string;
  numberOfYears: number;
  outputName?: string;
}

// Default configuration - can be overridden
export const defaultConfig: ScrapingConfig = {
  university: 'unibs',
  type: 'triennale', 
  url: '/corsi/2025?gruppo=1617109934164',
  numberOfYears: 5,
};

export function getScrapingName(config: ScrapingConfig): string {
  return config.outputName || `${config.university}-${config.type}`;
}

export function getBaseUrl(config: ScrapingConfig): string {
  return `https://${config.university}.coursecatalogue.cineca.it`;
}

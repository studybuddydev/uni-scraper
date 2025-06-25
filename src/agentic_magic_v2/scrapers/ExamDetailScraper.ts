import { BaseScraper } from '../core/Scraper';
import { ExamDetailConfig, ExamInfo } from '../types';
import { Logger } from '../utils/Logger';

export class ExamDetailScraper extends BaseScraper<ExamInfo[]> {
  constructor(config: ExamDetailConfig, logger: Logger) {
    super(config, logger);
  }

  protected async scrapeImpl(): Promise<ExamInfo[]> {
    this.logger.info('Starting exam detail scraping...');
    
    // For now, return a placeholder implementation
    // TODO: Implement actual exam detail scraping logic
    return [];
  }

  protected validateResult(result: ExamInfo[]): boolean {
    return Array.isArray(result);
  }
}

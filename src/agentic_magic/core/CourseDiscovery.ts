import puppeteer, { Browser, Page } from 'puppeteer';
import { ScrapingConfig, ScrapingResult, CourseData, ErrorType } from '../types';
import { Logger } from '../utils/Logger';
import { RetryManager } from '../utils/RetryManager';
import { ProgressTracker } from '../utils/ProgressTracker';

interface DegreeInfo {
  courseName: string;
  year: string;          // Text from dropdown (e.g., "Primo Anno", "Secondo Anno")
  yearLevel: number;     // Numeric year level (1, 2, 3, etc.)
  path: string;
  urlCourse: string;
  urlYear: string;
  urlPath: string;
}

export class CourseDiscovery {
  private config: ScrapingConfig;
  private logger: Logger;
  private retryManager: RetryManager;
  private progressTracker: ProgressTracker;
  private browser: Browser | null = null;

  constructor(config: ScrapingConfig, logger: Logger, progressTracker: ProgressTracker) {
    this.config = config;
    this.logger = logger;
    this.retryManager = new RetryManager(logger, {
      maxRetries: config.scraping.maxRetries,
      baseDelay: config.scraping.retryDelay,
      backoffFactor: 2
    });
    this.progressTracker = progressTracker;
  }

  public async discoverCourses(): Promise<ScrapingResult<DegreeInfo[]>> {
    const startTime = Date.now();
    this.logger.info('Starting course discovery');

    try {
      await this.initializeBrowser();
      const page = await this.browser!.newPage();
      await this.configurePage(page);

      // Get the main courses URL
      const mainUrl = `${this.config.university.baseUrl}${this.config.university.coursesPath}`;
      this.logger.info(`Navigating to main courses page: ${mainUrl}`);

      const courseUrls = await this.retryManager.executeWithRetry(
        () => this.getAllCoursesUrls(page, mainUrl, this.config.university.baseUrl),
        'Get all course URLs'
      );

      this.logger.info(`Found ${courseUrls.length} course URLs`);
      this.progressTracker.setTotal(courseUrls.length);

      const allDegreeInfo: DegreeInfo[] = [];

      for (let i = 0; i < courseUrls.length; i++) {
        const courseUrl = courseUrls[i];
        this.progressTracker.increment(true, `Processing course ${i + 1}/${courseUrls.length}`);

        try {
          const degreeInfo = await this.retryManager.executeWithRetry(
            () => this.getExamListFromDegree(page, courseUrl, this.config.university.baseUrl),
            `Process course: ${courseUrl}`
          );

          allDegreeInfo.push(...degreeInfo);
          this.logger.debug(`Processed course ${i + 1}/${courseUrls.length}: ${degreeInfo.length} degree paths found`);

          // Rate limiting
          if (this.config.scraping.delayBetweenRequests > 0) {
            await this.sleep(this.config.scraping.delayBetweenRequests);
          }
        } catch (error) {
          this.logger.error(`Failed to process course ${courseUrl}:`, error);
          this.progressTracker.increment(false);
        }
      }

      await page.close();
      await this.closeBrowser();

      const duration = Date.now() - startTime;
      this.logger.info(`Course discovery completed. Found ${allDegreeInfo.length} degree paths in ${duration}ms`);

      return {
        success: true,
        data: allDegreeInfo,
        metadata: {
          url: mainUrl,
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };

    } catch (error) {
      await this.closeBrowser();
      const duration = Date.now() - startTime;
      
      this.logger.error('Course discovery failed:', error);
      
      return {
        success: false,
        error: {
          type: ErrorType.UNKNOWN,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        metadata: {
          url: `${this.config.university.baseUrl}${this.config.university.coursesPath}`,
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.logger.debug('Initializing browser');
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
  }

  private async configurePage(page: Page): Promise<void> {
    await page.setUserAgent(this.config.scraping.userAgent);
    await page.setDefaultTimeout(this.config.scraping.timeout);
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable JavaScript execution for Angular apps
    await page.setJavaScriptEnabled(true);
    
    // Block only images and fonts to speed up scraping, but keep CSS for Angular
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Add error handling for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.logger.debug(`Page console error: ${msg.text()}`);
      }
    });

    // Handle page errors
    page.on('pageerror', (error) => {
      this.logger.debug(`Page error: ${error.message}`);
    });
  }

  private async getAllCoursesUrls(page: Page, degreeUrl: string, baseUrl: string): Promise<string[]> {
    try {
      this.logger.info(`Navigating to: ${degreeUrl}`);
      await page.goto(degreeUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Wait for Angular content to load - try multiple selectors
      this.logger.debug('Waiting for course content to load...');
      
      try {
        // First try to wait for the main container
        await page.waitForSelector('.corsi-group', { timeout: 15000 });
        this.logger.debug('Found .corsi-group container');
      } catch (error) {
        this.logger.warn('Could not find .corsi-group, trying alternative selectors');
        
        // Try waiting for any course-related content
        try {
          await page.waitForSelector('[class*="corsi"]', { timeout: 10000 });
          this.logger.debug('Found alternative course selector');
        } catch (altError) {
          this.logger.error('No course containers found');
          throw new Error('No course content found on page');
        }
      }

      // Give Angular more time to render the course links
      await this.sleep(3000);
      
      // Try multiple approaches to get course URLs
      const degreeUrls = await page.evaluate(() => {
        const urls: string[] = [];
        
        // Primary selector: .corsi-leaf a
        let degreeElements = document.querySelectorAll('.corsi-leaf a');
        console.log(`Found ${degreeElements.length} elements with .corsi-leaf a`);
        
        degreeElements.forEach((element) => {
          const url = element.getAttribute('href');
          const text = element.textContent?.trim();
          console.log(`Course link: ${text} -> ${url}`);
          if (url && !urls.includes(url)) { 
            urls.push(url); 
          }
        });

        // Fallback: try broader selectors if no URLs found
        if (urls.length === 0) {
          console.log('No URLs found with primary selector, trying fallbacks...');
          
          // Try .corsi-leaf without requiring 'a' tag
          const leafElements = document.querySelectorAll('.corsi-leaf');
          console.log(`Found ${leafElements.length} .corsi-leaf elements`);
          
          leafElements.forEach((leaf) => {
            const links = leaf.querySelectorAll('a');
            links.forEach((link) => {
              const url = link.getAttribute('href');
              const text = link.textContent?.trim();
              console.log(`Fallback course link: ${text} -> ${url}`);
              if (url && !urls.includes(url)) {
                urls.push(url);
              }
            });
          });
        }

        // Last resort: any link that looks like a course
        if (urls.length === 0) {
          console.log('Still no URLs, trying last resort selectors...');
          const allLinks = document.querySelectorAll('a[href*="/corsi/"]');
          console.log(`Found ${allLinks.length} links containing /corsi/`);
          
          allLinks.forEach((link) => {
            const url = link.getAttribute('href');
            const text = link.textContent?.trim();
            console.log(`Last resort link: ${text} -> ${url}`);
            if (url && !urls.includes(url)) {
              urls.push(url);
            }
          });
        }

        return urls;
      });

      const fullUrls = degreeUrls.map(url => {
        // Handle both absolute and relative URLs
        if (url.startsWith('http')) {
          return url;
        } else if (url.startsWith('/')) {
          return `${baseUrl}${url}`;
        } else {
          return `${baseUrl}/${url}`;
        }
      });

      this.logger.info(`Found ${fullUrls.length} course URLs`);
      if (fullUrls.length > 0) {
        this.logger.debug('Sample URLs:', fullUrls.slice(0, 3));
      }

      return fullUrls;
    } catch (error) {
      this.logger.error(`Failed to get course URLs from ${degreeUrl}:`, error);
      
      // Log page content for debugging
      try {
        const pageContent = await page.content();
        const hasCorsiGroup = pageContent.includes('corsi-group');
        const hasCorsiLeaf = pageContent.includes('corsi-leaf');
        const linkCount = (pageContent.match(/href="/g) || []).length;
        
        this.logger.debug(`Page analysis: corsi-group=${hasCorsiGroup}, corsi-leaf=${hasCorsiLeaf}, total links=${linkCount}`);
        
        // Save a small portion of the HTML for debugging
        const titleMatch = pageContent.match(/<title[^>]*>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : 'No title';
        this.logger.debug(`Page title: ${title}`);
        
      } catch (debugError) {
        this.logger.warn('Could not analyze page content for debugging');
      }
      
      return [];
    }
  }

  private async getExamListFromDegree(page: Page, url: string, baseUrl: string): Promise<DegreeInfo[]> {
    const results: DegreeInfo[] = [];

    try {
      await page.goto(url, { waitUntil: 'networkidle0' });
      await page.waitForSelector('a', { timeout: 10000 });
      await this.sleep(3000); // Allow page to fully load

      const pageTitle = await this.getDegreeTitle(page);
      this.logger.debug(`Processing course: ${pageTitle}`);

      // Dynamically detect available year options
      const dropdownExists = await page.$('#offerta-formativa');
      if (!dropdownExists) {
        this.logger.warn(`Year dropdown not found for course ${pageTitle}, skipping`);
        return []; // Skip this course
      }

      // Get all available options
      const availableOptions = await page.$$eval('#offerta-formativa option', options => 
        options.map(option => ({
          value: option.value,
          text: option.textContent?.trim() || ''
        })).filter(opt => opt.value && opt.value !== '' && opt.text !== '')
      );

      this.logger.debug(`Found ${availableOptions.length} year options for course ${pageTitle}: ${availableOptions.map(opt => opt.text).join(', ')}`);

      // Process all available academic years (no limit)
      for (let i = 0; i < availableOptions.length; i++) {
        const option = availableOptions[i];
        try {
          this.logger.debug(`Attempting to select year ${i}: ${option.text} (value: ${option.value})`);
          
          // Reload the page before each academic year to ensure clean state
          if (i > 0) {
            this.logger.debug(`Reloading page for year ${i} to reset dropdown state`);
            await page.goto(url, { waitUntil: 'networkidle0' });
            await page.waitForSelector('a', { timeout: 10000 });
            await this.sleep(3000);
          }
          
          // Check if dropdown exists after potential reload
          const dropdownExists = await page.$('#offerta-formativa');
          if (!dropdownExists) {
            throw new Error('Dropdown no longer exists on page after reload');
          }
          
          // Re-get available options after reload (they might have changed)
          const currentOptions = await page.$$eval('#offerta-formativa option', options => 
            options.map(option => ({
              value: option.value,
              text: option.textContent?.trim() || ''
            })).filter(opt => opt.value && opt.value !== '' && opt.text !== '')
          );
          
          // Find the option we want (by text, since values might change after reload)
          const targetOption = currentOptions.find(opt => opt.text === option.text);
          if (!targetOption) {
            throw new Error(`Option "${option.text}" no longer available after reload`);
          }
          
          await page.select('#offerta-formativa', targetOption.value);
          await this.sleep(1000);

          const yearUrl = page.url();
          const year = await this.getSelectedText(page);
          this.logger.debug(`  Successfully selected year: ${year}`);

          // Now get the insegnamenti link for this year
          const linkHref = await this.getLinkHref(page);

          if (pageTitle && linkHref) {
            // Check if this course has multiple paths (modal selection)
            const paths = linkHref.split('?')[0].endsWith('insegnamenti') ? 
              await this.selectCareer(page, linkHref, baseUrl) : 
              [{ name: '', url: linkHref }];

            for (const path of paths) {
              results.push({
                courseName: pageTitle,
                year: year,
                yearLevel: i + 1,  // Convert 0-based index to 1-based year level
                path: path.name,
                urlCourse: url,
                urlYear: yearUrl,
                urlPath: path.url,
              });
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Get current URL safely
          let currentUrl = 'no-page';
          try {
            if (page) {
              currentUrl = await page.url();
            }
          } catch (urlError) {
            currentUrl = 'url-error';
          }
          
          this.logger.error(`Failed to process year ${i} (${option.text}) for course ${pageTitle}: ${errorMessage}`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            courseUrl: url,
            yearIndex: i,
            yearValue: option.value,
            yearText: option.text,
            currentUrl: currentUrl
          });
          
          // Add specific debugging for common issues
          try {
            if (page) {
              const hasDropdown = await page.$('#offerta-formativa').catch(() => null);
              const hasInsegnamenti = await page.$('a[href*="insegnamenti"]').catch(() => null);
              this.logger.debug(`Debugging year ${i}: dropdown=${!!hasDropdown}, insegnamenti=${!!hasInsegnamenti}`);
            }
          } catch (debugError) {
            this.logger.debug(`Debug check failed: ${debugError}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process course ${url}:`, error);
    }

    return results;
  }

  private async processYearsForPath(
    page: Page, 
    courseTitle: string, 
    path: { name: string; url: string }, 
    originalCourseUrl: string, 
    baseUrl: string, 
    results: DegreeInfo[]
  ): Promise<void> {
    // Try different year selections
    const selectionValues = ['0: Object', '1: Object', '2: Object', '3: Object', '4: Object', '5: Object', '6: Object'];

    for (let i = 0; i < Math.min(selectionValues.length, this.config.university.numberOfYears); i++) {
      try {
        const value = selectionValues[i];
        
        // Check if the dropdown exists and has this option
        const dropdownExists = await page.$('#offerta-formativa');
        if (!dropdownExists) {
          this.logger.warn(`Year dropdown not found for course ${courseTitle}, path ${path.name}, skipping year ${i}`);
          continue;
        }
        
        // Check if this specific option exists
        const optionExists = await page.$(`#offerta-formativa option[value="${value}"]`);
        if (!optionExists) {
          this.logger.debug(`Option ${value} not available for course ${courseTitle}, path ${path.name}, stopping year iteration`);
          break; // Stop trying more years if this option doesn't exist
        }
        
        await page.select('#offerta-formativa', value);
        await this.sleep(1000);

        const yearUrl = page.url();
        const year = await this.getSelectedText(page);
        this.logger.debug(`  Processing year: ${year} for path: ${path.name}`);

        // Get the actual insegnamenti URL for this year/path combination
        const currentPathUrl = await this.getCurrentPathUrl(page, path.url);

        results.push({
          courseName: courseTitle,
          year: year,
          yearLevel: i + 1,  // Convert 0-based index to 1-based year level
          path: path.name,
          urlCourse: originalCourseUrl,
          urlYear: yearUrl,
          urlPath: currentPathUrl,
        });

      } catch (error) {
        this.logger.error(`Failed to process year ${i} (${selectionValues[i]}) for course ${courseTitle}, path ${path.name}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          courseUrl: originalCourseUrl,
          pathName: path.name,
          yearIndex: i,
          yearValue: selectionValues[i]
        });
      }
    }
  }

  private async getCurrentPathUrl(page: Page, fallbackUrl: string): Promise<string> {
    try {
      // Try to get the current URL which should reflect the year/path selection
      const currentUrl = page.url();
      if (currentUrl && currentUrl !== fallbackUrl) {
        return currentUrl;
      }
      
      // If the URL hasn't changed, try to find an updated link
      const updatedLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const insegnLink = links.find(a => {
          const text = a.textContent?.trim().toLowerCase();
          return text === 'piani di studio e insegnamenti' || text === 'insegnamenti';
        });
        return insegnLink?.href;
      });
      
      return updatedLink || fallbackUrl;
    } catch (error) {
      this.logger.warn('Failed to get current path URL, using fallback:', error);
      return fallbackUrl;
    }
  }

  private async getDegreeTitle(page: Page): Promise<string> {
    try {
      await page.waitForSelector('h1.corso-title.u-filetto', { timeout: 5000 });
      return await page.evaluate(() => {
        const element = document.querySelector('h1.corso-title.u-filetto');
        return element?.textContent?.trim() || '';
      });
    } catch {
      return 'Not found';
    }
  }

  private async getSelectedText(page: Page): Promise<string> {
    return await page.evaluate(() => {
      const selectElement = document.querySelector('#offerta-formativa') as HTMLSelectElement;
      if (selectElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        return selectedOption ? selectedOption.text : 'No option selected';
      }
      return 'Select element not found';
    });
  }

  private async getLinkHref(page: Page): Promise<string | undefined> {
    return await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).find(a => {
        const text = a.textContent?.trim().toLowerCase();
        return text === 'piani di studio e insegnamenti' || text === 'insegnamenti';
      })?.href;
    });
  }

  private async selectCareer(page: Page, linkHref: string, baseUrl: string): Promise<Array<{ name: string; url: string }>> {
    try {
      await page.goto(linkHref, { waitUntil: 'networkidle0' });
      await this.sleep(3000);

      // Check for modal path selection first (like GIURISPRUDENZA)
      const modalExists = await page.$('.modal.open');
      if (modalExists) {
        this.logger.debug('Found modal with path selection');
        
        // Wait for modal content to load
        await page.waitForSelector('.modal.open .modal-body', { timeout: 5000 });
        
        const modalPaths = await page.evaluate(() => {
          const modal = document.querySelector('.modal.open .modal-body');
          if (!modal) return [];
          
          const links = modal.querySelectorAll('a');
          return Array.from(links).map(link => ({
            name: link.textContent?.trim() || '',
            url: link.href || ''
          }));
        });
        
        if (modalPaths.length > 0) {
          this.logger.info(`Found ${modalPaths.length} paths in modal:`, modalPaths.map(p => p.name));
          return modalPaths;
        }
      }

      // Check for traditional career path links (older pattern)
      const groupPaths = await page.evaluate((baseUrl: string) => {
        const links = document.querySelectorAll('.gruppo-percorsi a');
        return Array.from(links).map(link => ({
          name: link.textContent?.trim() || '',
          url: `${baseUrl}${link.getAttribute('href') || ''}`
        }));
      }, baseUrl);
      
      if (groupPaths.length > 0) {
        this.logger.info(`Found ${groupPaths.length} traditional career paths:`, groupPaths.map(p => p.name));
        return groupPaths;
      }

      // If no specific paths found, return the base URL as a single path
      this.logger.debug('No specific career paths found, using base URL');
      return [{ name: '', url: linkHref }];
      
    } catch (error) {
      this.logger.warn(`Failed to select career paths for ${linkHref}:`, error);
      return [{ name: '', url: linkHref }];
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async reDiscoverCourse(courseUrl: string): Promise<ScrapingResult<DegreeInfo[]>> {
    const startTime = Date.now();
    this.logger.info(`Re-discovering course: ${courseUrl}`);

    try {
      await this.initializeBrowser();
      const page = await this.browser!.newPage();
      await this.configurePage(page);

      const degreeInfo = await this.retryManager.executeWithRetry(
        () => this.getExamListFromDegree(page, courseUrl, this.config.university.baseUrl),
        `Re-discover course: ${courseUrl}`
      );

      await page.close();
      await this.closeBrowser();

      const duration = Date.now() - startTime;
      this.logger.info(`Course re-discovery completed. Found ${degreeInfo.length} degree paths in ${duration}ms`);

      return {
        success: true,
        data: degreeInfo,
        metadata: {
          url: courseUrl,
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };

    } catch (error) {
      await this.closeBrowser();
      const duration = Date.now() - startTime;
      
      this.logger.error('Course re-discovery failed:', error);
      
      return {
        success: false,
        error: {
          type: ErrorType.UNKNOWN,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        metadata: {
          url: courseUrl,
          timestamp: new Date().toISOString(),
          duration,
          retryCount: 0
        }
      };
    }
  }

  private extractYearFromUrl(url: string): string | null {
    try {
      // Extract year from URL patterns like /corsi/2025/ or /corsi/2024/
      const yearMatch = url.match(/\/corsi\/(\d{4})\//);
      if (yearMatch) {
        const startYear = parseInt(yearMatch[1]);
        return `${startYear}/${startYear + 1}`;
      }
      return null;
    } catch (error) {
      this.logger.debug(`Failed to extract year from URL ${url}:`, error);
      return null;
    }
  }
}

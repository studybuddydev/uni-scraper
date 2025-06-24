import fs from 'fs';
import path from 'path';

export class Logger {
  private logDir: string;
  private sessionId: string;
  private logLevel: 'debug' | 'info' | 'warn' | 'error';

  constructor(logDir: string, sessionId: string, logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.logDir = logDir;
    this.sessionId = sessionId;
    this.logLevel = logLevel;
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(this.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  }

  private writeLog(level: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      sessionId: this.sessionId,
      message,
      ...(data && { data })
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    // Write to session-specific log file
    const sessionLogFile = path.join(this.logDir, `${this.sessionId}.log`);
    fs.appendFileSync(sessionLogFile, logLine);

    // Write to general log file
    const generalLogFile = path.join(this.logDir, 'scraping.log');
    fs.appendFileSync(generalLogFile, logLine);

    // Console output with colors
    this.consoleLog(level, timestamp, message, data);
  }

  private consoleLog(level: string, timestamp: string, message: string, data?: any): void {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m'  // Red
    };
    
    const reset = '\x1b[0m';
    const color = colors[level as keyof typeof colors] || '';
    
    const timeStr = new Date(timestamp).toLocaleTimeString();
    console.log(`${color}[${level.toUpperCase()}]${reset} ${timeStr} - ${message}`);
    
    if (data && level === 'debug') {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  public debug(message: string, data?: any): void {
    this.writeLog('debug', message, data);
  }

  public info(message: string, data?: any): void {
    this.writeLog('info', message, data);
  }

  public warn(message: string, data?: any): void {
    this.writeLog('warn', message, data);
  }

  public error(message: string, error?: Error | any): void {
    let errorData;
    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else if (error) {
      errorData = error;
    }
    
    this.writeLog('error', message, errorData);
  }

  public logProgress(current: number, total: number, item?: string): void {
    const percentage = ((current / total) * 100).toFixed(1);
    const message = `Progress: ${current}/${total} (${percentage}%)${item ? ` - ${item}` : ''}`;
    this.info(message);
  }

  public logPerformance(operation: string, duration: number, details?: any): void {
    const message = `Performance: ${operation} took ${duration}ms`;
    this.debug(message, details);
  }

  public createErrorLog(sessionId: string, errors: any[]): void {
    const errorLogFile = path.join(this.logDir, `${sessionId}-errors.json`);
    const errorSummary = {
      sessionId,
      timestamp: new Date().toISOString(),
      totalErrors: errors.length,
      errors: errors.map(error => ({
        timestamp: error.timestamp || new Date().toISOString(),
        type: error.type,
        message: error.message,
        url: error.url,
        details: error.details
      }))
    };

    fs.writeFileSync(errorLogFile, JSON.stringify(errorSummary, null, 2));
    this.info(`Error log written to: ${errorLogFile}`);
  }

  public getLogFiles(): string[] {
    if (!fs.existsSync(this.logDir)) {
      return [];
    }
    
    return fs.readdirSync(this.logDir)
      .filter(file => file.endsWith('.log') || file.endsWith('.json'))
      .map(file => path.join(this.logDir, file));
  }

  public cleanOldLogs(retentionDays: number = 30): void {
    if (!fs.existsSync(this.logDir)) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const files = fs.readdirSync(this.logDir);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.info(`Cleaned ${deletedCount} old log files`);
    }
  }
}

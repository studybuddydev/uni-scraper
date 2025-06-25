import fs from 'fs';
import path from 'path';
import { LogLevel } from '../types';

/**
 * Enhanced Logger for Agentic Magic v2
 */

export class Logger {
  private sessionId: string;
  private logDir: string;
  private logFile: string;
  private level: LogLevel;

  constructor(logDir: string, sessionId: string, level: LogLevel = 'info') {
    this.sessionId = sessionId;
    this.logDir = logDir;
    this.logFile = path.join(logDir, `${sessionId}.log`);
    this.level = level;
    
    this.ensureLogDirectory();
  }

  public debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  public info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  public warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  public error(message: string, error?: any): void {
    if (error instanceof Error) {
      this.log('error', `${message}: ${error.message}`, { 
        stack: error.stack,
        name: error.name 
      });
    } else {
      this.log('error', message, error);
    }
  }

  public progress(current: number, total: number, message?: string): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(current, total);
    const msg = message ? `${message} - ${progressBar} ${percentage}%` : `${progressBar} ${percentage}%`;
    this.info(msg);
  }

  public separator(title?: string): void {
    const line = '='.repeat(60);
    if (title) {
      const titleLine = `=== ${title} ===`;
      const padding = Math.max(0, line.length - titleLine.length);
      const paddedTitle = titleLine + '='.repeat(padding);
      this.info(paddedTitle);
    } else {
      this.info(line);
    }
  }

  public summary(stats: Record<string, number | string>): void {
    this.separator('SUMMARY');
    for (const [key, value] of Object.entries(stats)) {
      this.info(`${key}: ${value}`);
    }
    this.separator();
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      sessionId: this.sessionId,
      level: level.toUpperCase(),
      message,
      ...(data && { data })
    };

    // Console output with colors
    this.logToConsole(level, timestamp, message, data);

    // File output
    this.logToFile(logEntry);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private logToConsole(level: LogLevel, timestamp: string, message: string, data?: any): void {
    const timeStr = timestamp.split('T')[1].split('.')[0];
    const prefix = `[${timeStr}] [${level.toUpperCase()}]`;
    
    const colors = {
      debug: '\x1b[36m',    // cyan
      info: '\x1b[32m',     // green
      warn: '\x1b[33m',     // yellow
      error: '\x1b[31m',    // red
      reset: '\x1b[0m'
    };

    const coloredPrefix = `${colors[level]}${prefix}${colors.reset}`;
    const output = data ? `${coloredPrefix} ${message}\n${JSON.stringify(data, null, 2)}` : `${coloredPrefix} ${message}`;
    
    console.log(output);
  }

  private logToFile(logEntry: any): void {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error(`Failed to write to log file: ${error}`);
    }
  }

  private createProgressBar(current: number, total: number, width: number = 20): string {
    const percentage = current / total;
    const filled = Math.round(width * percentage);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  public getLogFile(): string {
    return this.logFile;
  }

  public clearLog(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.unlinkSync(this.logFile);
      }
    } catch (error) {
      console.error(`Failed to clear log file: ${error}`);
    }
  }

  public getLogContents(): string {
    try {
      if (fs.existsSync(this.logFile)) {
        return fs.readFileSync(this.logFile, 'utf8');
      }
      return '';
    } catch (error) {
      console.error(`Failed to read log file: ${error}`);
      return '';
    }
  }

  public getLogStats(): { totalLines: number; errorCount: number; warnCount: number } {
    try {
      const content = this.getLogContents();
      const lines = content.split('\n').filter(line => line.trim());
      
      let errorCount = 0;
      let warnCount = 0;
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.level === 'ERROR') errorCount++;
          if (entry.level === 'WARN') warnCount++;
        } catch {
          // Skip malformed lines
        }
      }
      
      return {
        totalLines: lines.length,
        errorCount,
        warnCount
      };
    } catch {
      return { totalLines: 0, errorCount: 0, warnCount: 0 };
    }
  }
}

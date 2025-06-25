import fs from 'fs';
import path from 'path';
import { ScrapingSession, ScrapingConfig, ScrapingError } from '../types';

/**
 * Session Management for Agentic Magic v2
 * 
 * Handles session creation, persistence, recovery, and progress tracking.
 */

export class Session {
  private session: ScrapingSession;
  private sessionDir: string;
  private sessionFile: string;

  constructor(config: ScrapingConfig, sessionId?: string) {
    this.session = this.createSession(config, sessionId);
    this.sessionDir = path.join(config.output.dataDir, `agentic-${this.session.id}`);
    this.sessionFile = path.join(this.sessionDir, 'session.json');
    this.ensureSessionDirectory();
  }

  public getId(): string {
    return this.session.id;
  }

  public getSession(): ScrapingSession {
    return { ...this.session };
  }

  public getSessionDir(): string {
    return this.sessionDir;
  }

  public updateStatus(status: ScrapingSession['status']): void {
    this.session.status = status;
    if (status === 'completed' || status === 'failed') {
      this.session.endTime = new Date().toISOString();
    }
    this.saveSession();
  }

  public updateProgress(updates: Partial<ScrapingSession['progress']>): void {
    this.session.progress = { ...this.session.progress, ...updates };
    this.saveSession();
  }

  public setOutput(type: keyof ScrapingSession['outputs'], filePath: string): void {
    this.session.outputs[type] = filePath;
    this.saveSession();
  }

  public addError(error: ScrapingError): void {
    this.session.errors.push(error);
    this.session.progress.errors = this.session.errors.length;
    this.saveSession();
  }

  public incrementProgress(field: keyof Omit<ScrapingSession['progress'], 'totalSteps' | 'currentStep' | 'errors' | 'warnings'>): void {
    this.session.progress[field]++;
    this.saveSession();
  }

  public setStep(step: number, total?: number): void {
    this.session.progress.currentStep = step;
    if (total !== undefined) {
      this.session.progress.totalSteps = total;
    }
    this.saveSession();
  }

  public saveToFile(filename: string, data: any): string {
    const filePath = path.join(this.sessionDir, filename);
    
    try {
      if (filename.endsWith('.jsonl')) {
        // Handle JSONL format
        const stream = fs.createWriteStream(filePath);
        if (Array.isArray(data)) {
          for (const item of data) {
            stream.write(JSON.stringify(item) + '\n');
          }
        } else {
          stream.write(JSON.stringify(data) + '\n');
        }
        stream.end();
      } else {
        // Handle regular JSON
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
      
      return filePath;
    } catch (error) {
      throw new Error(`Failed to save file ${filename}: ${error}`);
    }
  }

  public loadFromFile<T>(filename: string): T {
    const filePath = path.join(this.sessionDir, filename);
    
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filename}`);
      }
      
      if (filename.endsWith('.jsonl')) {
        // Handle JSONL format
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        return lines.map(line => JSON.parse(line)) as T;
      } else {
        // Handle regular JSON
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content) as T;
      }
    } catch (error) {
      throw new Error(`Failed to load file ${filename}: ${error}`);
    }
  }

  public fileExists(filename: string): boolean {
    const filePath = path.join(this.sessionDir, filename);
    return fs.existsSync(filePath);
  }

  public getFilePath(filename: string): string {
    return path.join(this.sessionDir, filename);
  }

  public listFiles(): string[] {
    try {
      return fs.readdirSync(this.sessionDir);
    } catch {
      return [];
    }
  }

  public getFileSummary(): Array<{ name: string; size: number; created: Date }> {
    const files = this.listFiles();
    return files.map(file => {
      const filePath = path.join(this.sessionDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        created: stats.birthtime
      };
    });
  }

  private createSession(config: ScrapingConfig, sessionId?: string): ScrapingSession {
    const id = sessionId || this.generateSessionId();
    
    return {
      id,
      startTime: new Date().toISOString(),
      status: 'running',
      config: { ...config },
      progress: {
        coursesDiscovered: 0,
        examsExtracted: 0,
        syllabusScraped: 0,
        totalSteps: 0,
        currentStep: 0,
        errors: 0,
        warnings: 0
      },
      outputs: {},
      errors: []
    };
  }

  private generateSessionId(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  private ensureSessionDirectory(): void {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  private saveSession(): void {
    try {
      fs.writeFileSync(this.sessionFile, JSON.stringify(this.session, null, 2));
    } catch (error) {
      console.error(`Failed to save session: ${error}`);
    }
  }

  // Static methods for session recovery and management
  public static loadSession(sessionId: string, dataDir: string): Session {
    const sessionDir = path.join(dataDir, `agentic-${sessionId}`);
    const sessionFile = path.join(sessionDir, 'session.json');
    
    if (!fs.existsSync(sessionFile)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    try {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      const session = new Session(sessionData.config, sessionId);
      session.session = sessionData;
      return session;
    } catch (error) {
      throw new Error(`Failed to load session ${sessionId}: ${error}`);
    }
  }

  public static listSessions(dataDir: string): Array<{ id: string; status: string; startTime: string; endTime?: string }> {
    try {
      const entries = fs.readdirSync(dataDir);
      const sessions: Array<{ id: string; status: string; startTime: string; endTime?: string }> = [];
      
      for (const entry of entries) {
        if (entry.startsWith('agentic-')) {
          const sessionId = entry.replace('agentic-', '');
          const sessionFile = path.join(dataDir, entry, 'session.json');
          
          if (fs.existsSync(sessionFile)) {
            try {
              const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
              sessions.push({
                id: sessionId,
                status: sessionData.status,
                startTime: sessionData.startTime,
                endTime: sessionData.endTime
              });
            } catch {
              // Skip invalid session files
            }
          }
        }
      }
      
      return sessions.sort((a, b) => b.startTime.localeCompare(a.startTime));
    } catch {
      return [];
    }
  }

  public static getLatestSession(dataDir: string): string | null {
    const sessions = Session.listSessions(dataDir);
    return sessions.length > 0 ? sessions[0].id : null;
  }

  public static cleanupOldSessions(dataDir: string, keepCount: number = 5): void {
    const sessions = Session.listSessions(dataDir);
    
    if (sessions.length <= keepCount) {
      return;
    }
    
    const sessionsToDelete = sessions.slice(keepCount);
    
    for (const session of sessionsToDelete) {
      const sessionDir = path.join(dataDir, `agentic-${session.id}`);
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to delete session ${session.id}: ${error}`);
      }
    }
  }
}

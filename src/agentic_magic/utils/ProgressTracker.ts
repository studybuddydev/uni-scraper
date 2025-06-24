import { ProgressStatus } from '../types';

export class ProgressTracker {
  private total: number = 0;
  private completed: number = 0;
  private failed: number = 0;
  private startTime: number = Date.now();
  private currentItem?: string;
  private listeners: Array<(status: ProgressStatus) => void> = [];
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startProgressUpdates();
  }

  public setTotal(total: number): void {
    this.total = total;
    this.notifyListeners();
  }

  public increment(success: boolean = true, itemName?: string): void {
    this.completed++;
    if (!success) {
      this.failed++;
    }
    this.currentItem = itemName;
    this.notifyListeners();
  }

  public addCompleted(count: number): void {
    this.completed += count;
    this.notifyListeners();
  }

  public addFailed(count: number): void {
    this.failed += count;
    this.notifyListeners();
  }

  public getCurrentStatus(): ProgressStatus {
    const elapsed = Date.now() - this.startTime;
    const rate = this.completed > 0 ? this.completed / (elapsed / 1000) : 0;
    const remaining = this.total - this.completed;
    const eta = rate > 0 ? remaining / rate : 0;

    return {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      percentage: this.total > 0 ? (this.completed / this.total) * 100 : 0,
      rate,
      eta,
      currentItem: this.currentItem
    };
  }

  public onProgress(callback: (status: ProgressStatus) => void): void {
    this.listeners.push(callback);
  }

  public removeListener(callback: (status: ProgressStatus) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    const status = this.getCurrentStatus();
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in progress listener:', error);
      }
    });
  }

  private startProgressUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.notifyListeners();
    }, 1000); // Update every second
  }

  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public reset(): void {
    this.total = 0;
    this.completed = 0;
    this.failed = 0;
    this.startTime = Date.now();
    this.currentItem = undefined;
    this.notifyListeners();
  }

  public getProgressBar(width: number = 40): string {
    const percentage = this.total > 0 ? this.completed / this.total : 0;
    const filled = Math.round(width * percentage);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = (percentage * 100).toFixed(1);
    
    return `[${bar}] ${percent}% (${this.completed}/${this.total})`;
  }

  public getEstimatedCompletion(): Date | null {
    const status = this.getCurrentStatus();
    if (status.eta <= 0) {
      return null;
    }
    
    return new Date(Date.now() + status.eta * 1000);
  }

  public getSummary(): string {
    const status = this.getCurrentStatus();
    const elapsed = Date.now() - this.startTime;
    const elapsedStr = this.formatDuration(elapsed);
    const etaStr = status.eta > 0 ? this.formatDuration(status.eta * 1000) : 'N/A';
    
    return `Progress: ${status.completed}/${status.total} (${status.percentage.toFixed(1)}%) | ` +
           `Failed: ${status.failed} | ` +
           `Rate: ${status.rate.toFixed(2)}/s | ` +
           `Elapsed: ${elapsedStr} | ` +
           `ETA: ${etaStr}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  public printProgress(): void {
    const progressBar = this.getProgressBar();
    const summary = this.getSummary();
    
    // Clear line and print progress
    process.stdout.write('\r\x1b[K');
    process.stdout.write(`${progressBar}\n${summary}`);
  }

  public printFinalSummary(): void {
    const status = this.getCurrentStatus();
    const elapsed = Date.now() - this.startTime;
    const elapsedStr = this.formatDuration(elapsed);
    
    console.log('\n' + '='.repeat(60));
    console.log('SCRAPING COMPLETED');
    console.log('='.repeat(60));
    console.log(`Total Items: ${status.total}`);
    console.log(`Successful: ${status.completed - status.failed}`);
    console.log(`Failed: ${status.failed}`);
    console.log(`Success Rate: ${((status.completed - status.failed) / status.total * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${elapsedStr}`);
    console.log(`Average Rate: ${status.rate.toFixed(2)} items/second`);
    console.log('='.repeat(60));
  }
}

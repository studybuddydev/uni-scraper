import { ProgressMetrics } from '../types';
import { Logger } from './Logger';
import { formatDuration, calculateProgress, estimateRemainingTime } from './helpers';

/**
 * Progress Tracker for Agentic Magic v2
 */

export class ProgressTracker {
  private metrics: ProgressMetrics;
  private logger: Logger;
  private updateInterval: number;
  private lastUpdate: number = 0;

  constructor(logger: Logger, updateInterval: number = 5000) {
    this.logger = logger;
    this.updateInterval = updateInterval;
    this.metrics = {
      startTime: Date.now(),
      itemsProcessed: 0,
      totalItems: 0,
      errorsCount: 0,
      averageTimePerItem: 0,
      estimatedTimeRemaining: 0
    };
  }

  public start(totalItems: number): void {
    this.metrics.totalItems = totalItems;
    this.metrics.startTime = Date.now();
    this.metrics.itemsProcessed = 0;
    this.metrics.errorsCount = 0;
    this.lastUpdate = Date.now();
    
    this.logger.info(`Started processing ${totalItems} items`);
  }

  public increment(success: boolean = true): void {
    this.metrics.itemsProcessed++;
    if (!success) {
      this.metrics.errorsCount++;
    }
    
    this.updateMetrics();
    this.maybeLogProgress();
  }

  public setProcessed(count: number, errors: number = 0): void {
    this.metrics.itemsProcessed = count;
    this.metrics.errorsCount = errors;
    this.updateMetrics();
    this.maybeLogProgress();
  }

  public logProgress(force: boolean = false): void {
    if (!force && Date.now() - this.lastUpdate < this.updateInterval) {
      return;
    }

    const progress = calculateProgress(this.metrics.itemsProcessed, this.metrics.totalItems);
    const elapsed = formatDuration(Date.now() - this.metrics.startTime);
    const remaining = formatDuration(this.metrics.estimatedTimeRemaining);
    const rate = this.getProcessingRate();

    this.logger.progress(
      this.metrics.itemsProcessed,
      this.metrics.totalItems,
      `${this.metrics.itemsProcessed}/${this.metrics.totalItems} items (${rate.toFixed(1)}/min) | Elapsed: ${elapsed} | Remaining: ${remaining} | Errors: ${this.metrics.errorsCount}`
    );

    this.lastUpdate = Date.now();
  }

  public getMetrics(): ProgressMetrics {
    return { ...this.metrics };
  }

  public getProgressPercentage(): number {
    return calculateProgress(this.metrics.itemsProcessed, this.metrics.totalItems);
  }

  public getElapsedTime(): number {
    return Date.now() - this.metrics.startTime;
  }

  public getProcessingRate(): number {
    const elapsedMinutes = this.getElapsedTime() / (1000 * 60);
    return elapsedMinutes > 0 ? this.metrics.itemsProcessed / elapsedMinutes : 0;
  }

  public getErrorRate(): number {
    return this.metrics.itemsProcessed > 0 
      ? this.metrics.errorsCount / this.metrics.itemsProcessed 
      : 0;
  }

  public isComplete(): boolean {
    return this.metrics.itemsProcessed >= this.metrics.totalItems;
  }

  public printSummary(): void {
    const elapsed = formatDuration(this.getElapsedTime());
    const rate = this.getProcessingRate();
    const errorRate = (this.getErrorRate() * 100).toFixed(1);
    
    this.logger.summary({
      'Total Items': this.metrics.totalItems,
      'Processed': this.metrics.itemsProcessed,
      'Errors': this.metrics.errorsCount,
      'Success Rate': `${(100 - parseFloat(errorRate)).toFixed(1)}%`,
      'Processing Rate': `${rate.toFixed(1)} items/min`,
      'Total Time': elapsed
    });
  }

  private updateMetrics(): void {
    const elapsed = Date.now() - this.metrics.startTime;
    
    if (this.metrics.itemsProcessed > 0) {
      this.metrics.averageTimePerItem = elapsed / this.metrics.itemsProcessed;
      this.metrics.estimatedTimeRemaining = estimateRemainingTime(
        this.metrics.startTime,
        this.metrics.itemsProcessed,
        this.metrics.totalItems
      );
    }
  }

  private maybeLogProgress(): void {
    if (Date.now() - this.lastUpdate >= this.updateInterval) {
      this.logProgress();
    }
  }
}

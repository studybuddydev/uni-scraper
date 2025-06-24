import fs from 'fs';
import path from 'path';
import { 
  SessionReport, 
  ErrorSummary, 
  PerformanceMetrics, 
  ErrorType, 
  ScrapingError,
  ScrapingConfig 
} from '../types';
import { Logger } from '../utils/Logger';

export class ErrorReporter {
  private config: ScrapingConfig;
  private logger: Logger;
  private sessionId: string;
  private errors: Array<ScrapingError & { url?: string; timestamp: string }> = [];
  private performanceData: {
    requestTimes: number[];
    memorySnapshots: number[];
    networkStats: {
      totalRequests: number;
      failedRequests: number;
      retries: number;
      timeouts: number;
    };
  };

  constructor(config: ScrapingConfig, logger: Logger, sessionId: string) {
    this.config = config;
    this.logger = logger;
    this.sessionId = sessionId;
    this.performanceData = {
      requestTimes: [],
      memorySnapshots: [],
      networkStats: {
        totalRequests: 0,
        failedRequests: 0,
        retries: 0,
        timeouts: 0
      }
    };
  }

  public recordError(error: ScrapingError, url?: string): void {
    const errorRecord = {
      ...error,
      url,
      timestamp: new Date().toISOString()
    };

    this.errors.push(errorRecord);
    this.logger.error(`Error recorded: ${error.message}`, error);

    // Update network stats
    this.performanceData.networkStats.failedRequests++;
    
    if (error.type === ErrorType.TIMEOUT) {
      this.performanceData.networkStats.timeouts++;
    }
  }

  public recordRequest(duration: number, success: boolean, isRetry: boolean = false): void {
    this.performanceData.requestTimes.push(duration);
    this.performanceData.networkStats.totalRequests++;
    
    if (isRetry) {
      this.performanceData.networkStats.retries++;
    }
    
    if (!success) {
      this.performanceData.networkStats.failedRequests++;
    }

    // Record memory usage periodically
    if (this.performanceData.requestTimes.length % 10 === 0) {
      const memUsage = process.memoryUsage();
      this.performanceData.memorySnapshots.push(memUsage.heapUsed);
    }
  }

  public generateErrorSummary(): ErrorSummary {
    const byType: Record<ErrorType, number> = {
      [ErrorType.NETWORK]: 0,
      [ErrorType.PARSING]: 0,
      [ErrorType.VALIDATION]: 0,
      [ErrorType.TIMEOUT]: 0,
      [ErrorType.RATE_LIMIT]: 0,
      [ErrorType.AUTHENTICATION]: 0,
      [ErrorType.NOT_FOUND]: 0,
      [ErrorType.SERVER_ERROR]: 0,
      [ErrorType.UNKNOWN]: 0
    };

    const byCode: Record<string, number> = {};
    const messageGroups: Record<string, { count: number; examples: string[] }> = {};

    this.errors.forEach(error => {
      // Count by type
      byType[error.type]++;

      // Count by code
      if (error.code) {
        byCode[error.code] = (byCode[error.code] || 0) + 1;
      }

      // Group similar messages
      const messageKey = this.normalizeErrorMessage(error.message);
      if (!messageGroups[messageKey]) {
        messageGroups[messageKey] = { count: 0, examples: [] };
      }
      messageGroups[messageKey].count++;
      if (messageGroups[messageKey].examples.length < 3 && error.url) {
        messageGroups[messageKey].examples.push(error.url);
      }
    });

    // Get top errors
    const topErrors = Object.entries(messageGroups)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([message, data]) => ({
        message,
        count: data.count,
        examples: data.examples
      }));

    return { byType, byCode, topErrors };
  }

  public generatePerformanceMetrics(): PerformanceMetrics {
    const requestTimes = this.performanceData.requestTimes;
    const memorySnapshots = this.performanceData.memorySnapshots;

    const averageRequestTime = requestTimes.length > 0 ? 
      requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length : 0;

    const requestsPerSecond = requestTimes.length > 0 ? 
      1000 / averageRequestTime : 0;

    const peakMemory = memorySnapshots.length > 0 ? 
      Math.max(...memorySnapshots) : 0;

    const averageMemory = memorySnapshots.length > 0 ? 
      memorySnapshots.reduce((sum, mem) => sum + mem, 0) / memorySnapshots.length : 0;

    return {
      averageRequestTime,
      requestsPerSecond,
      memoryUsage: {
        peak: peakMemory,
        average: averageMemory
      },
      networkStats: { ...this.performanceData.networkStats }
    };
  }

  public generateSessionReport(
    startTime: string,
    endTime: string,
    totalItems: number,
    successful: number,
    failed: number,
    skipped: number = 0,
    courseStats?: { discovered: number; successful: number; failed: number; failedItems: string[] },
    examStats?: { extracted: number; successful: number; failed: number; failedItems: string[] }
  ): SessionReport {
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    const successRate = totalItems > 0 ? successful / totalItems : 0;

    return {
      sessionId: this.sessionId,
      startTime,
      endTime,
      status: failed > successful * 0.5 ? 'failed' : 'completed',
      summary: {
        totalItems,
        successful,
        failed,
        skipped,
        successRate,
        duration
      },
      courses: courseStats,
      exams: examStats,
      errors: this.generateErrorSummary(),
      performance: this.generatePerformanceMetrics()
    };
  }

  public async saveReport(report: SessionReport): Promise<void> {
    // Create session-specific directory in reports
    const reportsDir = path.join(this.config.output.reportsDir, this.sessionId);
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Save JSON report
    const jsonReportPath = path.join(reportsDir, `${this.sessionId}-report.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
    this.logger.info(`Session report saved to: ${jsonReportPath}`);

    // Save CSV summary
    await this.saveCsvReport(report, reportsDir);

    // Save error details
    await this.saveErrorDetails(reportsDir);

    // Save HTML dashboard
    await this.saveHtmlDashboard(report, reportsDir);
  }

  private async saveCsvReport(report: SessionReport, reportsDir: string): Promise<void> {
    const csvPath = path.join(reportsDir, `${this.sessionId}-summary.csv`);
    
    const csvContent = [
      'Metric,Value',
      `Session ID,${report.sessionId}`,
      `Start Time,${report.startTime}`,
      `End Time,${report.endTime}`,
      `Status,${report.status}`,
      `Total Items,${report.summary.totalItems}`,
      `Successful,${report.summary.successful}`,
      `Failed,${report.summary.failed}`,
      `Skipped,${report.summary.skipped}`,
      `Success Rate,${(report.summary.successRate * 100).toFixed(2)}%`,
      `Duration (ms),${report.summary.duration}`,
      `Average Request Time (ms),${report.performance.averageRequestTime.toFixed(2)}`,
      `Requests Per Second,${report.performance.requestsPerSecond.toFixed(2)}`,
      `Peak Memory (MB),${(report.performance.memoryUsage.peak / 1024 / 1024).toFixed(2)}`,
      `Total Requests,${report.performance.networkStats.totalRequests}`,
      `Failed Requests,${report.performance.networkStats.failedRequests}`,
      `Retries,${report.performance.networkStats.retries}`,
      `Timeouts,${report.performance.networkStats.timeouts}`
    ].join('\n');

    fs.writeFileSync(csvPath, csvContent);
    this.logger.info(`CSV summary saved to: ${csvPath}`);
  }

  private async saveErrorDetails(reportsDir: string): Promise<void> {
    if (this.errors.length === 0) return;

    const errorDetailsPath = path.join(reportsDir, `${this.sessionId}-errors.json`);
    
    const errorDetails = {
      sessionId: this.sessionId,
      totalErrors: this.errors.length,
      errors: this.errors.map(error => ({
        timestamp: error.timestamp,
        type: error.type,
        message: error.message,
        code: error.code,
        url: error.url,
        details: error.details
      }))
    };

    fs.writeFileSync(errorDetailsPath, JSON.stringify(errorDetails, null, 2));
    this.logger.info(`Error details saved to: ${errorDetailsPath}`);
  }

  private async saveHtmlDashboard(report: SessionReport, reportsDir: string): Promise<void> {
    const htmlPath = path.join(reportsDir, `${this.sessionId}-dashboard.html`);
    
    const html = this.generateHtmlDashboard(report);
    fs.writeFileSync(htmlPath, html);
    this.logger.info(`HTML dashboard saved to: ${htmlPath}`);
  }

  private generateHtmlDashboard(report: SessionReport): string {
    const errorTypeData = Object.entries(report.errors.byType)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `['${type}', ${count}]`)
      .join(',');

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Scraping Report - ${report.sessionId}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; color: #007cba; }
        .chart-container { background: white; border: 1px solid #ddd; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .errors { background: #fff5f5; border: 1px solid #fed7d7; padding: 20px; border-radius: 5px; }
        .error-item { margin-bottom: 10px; padding: 10px; background: white; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>University Scraping Report</h1>
        <p><strong>Session:</strong> ${report.sessionId}</p>
        <p><strong>Status:</strong> <span style="color: ${report.status === 'completed' ? 'green' : 'red'}">${report.status.toUpperCase()}</span></p>
        <p><strong>Duration:</strong> ${this.formatDuration(report.summary.duration)}</p>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>Total Items</h3>
            <div class="value">${report.summary.totalItems}</div>
        </div>
        <div class="metric">
            <h3>Successful</h3>
            <div class="value" style="color: green">${report.summary.successful}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="value" style="color: red">${report.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Success Rate</h3>
            <div class="value">${(report.summary.successRate * 100).toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>Avg Request Time</h3>
            <div class="value">${report.performance.averageRequestTime.toFixed(0)}ms</div>
        </div>
        <div class="metric">
            <h3>Requests/Second</h3>
            <div class="value">${report.performance.requestsPerSecond.toFixed(2)}</div>
        </div>
    </div>

    <div class="chart-container">
        <h3>Error Distribution by Type</h3>
        <canvas id="errorChart" width="400" height="200"></canvas>
    </div>

    <div class="errors">
        <h3>Top Errors</h3>
        <table>
            <thead>
                <tr>
                    <th>Error Message</th>
                    <th>Count</th>
                    <th>Examples</th>
                </tr>
            </thead>
            <tbody>
                ${report.errors.topErrors.map(error => `
                    <tr>
                        <td>${error.message}</td>
                        <td>${error.count}</td>
                        <td>${error.examples.slice(0, 2).join('<br>')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <script>
        const ctx = document.getElementById('errorChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [${Object.keys(report.errors.byType).filter(type => report.errors.byType[type as ErrorType] > 0).map(t => `'${t}'`).join(',')}],
                datasets: [{
                    data: [${errorTypeData}],
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    </script>
</body>
</html>`;
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

  private normalizeErrorMessage(message: string): string {
    // Normalize error messages by removing URLs, numbers, and other variable parts
    return message
      .replace(/https?:\/\/[^\s]+/g, '[URL]')
      .replace(/\d+/g, '[NUMBER]')
      .replace(/timeout of \d+ms exceeded/g, 'timeout exceeded')
      .replace(/Error: /g, '')
      .trim();
  }

  public getErrorCount(): number {
    return this.errors.length;
  }

  public getErrorsByType(type: ErrorType): Array<ScrapingError & { url?: string; timestamp: string }> {
    return this.errors.filter(error => error.type === type);
  }

  public clearErrors(): void {
    this.errors = [];
    this.logger.debug('Error buffer cleared');
  }
}

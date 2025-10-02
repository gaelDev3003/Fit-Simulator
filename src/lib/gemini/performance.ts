/**
 * Performance constraints and monitoring for Gemini API calls
 */

export interface PerformanceConfig {
  maxDurationMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  maxDurationMs: 60000, // 60 seconds max
  retryAttempts: 2,
  retryDelayMs: 2000,
  timeoutMs: 30000, // 30 seconds timeout
};

export class PerformanceMonitor {
  private config: PerformanceConfig;
  private startTime: number = 0;

  constructor(config: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG) {
    this.config = config;
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Check if operation is within time limits
   */
  isWithinLimits(): boolean {
    return this.getElapsedMs() < this.config.maxDurationMs;
  }

  /**
   * Get remaining time in milliseconds
   */
  getRemainingMs(): number {
    return Math.max(0, this.config.maxDurationMs - this.getElapsedMs());
  }

  /**
   * Check if we should retry based on elapsed time
   */
  shouldRetry(attempt: number): boolean {
    if (attempt >= this.config.retryAttempts) {
      return false;
    }

    // Don't retry if we're close to the time limit
    const estimatedRetryTime = this.getElapsedMs() + this.config.retryDelayMs;
    return estimatedRetryTime < this.config.maxDurationMs;
  }

  /**
   * Get delay for next retry attempt
   */
  getRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
    return Math.min(baseDelay + jitter, 5000); // Max 5 seconds
  }

  /**
   * Create a timeout promise
   */
  createTimeoutPromise<T>(operation: Promise<T>): Promise<T> {
    return Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Operation timed out after ${this.config.timeoutMs}ms`)
          );
        }, this.config.timeoutMs);
      }),
    ]);
  }

  /**
   * Execute operation with performance monitoring and retries
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: () => void
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Check if we have enough time for this attempt
        if (!this.isWithinLimits()) {
          throw new Error(
            `Operation exceeded maximum duration of ${this.config.maxDurationMs}ms`
          );
        }

        // Execute operation with timeout
        const result = await this.createTimeoutPromise(operation());

        // Log successful completion
        console.log(
          `Operation completed successfully in ${this.getElapsedMs()}ms (attempt ${attempt})`
        );

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.warn(
          `Operation failed on attempt ${attempt}:`,
          lastError.message
        );

        // Check if we should retry
        if (!this.shouldRetry(attempt)) {
          break;
        }

        // Call retry callback
        if (onRetry) {
          onRetry();
        }

        // Wait before retry
        const delay = this.getRetryDelay(attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries failed
    throw new Error(
      `Operation failed after ${this.config.retryAttempts} attempts. ` +
        `Last error: ${lastError?.message}. ` +
        `Total time: ${this.getElapsedMs()}ms`
    );
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      elapsedMs: this.getElapsedMs(),
      remainingMs: this.getRemainingMs(),
      isWithinLimits: this.isWithinLimits(),
      config: this.config,
    };
  }
}

/**
 * Utility function to create a performance monitor with custom config
 */
export function createPerformanceMonitor(
  config?: Partial<PerformanceConfig>
): PerformanceMonitor {
  const mergedConfig = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  return new PerformanceMonitor(mergedConfig);
}

/**
 * Utility function to check if a duration is acceptable
 */
export function isAcceptableDuration(
  durationMs: number,
  maxMs: number = DEFAULT_PERFORMANCE_CONFIG.maxDurationMs
): boolean {
  return durationMs <= maxMs;
}

/**
 * Utility function to format duration for logging
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    return `${(durationMs / 60000).toFixed(1)}m`;
  }
}

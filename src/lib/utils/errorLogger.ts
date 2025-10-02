/**
 * Centralized error logging utility
 * Provides structured error logging with context and categorization
 */

export interface ErrorContext {
  userId?: string;
  jobId?: string;
  action?: string;
  component?: string;
  additionalData?: Record<string, any>;
}

export interface LoggedError {
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category:
    | 'auth'
    | 'upload'
    | 'simulation'
    | 'storage'
    | 'sharing'
    | 'network'
    | 'validation'
    | 'unknown';
}

class ErrorLogger {
  private logs: LoggedError[] = [];

  /**
   * Log an error with context
   */
  logError(
    error: Error | string,
    context: ErrorContext = {},
    severity: LoggedError['severity'] = 'medium',
    category: LoggedError['category'] = 'unknown'
  ): void {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    const loggedError: LoggedError = {
      message: errorMessage,
      stack,
      context,
      timestamp: new Date().toISOString(),
      severity,
      category,
    };

    // Store in memory (in production, this would be sent to a logging service)
    this.logs.push(loggedError);

    // Console logging with structured format
    console.error(`[${category.toUpperCase()}] ${errorMessage}`, {
      context,
      severity,
      timestamp: loggedError.timestamp,
      stack,
    });

    // In production, you would send this to your logging service
    // Example: sendToLoggingService(loggedError);
  }

  /**
   * Log authentication errors
   */
  logAuthError(error: Error | string, context: ErrorContext = {}): void {
    this.logError(error, context, 'high', 'auth');
  }

  /**
   * Log upload errors
   */
  logUploadError(error: Error | string, context: ErrorContext = {}): void {
    this.logError(error, context, 'medium', 'upload');
  }

  /**
   * Log simulation errors
   */
  logSimulationError(error: Error | string, context: ErrorContext = {}): void {
    this.logError(error, context, 'high', 'simulation');
  }

  /**
   * Log storage errors
   */
  logStorageError(error: Error | string, context: ErrorContext = {}): void {
    this.logError(error, context, 'high', 'storage');
  }

  /**
   * Log sharing errors
   */
  logSharingError(error: Error | string, context: ErrorContext = {}): void {
    this.logError(error, context, 'medium', 'sharing');
  }

  /**
   * Log network errors
   */
  logNetworkError(error: Error | string, context: ErrorContext = {}): void {
    this.logError(error, context, 'medium', 'network');
  }

  /**
   * Log validation errors
   */
  logValidationError(error: Error | string, context: ErrorContext = {}): void {
    this.logError(error, context, 'low', 'validation');
  }

  /**
   * Get recent errors (for debugging)
   */
  getRecentErrors(limit: number = 10): LoggedError[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: LoggedError['category']): LoggedError[] {
    return this.logs.filter((log) => log.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: LoggedError['severity']): LoggedError[] {
    return this.logs.filter((log) => log.severity === severity);
  }

  /**
   * Clear logs (useful for testing)
   */
  clearLogs(): void {
    this.logs = [];
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();


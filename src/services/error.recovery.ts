import { Injectable, signal } from '@angular/core';

export interface ErrorDetail {
  type: string;
  message: string;
  timestamp: Date;
  recovered: boolean;
  attemptCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorRecoveryService {
  errors = signal<ErrorDetail[]>([]);
  retryCount = signal<number>(0);
  
  private readonly MAX_RETRIES = 3;
  private readonly BASE_BACKOFF_MS = 1000;
  private lastError: ErrorDetail | null = null;

  /**
   * Handle and recover from errors with exponential backoff
   */
  async handleError(error: any, operation: string): Promise<boolean> {
    const errorDetail: ErrorDetail = {
      type: operation,
      message: error?.message || String(error),
      timestamp: new Date(),
      recovered: false,
      attemptCount: this.retryCount()
    };

    this.lastError = errorDetail;
    this.errors.update(e => [...e, errorDetail]);

    // Determine if we should retry
    if (this.shouldRetry(error)) {
      return await this.retryWithBackoff(operation, error);
    }

    return false;
  }

  private shouldRetry(error: any): boolean {
    const retryableErrors = [
      'Network error',
      'timeout',
      'ECONNREFUSED',
      'no-speech',
      'ERR_INTERNET_DISCONNECTED'
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    return retryableErrors.some(e => errorMessage.includes(e.toLowerCase())) &&
      this.retryCount() < this.MAX_RETRIES;
  }

  private async retryWithBackoff(operation: string, error: any): Promise<boolean> {
    const attempt = this.retryCount() + 1;
    const backoffMs = this.BASE_BACKOFF_MS * Math.pow(2, attempt - 1);

    console.log(`Retrying ${operation} in ${backoffMs}ms (attempt ${attempt}/${this.MAX_RETRIES})`);

    this.retryCount.set(attempt);

    return new Promise((resolve) => {
      setTimeout(() => {
        // In real implementation, would retry the operation
        if (attempt < this.MAX_RETRIES) {
          resolve(true);
        } else {
          resolve(false);
        }
      }, backoffMs);
    });
  }

  /**
   * Get fallback response for common errors
   */
  getFallbackResponse(operation: string): string {
    const fallbacks: Record<string, string> = {
      'speech-recognition': 'I couldn\'t quite hear that. Could you please say that again?',
      'content-generation': 'I\'m having trouble forming my thoughts right now. Let me take a moment... try again?',
      'network': 'I\'m experiencing a connection issue. Let\'s try that again.',
      'audio': 'There\'s a problem with my voice. Let\'s try once more.',
      'api': 'I need to check my systems. Please try again in a moment.',
      'default': 'Something went wrong. Let\'s start fresh - what were you saying?'
    };

    return fallbacks[operation] || fallbacks['default'];
  }

  /**
   * Graceful degradation - essential features fallback
   */
  async gracefullyDegrade(capability: string): Promise<any> {
    switch (capability) {
      case 'text-to-speech':
        return { enabled: false, message: 'Continuing with text only' };
      case 'speech-recognition':
        return { enabled: false, message: 'Switching to text mode' };
      case 'emotional-analysis':
        return { enabled: false, message: 'Using default emotional context' };
      default:
        return { enabled: false };
    }
  }

  /**
   * Log error for debugging
   */
  logError(context: string, error: any) {
    console.error(`[${context}] ${new Date().toISOString()}:`, error);
    const errorDetail: ErrorDetail = {
      type: context,
      message: error?.message || String(error),
      timestamp: new Date(),
      recovered: false,
      attemptCount: this.retryCount()
    };
    this.errors.update(e => [...e, errorDetail]);
  }

  /**
   * Clear error history and reset retry count
   */
  reset() {
    this.errors.set([]);
    this.retryCount.set(0);
    this.lastError = null;
  }

  /**
   * Get error recovery status
   */
  getStatus(): string {
    if (!this.lastError) return 'System operational';
    return `Last error: ${this.lastError.message} (${this.lastError.type})`;
  }

  markErrorAsRecovered() {
    if (this.lastError) {
      this.lastError.recovered = true;
    }
    this.retryCount.set(0);
  }
}

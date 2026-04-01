export type JitterMode = 'none' | 'full' | 'decorrelated';

export type OverflowStrategy = 'drop-oldest' | 'reject-new';

export interface DeadLetterItem<T> {
  item: T;
  error: Error;
  attempts: number;
  failedAt: number;
}

export interface QueueOptions<T> {
  process: (item: T) => Promise<void>;
  maxRetries?: number;
  retryDelay?: number;
  jitter?: JitterMode;
  maxQueueLength?: number;
  overflowStrategy?: OverflowStrategy;
  itemTimeout?: number;
  onSuccess?: (item: T) => void;
  onFailure?: (item: T, error: Error) => void;
  onRetry?: (item: T, attempt: number) => void;
  onTimeout?: (item: T) => void;
}

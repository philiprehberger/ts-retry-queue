export interface QueueOptions<T> {
  process: (item: T) => Promise<void>;
  maxRetries?: number;
  retryDelay?: number;
  onSuccess?: (item: T) => void;
  onFailure?: (item: T, error: Error) => void;
  onRetry?: (item: T, attempt: number) => void;
}

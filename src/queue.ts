import type { QueueOptions, DeadLetterItem, JitterMode } from './types';

interface QueueEntry<T> {
  item: T;
  attempts: number;
  addedAt: number;
}

function applyJitter(delayMs: number, mode: JitterMode, baseDelay: number): number {
  if (mode === 'none') return delayMs;
  if (mode === 'full') {
    return Math.random() * delayMs;
  }
  // decorrelated: delay = random between baseDelay and delayMs * 3
  return baseDelay + Math.random() * (delayMs * 3 - baseDelay);
}

export function createQueue<T>(options: QueueOptions<T>) {
  const {
    process,
    maxRetries = 3,
    retryDelay = 100,
    jitter = 'none',
    maxQueueLength,
    overflowStrategy = 'reject-new',
    itemTimeout,
    onSuccess,
    onFailure,
    onRetry,
    onTimeout,
  } = options;

  const queue: QueueEntry<T>[] = [];
  const deadLetterQueue: DeadLetterItem<T>[] = [];
  let paused = false;
  let processing = false;

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isTimedOut(entry: QueueEntry<T>): boolean {
    if (itemTimeout == null) return false;
    return Date.now() - entry.addedAt >= itemTimeout;
  }

  function addToDeadLetter(entry: QueueEntry<T>, error: Error): void {
    deadLetterQueue.push({
      item: entry.item,
      error,
      attempts: entry.attempts,
      failedAt: Date.now(),
    });
  }

  async function processNext(): Promise<void> {
    if (processing || paused || queue.length === 0) return;

    processing = true;

    while (queue.length > 0 && !paused) {
      const entry = queue.shift()!;

      // Check per-item timeout
      if (isTimedOut(entry)) {
        onTimeout?.(entry.item);
        addToDeadLetter(entry, new Error('Item timed out'));
        continue;
      }

      try {
        await process(entry.item);
        onSuccess?.(entry.item);
      } catch (err) {
        entry.attempts++;
        const error = err instanceof Error ? err : new Error(String(err));

        if (entry.attempts < maxRetries) {
          // Check timeout before scheduling retry
          if (isTimedOut(entry)) {
            onTimeout?.(entry.item);
            addToDeadLetter(entry, new Error('Item timed out'));
            continue;
          }

          const rawBackoff = retryDelay * Math.pow(2, entry.attempts);
          const backoffMs = applyJitter(rawBackoff, jitter, retryDelay);
          onRetry?.(entry.item, entry.attempts);
          await delay(backoffMs);
          queue.push(entry);
        } else {
          addToDeadLetter(entry, error);
          onFailure?.(entry.item, error);
        }
      }
    }

    processing = false;
  }

  return {
    add(item: T): boolean {
      const entry: QueueEntry<T> = { item, attempts: 0, addedAt: Date.now() };

      if (maxQueueLength != null && queue.length >= maxQueueLength) {
        if (overflowStrategy === 'reject-new') {
          return false;
        }
        // drop-oldest: remove the first (oldest) item
        queue.shift();
      }

      queue.push(entry);
      if (!paused) {
        processNext();
      }
      return true;
    },

    pause(): void {
      paused = true;
    },

    resume(): void {
      paused = false;
      processNext();
    },

    clear(): void {
      queue.length = 0;
    },

    get pending(): number {
      return queue.length;
    },

    getDeadLetterItems(): DeadLetterItem<T>[] {
      return [...deadLetterQueue];
    },

    clearDeadLetterQueue(): void {
      deadLetterQueue.length = 0;
    },

    get deadLetterCount(): number {
      return deadLetterQueue.length;
    },
  };
}

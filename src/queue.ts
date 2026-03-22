import type { QueueOptions } from './types';

interface QueueEntry<T> {
  item: T;
  attempts: number;
}

export function createQueue<T>(options: QueueOptions<T>) {
  const {
    process,
    maxRetries = 3,
    retryDelay = 100,
    onSuccess,
    onFailure,
    onRetry,
  } = options;

  const queue: QueueEntry<T>[] = [];
  let paused = false;
  let processing = false;

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function processNext(): Promise<void> {
    if (processing || paused || queue.length === 0) return;

    processing = true;

    while (queue.length > 0 && !paused) {
      const entry = queue.shift()!;

      try {
        await process(entry.item);
        onSuccess?.(entry.item);
      } catch (err) {
        entry.attempts++;
        const error = err instanceof Error ? err : new Error(String(err));

        if (entry.attempts < maxRetries) {
          const backoffMs = retryDelay * Math.pow(2, entry.attempts);
          onRetry?.(entry.item, entry.attempts);
          await delay(backoffMs);
          queue.push(entry);
        } else {
          onFailure?.(entry.item, error);
        }
      }
    }

    processing = false;
  }

  return {
    add(item: T): void {
      queue.push({ item, attempts: 0 });
      if (!paused) {
        processNext();
      }
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
  };
}

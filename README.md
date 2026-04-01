# @philiprehberger/retry-queue

[![CI](https://github.com/philiprehberger/ts-retry-queue/actions/workflows/ci.yml/badge.svg)](https://github.com/philiprehberger/ts-retry-queue/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@philiprehberger/retry-queue.svg)](https://www.npmjs.com/package/@philiprehberger/retry-queue)
[![Last updated](https://img.shields.io/github/last-commit/philiprehberger/ts-retry-queue)](https://github.com/philiprehberger/ts-retry-queue/commits/main)

Retry queue with exponential backoff for resilient async processing.

## Installation

```bash
npm install @philiprehberger/retry-queue
```

## Usage

```ts
import { createQueue } from '@philiprehberger/retry-queue';

const queue = createQueue<{ url: string; body: string }>({
  process: async (item) => {
    const res = await fetch(item.url, { method: 'POST', body: item.body });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },
  maxRetries: 5,
  retryDelay: 1000,
  onSuccess: (item) => console.log(`Sent: ${item.url}`),
  onFailure: (item, error) => console.error(`Failed: ${item.url}`, error),
  onRetry: (item, attempt) => console.log(`Retry ${attempt}: ${item.url}`),
});

queue.add({ url: '/api/events', body: JSON.stringify({ event: 'click' }) });

// Pause during offline
window.addEventListener('offline', () => queue.pause());
window.addEventListener('online', () => queue.resume());
```

### Dead Letter Queue

Items that exceed `maxRetries` are automatically moved to a dead letter queue for later inspection or reprocessing.

```ts
const queue = createQueue<string>({
  process: async (item) => { throw new Error('always fails'); },
  maxRetries: 3,
  retryDelay: 100,
});

queue.add('will-fail');

// Later, inspect permanently failed items
const deadItems = queue.getDeadLetterItems();
for (const entry of deadItems) {
  console.log(entry.item, entry.error.message, entry.attempts, entry.failedAt);
}

// Clear when done
queue.clearDeadLetterQueue();
```

### Jitter in Exponential Backoff

Add jitter to backoff delays to avoid thundering herd problems when many clients retry simultaneously.

```ts
// Full jitter: delay is random between 0 and the calculated backoff
const queue = createQueue<string>({
  process: async (item) => { /* ... */ },
  retryDelay: 1000,
  jitter: 'full',
});

// Decorrelated jitter: delay is random between baseDelay and backoff * 3
const queue2 = createQueue<string>({
  process: async (item) => { /* ... */ },
  retryDelay: 1000,
  jitter: 'decorrelated',
});
```

### Max Queue Length

Limit the number of items in the queue to prevent unbounded memory growth. Choose an overflow strategy for when the queue is full.

```ts
// Reject new items when the queue is full (default)
const queue = createQueue<string>({
  process: async (item) => { /* ... */ },
  maxQueueLength: 100,
  overflowStrategy: 'reject-new',
});

const accepted = queue.add('item'); // returns false if queue is full

// Drop the oldest item to make room for new ones
const queue2 = createQueue<string>({
  process: async (item) => { /* ... */ },
  maxQueueLength: 100,
  overflowStrategy: 'drop-oldest',
});
```

### Item Timeout

Set a maximum age for items so they don't retry forever. Timed-out items are moved to the dead letter queue.

```ts
const queue = createQueue<string>({
  process: async (item) => { /* ... */ },
  maxRetries: 10,
  retryDelay: 5000,
  itemTimeout: 30000, // 30 seconds max lifetime per item
  onTimeout: (item) => console.log(`Timed out: ${item}`),
});
```

## API

### `createQueue<T>(options: QueueOptions<T>)`

Creates a new retry queue.

#### `QueueOptions<T>`

- **`process(item)`** — Async function to process each item
- **`maxRetries?`** — Maximum retry attempts (default: `3`)
- **`retryDelay?`** — Base delay in ms for exponential backoff (default: `100`)
- **`jitter?`** — Jitter mode for backoff: `'none'`, `'full'`, or `'decorrelated'` (default: `'none'`)
- **`maxQueueLength?`** — Maximum number of items in the queue (default: unlimited)
- **`overflowStrategy?`** — What to do when queue is full: `'reject-new'` or `'drop-oldest'` (default: `'reject-new'`)
- **`itemTimeout?`** — Maximum age in ms before an item is considered timed out (default: unlimited)
- **`onSuccess?(item)`** — Called after successful processing
- **`onFailure?(item, error)`** — Called when all retries exhausted
- **`onRetry?(item, attempt)`** — Called before each retry
- **`onTimeout?(item)`** — Called when an item exceeds its timeout

#### Queue instance

- **`add(item)`** — Add an item to the queue; returns `false` if rejected due to `maxQueueLength`
- **`pause()`** — Pause processing
- **`resume()`** — Resume processing
- **`clear()`** — Remove all pending items
- **`pending`** — Number of items waiting in the queue
- **`getDeadLetterItems()`** — Returns a copy of all permanently failed items
- **`clearDeadLetterQueue()`** — Clears the dead letter queue
- **`deadLetterCount`** — Number of items in the dead letter queue

## Development

```bash
npm install
npm run build
npm test
```

## Support

If you find this project useful:

⭐ [Star the repo](https://github.com/philiprehberger/ts-retry-queue)

🐛 [Report issues](https://github.com/philiprehberger/ts-retry-queue/issues?q=is%3Aissue+is%3Aopen+label%3Abug)

💡 [Suggest features](https://github.com/philiprehberger/ts-retry-queue/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)

❤️ [Sponsor development](https://github.com/sponsors/philiprehberger)

🌐 [All Open Source Projects](https://philiprehberger.com/open-source-packages)

💻 [GitHub Profile](https://github.com/philiprehberger)

🔗 [LinkedIn Profile](https://www.linkedin.com/in/philiprehberger)

## License

[MIT](LICENSE)

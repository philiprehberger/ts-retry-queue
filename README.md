# @philiprehberger/retry-queue

[![CI](https://github.com/philiprehberger/ts-retry-queue/actions/workflows/ci.yml/badge.svg)](https://github.com/philiprehberger/ts-retry-queue/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@philiprehberger/retry-queue)](https://www.npmjs.com/package/@philiprehberger/retry-queue)
[![License](https://img.shields.io/github/license/philiprehberger/ts-retry-queue)](LICENSE)
[![Sponsor](https://img.shields.io/badge/sponsor-GitHub%20Sponsors-ec6cb9)](https://github.com/sponsors/philiprehberger)

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

## API

### `createQueue<T>(options: QueueOptions<T>)`

Creates a new retry queue.

#### `QueueOptions<T>`

- **`process(item)`** — Async function to process each item
- **`maxRetries?`** — Maximum retry attempts (default: `3`)
- **`retryDelay?`** — Base delay in ms for exponential backoff (default: `100`)
- **`onSuccess?(item)`** — Called after successful processing
- **`onFailure?(item, error)`** — Called when all retries exhausted
- **`onRetry?(item, attempt)`** — Called before each retry

#### Queue instance

- **`add(item)`** — Add an item to the queue
- **`pause()`** — Pause processing
- **`resume()`** — Resume processing
- **`clear()`** — Remove all pending items
- **`pending`** — Number of items waiting in the queue

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue } from '../../dist/index.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('createQueue', () => {
  it('add processes item', async () => {
    const processed: string[] = [];
    const queue = createQueue<string>({
      process: async (item) => { processed.push(item); },
    });
    queue.add('hello');
    await wait(50);
    assert.deepEqual(processed, ['hello']);
  });

  it('successful item calls onSuccess', async () => {
    const successes: string[] = [];
    const queue = createQueue<string>({
      process: async () => {},
      onSuccess: (item) => successes.push(item),
    });
    queue.add('ok');
    await wait(50);
    assert.deepEqual(successes, ['ok']);
  });

  it('failed item retries then succeeds', async () => {
    let attempts = 0;
    const successes: string[] = [];
    const retries: number[] = [];
    const queue = createQueue<string>({
      process: async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
      },
      maxRetries: 3,
      retryDelay: 10,
      onSuccess: (item) => successes.push(item),
      onRetry: (_item, attempt) => retries.push(attempt),
    });
    queue.add('retry-me');
    await wait(500);
    assert.deepEqual(successes, ['retry-me']);
    assert.equal(retries.length, 2);
  });

  it('max retries exceeded calls onFailure', async () => {
    const failures: string[] = [];
    const queue = createQueue<string>({
      process: async () => { throw new Error('always fail'); },
      maxRetries: 2,
      retryDelay: 10,
      onFailure: (item) => failures.push(item),
    });
    queue.add('doomed');
    await wait(500);
    assert.deepEqual(failures, ['doomed']);
  });

  it('pause stops processing and resume continues', async () => {
    const processed: string[] = [];
    const queue = createQueue<string>({
      process: async (item) => { processed.push(item); },
    });
    queue.pause();
    queue.add('a');
    queue.add('b');
    await wait(50);
    assert.deepEqual(processed, []);
    assert.equal(queue.pending, 2);

    queue.resume();
    await wait(50);
    assert.deepEqual(processed, ['a', 'b']);
  });

  it('pending count reflects queue size', () => {
    const queue = createQueue<string>({
      process: async () => { await wait(1000); },
    });
    queue.pause();
    queue.add('a');
    queue.add('b');
    queue.add('c');
    assert.equal(queue.pending, 3);
  });

  it('clear empties the queue', () => {
    const queue = createQueue<string>({
      process: async () => {},
    });
    queue.pause();
    queue.add('a');
    queue.add('b');
    assert.equal(queue.pending, 2);
    queue.clear();
    assert.equal(queue.pending, 0);
  });

  it('exponential backoff increases delays', async () => {
    const retryTimes: number[] = [];
    let start = Date.now();
    const queue = createQueue<string>({
      process: async () => { throw new Error('fail'); },
      maxRetries: 3,
      retryDelay: 10,
      onRetry: () => {
        retryTimes.push(Date.now() - start);
        start = Date.now();
      },
    });
    queue.add('test');
    await wait(500);
    assert.equal(retryTimes.length, 2);
    // Second retry delay should be longer than the first
    assert.ok(retryTimes[1] > retryTimes[0]);
  });
});

describe('dead letter queue', () => {
  it('failed items are added to dead letter queue', async () => {
    const queue = createQueue<string>({
      process: async () => { throw new Error('fail'); },
      maxRetries: 1,
      retryDelay: 5,
      onFailure: () => {},
    });
    queue.add('doomed');
    await wait(200);
    const dlq = queue.getDeadLetterItems();
    assert.equal(dlq.length, 1);
    assert.equal(dlq[0].item, 'doomed');
    assert.equal(dlq[0].error.message, 'fail');
    assert.equal(dlq[0].attempts, 1);
    assert.equal(queue.deadLetterCount, 1);
  });

  it('clearDeadLetterQueue empties the dead letter queue', async () => {
    const queue = createQueue<string>({
      process: async () => { throw new Error('fail'); },
      maxRetries: 1,
      retryDelay: 5,
      onFailure: () => {},
    });
    queue.add('a');
    await wait(200);
    assert.equal(queue.deadLetterCount, 1);
    queue.clearDeadLetterQueue();
    assert.equal(queue.deadLetterCount, 0);
    assert.deepEqual(queue.getDeadLetterItems(), []);
  });

  it('getDeadLetterItems returns a copy', async () => {
    const queue = createQueue<string>({
      process: async () => { throw new Error('fail'); },
      maxRetries: 1,
      retryDelay: 5,
      onFailure: () => {},
    });
    queue.add('a');
    await wait(200);
    const items = queue.getDeadLetterItems();
    items.length = 0;
    assert.equal(queue.deadLetterCount, 1);
  });
});

describe('jitter', () => {
  it('full jitter produces delay less than or equal to raw backoff', async () => {
    const retryTimes: number[] = [];
    let start = Date.now();
    const queue = createQueue<string>({
      process: async () => { throw new Error('fail'); },
      maxRetries: 2,
      retryDelay: 50,
      jitter: 'full',
      onRetry: () => {
        retryTimes.push(Date.now() - start);
        start = Date.now();
      },
    });
    queue.add('test');
    await wait(1000);
    // full jitter: delay is random between 0 and backoff, so should be <= raw backoff
    // raw backoff for attempt 1 = 50 * 2^1 = 100
    assert.equal(retryTimes.length, 1);
    assert.ok(retryTimes[0] <= 150); // generous upper bound
  });

  it('decorrelated jitter produces delays', async () => {
    const retries: number[] = [];
    const queue = createQueue<string>({
      process: async () => { throw new Error('fail'); },
      maxRetries: 2,
      retryDelay: 10,
      jitter: 'decorrelated',
      onRetry: (_item, attempt) => retries.push(attempt),
    });
    queue.add('test');
    await wait(1000);
    assert.equal(retries.length, 1);
  });
});

describe('max queue length', () => {
  it('reject-new strategy rejects when queue is full', () => {
    const queue = createQueue<string>({
      process: async () => { await wait(5000); },
      maxQueueLength: 2,
      overflowStrategy: 'reject-new',
    });
    queue.pause();
    assert.equal(queue.add('a'), true);
    assert.equal(queue.add('b'), true);
    assert.equal(queue.add('c'), false);
    assert.equal(queue.pending, 2);
  });

  it('drop-oldest strategy removes oldest item', () => {
    const queue = createQueue<string>({
      process: async () => { await wait(5000); },
      maxQueueLength: 2,
      overflowStrategy: 'drop-oldest',
    });
    queue.pause();
    queue.add('a');
    queue.add('b');
    queue.add('c');
    assert.equal(queue.pending, 2);
  });

  it('defaults to reject-new strategy', () => {
    const queue = createQueue<string>({
      process: async () => { await wait(5000); },
      maxQueueLength: 1,
    });
    queue.pause();
    assert.equal(queue.add('a'), true);
    assert.equal(queue.add('b'), false);
  });
});

describe('item timeout', () => {
  it('timed out items trigger onTimeout and go to dead letter queue', async () => {
    const timedOut: string[] = [];
    const queue = createQueue<string>({
      process: async () => { throw new Error('fail'); },
      maxRetries: 5,
      retryDelay: 50,
      itemTimeout: 80,
      onTimeout: (item) => timedOut.push(item),
    });
    queue.add('slow');
    await wait(1000);
    assert.ok(timedOut.includes('slow'));
    const dlq = queue.getDeadLetterItems();
    assert.ok(dlq.some((d) => d.item === 'slow'));
  });
});

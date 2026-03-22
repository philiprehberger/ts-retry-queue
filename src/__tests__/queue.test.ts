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

# Changelog

## 0.2.0

- Add dead letter queue for permanently failed items
- Add jitter to exponential backoff (full and decorrelated modes)
- Add max queue length with overflow strategy
- Add per-item timeout with onTimeout callback

## 0.1.2

- Standardize README to 3-badge format with emoji Support section
- Update CI actions to v5 for Node.js 24 compatibility
- Add GitHub issue templates, dependabot config, and PR template

## 0.1.1

- Standardize package metadata, badges, and CHANGELOG

## 0.1.0

- `createQueue()` for resilient async processing
- Exponential backoff retry strategy
- `pause()` and `resume()` flow control
- Configurable `maxRetries` and `retryDelay`
- `onSuccess`, `onFailure`, and `onRetry` event hooks

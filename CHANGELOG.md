# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-03-21

### Added

- `createQueue()` for resilient async processing
- Exponential backoff retry strategy
- `pause()` and `resume()` flow control
- Configurable `maxRetries` and `retryDelay`
- `onSuccess`, `onFailure`, and `onRetry` event hooks

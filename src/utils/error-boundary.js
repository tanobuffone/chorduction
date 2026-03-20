/**
 * @fileoverview Global error boundary — prevents full extension crash.
 * @module utils/error-boundary
 */

let _initialized = false;

/**
 * Register window-level error handlers. Safe to call multiple times.
 * @param {import('./logger.js').Logger} logger
 */
export function initErrorBoundary(logger) {
  if (_initialized || typeof window === 'undefined') { return; }
  _initialized = true;
  window.addEventListener('error', e => {
    logger.error('[ErrorBoundary] Uncaught error:', e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', e => {
    logger.error('[ErrorBoundary] Unhandled rejection:', e.reason);
  });
  logger.debug('[ErrorBoundary] Initialized');
}

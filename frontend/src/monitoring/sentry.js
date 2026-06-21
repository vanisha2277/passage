import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || initialized) return false;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    // Validation failures only — no PII in breadcrumbs by design
    beforeSend(event) {
      return event;
    },
  });
  initialized = true;
  return true;
}

/**
 * @param {{ sessionId: string, tokenCheck: ReturnType<typeof import('../validation/validateTranslation.js').validateTranslationTokens>, leakCheck: ReturnType<typeof import('../validation/validateTranslation.js').noRawPiiLeak> }} params
 */
export function captureValidationFailure({ sessionId, tokenCheck, leakCheck }) {
  Sentry.captureMessage('translation token validation failed', {
    level: 'error',
    tags: { path: 'validation-failure' },
    extra: {
      session_id: sessionId,
      expected_token_keys: tokenCheck.expectedKeys ?? [],
      found_token_keys: tokenCheck.foundKeys ?? [],
      unexpected_token_keys: tokenCheck.unexpected ?? [],
      missing_token_keys: tokenCheck.missing ?? [],
      response_token_instances: tokenCheck.responseInstances ?? 0,
      token_validation_ok: tokenCheck.ok,
      raw_leak_ok: leakCheck.ok,
      reason: tokenCheck.reason ?? leakCheck.reason ?? 'unknown',
    },
  });
}

export { Sentry };

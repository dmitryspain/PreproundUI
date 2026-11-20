import type { MessageKey } from './messages/uk';

/**
 * Codes of `POST /api/tests` that the setup itself cannot cause: the page only offers what the catalog has,
 * so the catalog must have changed between loading it and starting the test.
 */
const CATALOG_CHANGED: ReadonlySet<string> = new Set([
  'Test.FieldNotFound',
  'Test.UnknownLevel',
  'Test.UnknownTopic',
  'Test.NotEnoughQuestions',
]);

/**
 * Which text explains a failed API call. Worded by status and `code` only: the server's `message` is meant
 * for developers and is in one language, so the interface never shows it (ADR 006).
 * `status` 0 means no answer at all: the API is down, CORS failed or the certificate is not trusted.
 */
export function apiErrorKey(status: number, code: string | null): MessageKey {
  if (status === 0) {
    return 'errors.network';
  }
  if (status === 429) {
    return 'errors.tooManyRequests';
  }
  if (status === 400) {
    return code !== null && CATALOG_CHANGED.has(code) ? 'errors.catalogChanged' : 'errors.rejected';
  }
  return 'errors.server';
}

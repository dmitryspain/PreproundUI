import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/** Base address of the API, without a trailing slash. Code reads it only through this token. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

/** Time the timer gives for one question (spec 3.1, item 6): 20 questions get 20 minutes. */
export const SECONDS_PER_QUESTION = 60;

/**
 * How long the catalog may load before Setup explains the wait: the free API host sleeps when idle
 * and takes about a minute to wake up (ADR 005), which otherwise looks like a broken site.
 */
export const SLOW_CATALOG_HINT_MS = 5000;

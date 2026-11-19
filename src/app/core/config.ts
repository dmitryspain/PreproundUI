import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/** Base address of the API, without a trailing slash. Code reads it only through this token. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

/** Time the timer gives for one question (spec 3.1, item 6): 20 questions get 20 minutes. */
export const SECONDS_PER_QUESTION = 60;

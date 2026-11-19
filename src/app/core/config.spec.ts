import { TestBed } from '@angular/core/testing';
import { environment as production } from '../../environments/environment.production';
import { API_BASE_URL } from './config';

describe('API_BASE_URL', () => {
  // `ng test` builds with the development configuration, which has no `fileReplacements` (PRP-022).
  it('defaults to the local API in tests, never to the production one', () => {
    expect(TestBed.inject(API_BASE_URL)).toBe('https://localhost:7120/api');
  });

  // ApiService appends `/catalog` and `/tests` to it, and a page on https cannot call plain http.
  it('points the production build at an https address without a trailing slash', () => {
    expect(production.apiBaseUrl).toMatch(/^https:\/\/[^/]+\/api$/);
  });
});

import { InjectionToken, Signal, signal } from '@angular/core';

/** Display settings of the system, so tests can pretend a dark system or reduced motion. */
export interface Media {
  /** `prefers-color-scheme: dark`; changes live when the user switches the system theme. */
  readonly prefersDark: Signal<boolean>;

  /** `prefers-reduced-motion: reduce` at the moment of the call. */
  prefersReducedMotion(): boolean;
}

/** The only way the app reads system media queries. */
export const MEDIA = new InjectionToken<Media>('MEDIA', {
  providedIn: 'root',
  factory: () => systemMedia(),
});

/**
 * {@link Media} over `window.matchMedia`. Without `matchMedia` (jsdom, very old browsers)
 * the system counts as light with full motion, and nothing throws.
 */
function systemMedia(): Media {
  const query = (text: string): MediaQueryList | null =>
    typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(text) : null;

  const dark = query('(prefers-color-scheme: dark)');
  const prefersDark = signal(dark?.matches ?? false);
  // Lives as long as the app: the token is a root singleton, so the listener is never removed.
  dark?.addEventListener('change', (event) => prefersDark.set(event.matches));

  return {
    prefersDark: prefersDark.asReadonly(),
    prefersReducedMotion: () => query('(prefers-reduced-motion: reduce)')?.matches ?? false,
  };
}

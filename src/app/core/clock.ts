import { InjectionToken } from '@angular/core';
import { Observable, interval, map } from 'rxjs';

/** The only source of time in the app, so tests can stop it and move it by hand. */
export interface Clock {
  /** Milliseconds since the Unix epoch (UTC), like `Date.now()`. */
  now(): number;

  /**
   * Emits about once a second. Only a reason to read `now()` again: browsers slow timers down
   * in background tabs, so counting ticks would drift from the real time.
   */
  readonly ticks: Observable<void>;
}

/** {@link Clock} over the system time. */
export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => ({
    now: () => Date.now(),
    ticks: interval(1000).pipe(map((): void => undefined)),
  }),
});

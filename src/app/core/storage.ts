import { InjectionToken } from '@angular/core';

/**
 * Local data of the user (history, seen questions) as JSON under versioned keys, e.g. `prepround.history.v1`.
 * Never throws: the browser may block storage or run out of quota, and the app must keep working without it.
 */
export interface AppStorage {
  /** `null` when the key is missing, the stored JSON is broken or storage is unavailable. */
  get<T>(key: string): T | null;

  /** `false` when the value was not saved (quota exceeded, storage unavailable, value not serializable). */
  set(key: string, value: unknown): boolean;

  remove(key: string): void;
}

/** {@link AppStorage} over the Web Storage API (`localStorage` in the app). */
export class WebJsonStorage implements AppStorage {
  // A getter rather than the object itself: merely reading window.localStorage throws
  // when the browser blocks site data, and that must end up in the catch blocks below.
  constructor(private readonly backend: () => Storage) {}

  get<T>(key: string): T | null {
    try {
      const raw = this.backend().getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): boolean {
    try {
      this.backend().setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      this.backend().removeItem(key);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }
}

/** The only way to keep data on the device. */
export const STORAGE = new InjectionToken<AppStorage>('STORAGE', {
  providedIn: 'root',
  factory: () => new WebJsonStorage(() => localStorage),
});

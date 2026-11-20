import { InjectionToken, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/** A language of the interface (ADR 006). */
export type LanguageId = 'uk' | 'en';

/** Every language the code knows, whether or not this build offers it. */
const KNOWN: readonly LanguageId[] = ['uk', 'en'];

export function isLanguageId(value: unknown): value is LanguageId {
  return KNOWN.some((id) => id === value);
}

/**
 * Languages this build offers, in the order of the switch. Data of the build, not code: production keeps
 * a single language until its content is translated (PRP-031), and with one language there is no switch.
 */
export const LANGUAGES = new InjectionToken<readonly LanguageId[]>('LANGUAGES', {
  providedIn: 'root',
  factory: () => environment.languages,
});

/** The language when neither a saved choice nor the browser settings name one of {@link LANGUAGES}. */
export const DEFAULT_LANGUAGE = new InjectionToken<LanguageId>('DEFAULT_LANGUAGE', {
  providedIn: 'root',
  factory: () => environment.defaultLanguage,
});

/**
 * Language tags the browser prefers, most wanted first (`uk-UA`, `en`, …). The only way the app reads
 * `navigator`, so tests can pretend any browser.
 */
export const BROWSER_LANGUAGES = new InjectionToken<readonly string[]>('BROWSER_LANGUAGES', {
  providedIn: 'root',
  factory: () => {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.languages?.length) {
      return [...nav.languages];
    }
    return nav?.language ? [nav.language] : [];
  },
});

/**
 * The language on screen. A module-level signal rather than only a field of a service, so plain functions
 * (`translate()` in services, `computed` lists in components) can read it: whatever reads it inside a template
 * or a `computed` follows a switch by itself. `PrefsService` is its only writer; until it starts, the value
 * matches `<html lang="uk">` of `index.html`.
 */
export const currentLanguage = signal<LanguageId>('uk');

/** Key of the language's own name ("Українська", "English"), the same in every dictionary. */
export function languageNameKey<T extends LanguageId>(id: T): `language.${T}` {
  return `language.${id}`;
}

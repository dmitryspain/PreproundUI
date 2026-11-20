import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  BROWSER_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LanguageId,
  currentLanguage,
  isLanguageId,
} from './i18n/languages';
import { MEDIA } from './media';
import { AppStorage, STORAGE } from './storage';
import { AUTO_DARK, AUTO_LIGHT, THEMES, ThemeChoice, ThemeId } from './themes';

/** Where the preferences live. `public/theme-init.js` reads the same key and shape before Angular starts. */
export const PREFS_KEY = 'prepround.prefs.v1';

interface StoredPrefs {
  theme: ThemeChoice;
  /** OKLCH hue of the accent; `null` keeps the theme's own accent. */
  accent: number | null;
  /**
   * The language the user picked. Optional, so records from before the switch stay valid under `v1`:
   * without it the language follows the browser.
   */
  language?: LanguageId;
}

/** A point on the screen in CSS pixels, like `MouseEvent.clientX` / `clientY`. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** How long the new theme takes to grow over the old one. */
const REVEAL_MS = 640;

/**
 * Theme, accent and language of the interface. Persisted through `STORAGE` and mirrored onto `<html>`:
 * `data-theme` selects the tokens, `--accent-h-user` overrides the theme's accent hue, `lang` names the language.
 */
@Injectable({ providedIn: 'root' })
export class PrefsService {
  private readonly doc = inject(DOCUMENT);
  private readonly media = inject(MEDIA);
  private readonly storage = inject(STORAGE);
  private readonly languages = inject(LANGUAGES);
  private readonly initial = read(this.storage);

  private readonly themeChoice = signal<ThemeChoice>(this.initial.theme);
  private readonly accentHue = signal<number | null>(this.initial.accent);
  /**
   * The language the user picked, kept as saved even while this build does not offer it,
   * so changing the theme does not erase it; `undefined` until the user picks one.
   */
  private languageChoice: LanguageId | undefined = this.initial.language;

  readonly theme = this.themeChoice.asReadonly();
  /** `null` while the theme's own accent is used. */
  readonly accent = this.accentHue.asReadonly();
  /**
   * The language on screen, always one of `LANGUAGES`: the saved choice, else the first language of the browser
   * this build offers, else the default one. The same signal `translate()` and the `t` pipe read.
   */
  readonly language = currentLanguage.asReadonly();

  /** The theme actually on screen: `auto` follows the system, live. */
  readonly resolvedTheme = computed<ThemeId>(() => {
    const choice = this.themeChoice();
    if (choice !== 'auto') {
      return choice;
    }
    return this.media.prefersDark() ? AUTO_DARK : AUTO_LIGHT;
  });

  constructor() {
    currentLanguage.set(
      pickLanguage(
        this.languageChoice,
        inject(BROWSER_LANGUAGES),
        this.languages,
        inject(DEFAULT_LANGUAGE),
      ),
    );
    // Right away as well, so <html> matches the signals before the first change detection.
    this.applyDom();
    // Covers `auto` following a change of the system theme; user changes apply synchronously.
    effect(() => this.applyDom());
  }

  /**
   * Switches the theme. Where View Transitions are supported and the system does not ask
   * for reduced motion, the new theme grows as a circle from `origin` (the clicked control).
   */
  setTheme(choice: ThemeChoice, origin?: ScreenPoint): void {
    if (choice === this.themeChoice()) {
      return;
    }
    this.transition(() => {
      this.themeChoice.set(choice);
      this.applyDom();
      this.save();
    }, origin);
  }

  /** `null` returns to the theme's own accent; anything but a hue of 0–360 is ignored. */
  setAccent(hue: number | null): void {
    if ((hue !== null && !isHue(hue)) || hue === this.accentHue()) {
      return;
    }
    this.accentHue.set(hue);
    this.applyDom();
    this.save();
  }

  /**
   * Switches the language at once, without a reload or an animation. A language this build does not offer
   * is ignored. Picking the language already on screen still saves it: from then on it is the user's choice
   * rather than the browser's.
   */
  setLanguage(id: LanguageId): void {
    if (!this.languages.includes(id) || id === this.languageChoice) {
      return;
    }
    this.languageChoice = id;
    currentLanguage.set(id);
    this.applyDom();
    this.save();
  }

  private transition(update: () => void, origin?: ScreenPoint): void {
    const doc = this.doc;
    const view = doc.defaultView;
    if (
      typeof doc.startViewTransition !== 'function' ||
      !view ||
      this.media.prefersReducedMotion()
    ) {
      update();
      return;
    }

    const root = doc.documentElement;
    const x = origin?.x ?? view.innerWidth / 2;
    const y = origin?.y ?? view.innerHeight / 2;
    // Far enough to cover the farthest corner of the viewport.
    const radius = Math.hypot(Math.max(x, view.innerWidth - x), Math.max(y, view.innerHeight - y));

    root.classList.add('theme-vt');
    // The new snapshot is taken right after this callback, so the DOM must be updated synchronously in it.
    const transition = doc.startViewTransition(update);
    // Each promise rejects when the transition is skipped (e.g. a second click mid-animation);
    // the update callback still runs then, so the theme is applied either way.
    transition.updateCallbackDone.catch(() => undefined);
    transition.ready
      .then(() =>
        // Throws where Web Animations are missing (jsdom): the catch below keeps the instant switch.
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          {
            duration: REVEAL_MS,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        ),
      )
      .catch(() => undefined);
    transition.finished.catch(() => undefined).finally(() => root.classList.remove('theme-vt'));
  }

  private applyDom(): void {
    const root = this.doc.documentElement;
    root.dataset['theme'] = this.resolvedTheme();
    root.lang = this.language();

    const hue = this.accentHue();
    if (hue === null) {
      root.style.removeProperty('--accent-h-user');
    } else {
      root.style.setProperty('--accent-h-user', String(hue));
    }

    // Keeps the browser chrome (the mobile address bar) in the theme's colour.
    // Without the stylesheet (jsdom) the token is empty, and the meta keeps its value.
    const meta = this.doc.querySelector('meta[name="theme-color"]');
    const colour = this.doc.defaultView?.getComputedStyle(root).getPropertyValue('--meta').trim();
    if (meta && colour) {
      meta.setAttribute('content', colour);
    }
  }

  /** Only after a change by the user, never on start: a language that only follows the browser is not saved. */
  private save(): void {
    const prefs: StoredPrefs = { theme: this.themeChoice(), accent: this.accentHue() };
    if (this.languageChoice !== undefined) {
      prefs.language = this.languageChoice;
    }
    // A failed write keeps the choice until a reload: it is a setting, not the user's data, so no message.
    this.storage.set(PREFS_KEY, prefs);
  }
}

/** Anything unknown falls back to the default: a broken or foreign value must not break the app. */
function read(storage: AppStorage): StoredPrefs {
  const stored = storage.get<unknown>(PREFS_KEY);
  const raw: Partial<Record<keyof StoredPrefs, unknown>> =
    typeof stored === 'object' && stored !== null ? stored : {};
  return {
    theme: isThemeChoice(raw.theme) ? raw.theme : 'auto',
    accent: isHue(raw.accent) ? raw.accent : null,
    language: isLanguageId(raw.language) ? raw.language : undefined,
  };
}

/** The saved choice if this build offers it, else the browser's first offered language (`uk-UA` → `uk`), else the default. */
function pickLanguage(
  saved: LanguageId | undefined,
  browser: readonly string[],
  offered: readonly LanguageId[],
  fallback: LanguageId,
): LanguageId {
  if (saved !== undefined && offered.includes(saved)) {
    return saved;
  }
  for (const tag of browser) {
    // Only the primary subtag counts, in any case: `EN-gb` is English.
    const primary = tag.split('-')[0].toLowerCase();
    const match = offered.find((id) => id === primary);
    if (match) {
      return match;
    }
  }
  // A default the build does not offer (a single-language build) gives way to its first language.
  return offered.includes(fallback) ? fallback : (offered[0] ?? fallback);
}

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'auto' || THEMES.some((theme) => theme.id === value);
}

function isHue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 360;
}

import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { MEDIA } from './media';
import { AppStorage, STORAGE } from './storage';
import { AUTO_DARK, AUTO_LIGHT, THEMES, ThemeChoice, ThemeId } from './themes';

/** Where the preferences live. `public/theme-init.js` reads the same key and shape before Angular starts. */
export const PREFS_KEY = 'prepround.prefs.v1';

interface StoredPrefs {
  theme: ThemeChoice;
  /** OKLCH hue of the accent; `null` keeps the theme's own accent. */
  accent: number | null;
}

/** A point on the screen in CSS pixels, like `MouseEvent.clientX` / `clientY`. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** How long the new theme takes to grow over the old one. */
const REVEAL_MS = 640;

/**
 * Theme and accent of the interface. Persisted through `STORAGE` and mirrored onto `<html>`:
 * `data-theme` selects the tokens, `--accent-h-user` overrides the theme's accent hue.
 */
@Injectable({ providedIn: 'root' })
export class PrefsService {
  private readonly doc = inject(DOCUMENT);
  private readonly media = inject(MEDIA);
  private readonly storage = inject(STORAGE);
  private readonly initial = read(this.storage);

  private readonly themeChoice = signal<ThemeChoice>(this.initial.theme);
  private readonly accentHue = signal<number | null>(this.initial.accent);

  readonly theme = this.themeChoice.asReadonly();
  /** `null` while the theme's own accent is used. */
  readonly accent = this.accentHue.asReadonly();

  /** The theme actually on screen: `auto` follows the system, live. */
  readonly resolvedTheme = computed<ThemeId>(() => {
    const choice = this.themeChoice();
    if (choice !== 'auto') {
      return choice;
    }
    return this.media.prefersDark() ? AUTO_DARK : AUTO_LIGHT;
  });

  constructor() {
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

  /** Only after a change by the user, never on start. */
  private save(): void {
    const prefs: StoredPrefs = { theme: this.themeChoice(), accent: this.accentHue() };
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
  };
}

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'auto' || THEMES.some((theme) => theme.id === value);
}

function isHue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 360;
}

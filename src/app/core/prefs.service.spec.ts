import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MEDIA, Media } from './media';
import { PREFS_KEY, PrefsService } from './prefs.service';
import { AppStorage, STORAGE } from './storage';

/** Keeps raw JSON like localStorage does and records every write; broken JSON reads as `null`, as in `WebJsonStorage`. */
class FakeAppStorage implements AppStorage {
  readonly raw = new Map<string, string>();
  readonly writes: { key: string; value: unknown }[] = [];
  failWrites = false;

  get<T>(key: string): T | null {
    const raw = this.raw.get(key);
    if (raw === undefined) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): boolean {
    this.writes.push({ key, value });
    if (this.failWrites) {
      return false;
    }
    this.raw.set(key, JSON.stringify(value));
    return true;
  }

  remove(key: string): void {
    this.raw.delete(key);
  }

  /** What is stored under the prefs key, parsed. */
  stored(): unknown {
    const raw = this.raw.get(PREFS_KEY);
    return raw === undefined ? undefined : JSON.parse(raw);
  }
}

class FakeMedia implements Media {
  readonly dark = signal(false);
  readonly prefersDark = this.dark.asReadonly();
  reducedMotion = false;

  prefersReducedMotion(): boolean {
    return this.reducedMotion;
  }
}

type Settle = 'resolve' | 'reject';

/** Stands in for `document.startViewTransition`: runs the update callback synchronously, like the browser. */
class FakeViewTransitions {
  calls = 0;
  /** `reject` behaves like a skipped transition: every promise rejects. */
  settle: Settle = 'resolve';
  /** Settles `finished` of the last transition. */
  private finish: (() => void) | null = null;

  install(): void {
    (document as unknown as { startViewTransition: unknown }).startViewTransition = (
      update: () => void,
    ) => {
      this.calls++;
      update();
      const skipped = () => new DOMException('Skipped', 'AbortError');
      const settled = (): Promise<void> =>
        this.settle === 'resolve' ? Promise.resolve() : Promise.reject(skipped());
      const finished = new Promise<void>((resolve, reject) => {
        this.finish = () => (this.settle === 'resolve' ? resolve() : reject(skipped()));
      });
      return {
        ready: settled(),
        updateCallbackDone: settled(),
        finished,
        skipTransition: () => undefined,
      };
    };
  }

  end(): void {
    this.finish?.();
  }
}

function uninstallViewTransitions(): void {
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
}

/** Lets the promise chains of the transition run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('PrefsService', () => {
  let storage: FakeAppStorage;
  let media: FakeMedia;
  const root = document.documentElement;

  function create(saved?: string): PrefsService {
    if (saved !== undefined) {
      storage.raw.set(PREFS_KEY, saved);
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: STORAGE, useValue: storage },
        { provide: MEDIA, useValue: media },
      ],
    });
    return TestBed.inject(PrefsService);
  }

  const accentOnHtml = () => root.style.getPropertyValue('--accent-h-user');

  beforeEach(() => {
    storage = new FakeAppStorage();
    media = new FakeMedia();
    // The attribute and the property live on the shared jsdom <html> between tests.
    delete root.dataset['theme'];
    root.style.removeProperty('--accent-h-user');
    root.classList.remove('theme-vt');
    uninstallViewTransitions();
  });

  afterEach(() => {
    uninstallViewTransitions();
  });

  describe('start', () => {
    it('defaults to auto and the theme accent when nothing is saved', () => {
      const prefs = create();

      expect(prefs.theme()).toBe('auto');
      expect(prefs.accent()).toBeNull();
      expect(accentOnHtml()).toBe('');
    });

    it('resolves auto to Aurora on a dark system', () => {
      media.dark.set(true);

      const prefs = create();

      expect(prefs.resolvedTheme()).toBe('aurora');
      expect(root.getAttribute('data-theme')).toBe('aurora');
    });

    it('resolves auto to Daylight on a light system', () => {
      media.dark.set(false);

      const prefs = create();

      expect(prefs.resolvedTheme()).toBe('daylight');
      expect(root.getAttribute('data-theme')).toBe('daylight');
    });

    it('follows a live change of the system theme while on auto', () => {
      create();
      TestBed.tick();
      expect(root.getAttribute('data-theme')).toBe('daylight');

      media.dark.set(true);
      TestBed.tick();
      expect(root.getAttribute('data-theme')).toBe('aurora');

      media.dark.set(false);
      TestBed.tick();
      expect(root.getAttribute('data-theme')).toBe('daylight');
    });

    it('ignores the system theme once a theme is picked', () => {
      const prefs = create();
      prefs.setTheme('terminal');

      media.dark.set(true);
      TestBed.tick();

      expect(root.getAttribute('data-theme')).toBe('terminal');
    });

    it('applies a saved theme and accent on start', () => {
      const prefs = create('{"theme":"terminal","accent":160}');

      expect(prefs.theme()).toBe('terminal');
      expect(prefs.accent()).toBe(160);
      expect(root.getAttribute('data-theme')).toBe('terminal');
      expect(accentOnHtml()).toBe('160');
    });

    it('keeps a saved accent of 0, the lowest hue', () => {
      const prefs = create('{"theme":"daylight","accent":0}');

      expect(prefs.accent()).toBe(0);
      expect(accentOnHtml()).toBe('0');
    });

    it('writes nothing on start, with or without saved prefs', () => {
      create('{"theme":"brutal","accent":"x"}');
      TestBed.tick();
      media.dark.set(true);
      TestBed.tick();

      expect(storage.writes).toEqual([]);
    });
  });

  describe('reading saved prefs', () => {
    it('falls back to auto and the theme accent for an unknown theme and a non-numeric accent', () => {
      const prefs = create('{"theme":"brutal","accent":"x"}');

      expect(prefs.theme()).toBe('auto');
      expect(prefs.accent()).toBeNull();
    });

    it.each([
      ['above 360', '{"accent":400}'],
      ['negative', '{"accent":-1}'],
      ['a numeric string', '{"accent":"160"}'],
    ])('drops an accent that is %s', (_case, saved) => {
      const prefs = create(saved);

      expect(prefs.accent()).toBeNull();
      expect(accentOnHtml()).toBe('');
    });

    it.each([
      ['broken JSON', '{"theme":"terminal",'],
      ['an array', '["terminal",160]'],
      ['a string', '"terminal"'],
      ['null', 'null'],
    ])('uses the defaults for %s without throwing', (_case, saved) => {
      const prefs = create(saved);

      expect(prefs.theme()).toBe('auto');
      expect(prefs.accent()).toBeNull();
      expect(storage.writes).toEqual([]);
    });
  });

  describe('setTheme and setAccent', () => {
    it('applies and saves a picked theme', () => {
      const prefs = create();

      prefs.setTheme('terminal');

      expect(prefs.theme()).toBe('terminal');
      expect(root.getAttribute('data-theme')).toBe('terminal');
      expect(storage.stored()).toEqual({ theme: 'terminal', accent: null });
    });

    it('sets, saves and removes the accent on <html>', () => {
      const prefs = create();

      prefs.setAccent(160);
      expect(accentOnHtml()).toBe('160');
      expect(storage.stored()).toEqual({ theme: 'auto', accent: 160 });

      prefs.setAccent(null);
      expect(accentOnHtml()).toBe('');
      expect(prefs.accent()).toBeNull();
      expect(storage.stored()).toEqual({ theme: 'auto', accent: null });
    });

    it('keeps the accent when the theme changes, and the theme when the accent changes', () => {
      const prefs = create();

      prefs.setAccent(28);
      prefs.setTheme('daylight');

      expect(storage.stored()).toEqual({ theme: 'daylight', accent: 28 });
      expect(accentOnHtml()).toBe('28');
    });

    it.each([400, -5, Number.NaN, Number.POSITIVE_INFINITY])('ignores the accent %s', (hue) => {
      const prefs = create('{"accent":120}');

      prefs.setAccent(hue);

      expect(prefs.accent()).toBe(120);
      expect(accentOnHtml()).toBe('120');
      expect(storage.writes).toEqual([]);
    });

    it('does nothing when the same theme is picked again', () => {
      const transitions = new FakeViewTransitions();
      transitions.install();
      const prefs = create('{"theme":"terminal"}');

      prefs.setTheme('terminal', { x: 1, y: 2 });

      expect(transitions.calls).toBe(0);
      expect(storage.writes).toEqual([]);
    });

    it('keeps the choice until a reload when the write fails', () => {
      storage.failWrites = true;
      const prefs = create();

      prefs.setTheme('terminal');
      prefs.setAccent(75);

      expect(prefs.theme()).toBe('terminal');
      expect(root.getAttribute('data-theme')).toBe('terminal');
      expect(accentOnHtml()).toBe('75');
      expect(storage.writes).toHaveLength(2);
    });
  });

  describe('view transitions', () => {
    it('calls the transition once for one pick and applies the theme inside it', async () => {
      media.dark.set(true);
      const transitions = new FakeViewTransitions();
      transitions.install();
      const prefs = create();
      expect(root.getAttribute('data-theme')).toBe('aurora');

      prefs.setTheme('daylight', { x: 10, y: 20 });

      expect(transitions.calls).toBe(1);
      expect(root.getAttribute('data-theme')).toBe('daylight');
      expect(prefs.theme()).toBe('daylight');
      await flush();
    });

    it('grows the new theme as a circle from the origin and cleans up after the transition', async () => {
      const transitions = new FakeViewTransitions();
      transitions.install();
      const animations: { keyframes: unknown; options: unknown }[] = [];
      const animate = (keyframes: unknown, options: unknown) => {
        animations.push({ keyframes, options });
        return {} as Animation;
      };
      (root as unknown as { animate: unknown }).animate = animate;
      try {
        const prefs = create();

        prefs.setTheme('terminal', { x: 10, y: 20 });
        expect(root.classList.contains('theme-vt')).toBe(true);
        await flush();

        expect(animations).toHaveLength(1);
        const { clipPath } = animations[0].keyframes as { clipPath: string[] };
        expect(clipPath[0]).toBe('circle(0px at 10px 20px)');
        expect(clipPath[1]).toMatch(/^circle\([\d.]+px at 10px 20px\)$/);
        expect(animations[0].options).toMatchObject({
          duration: 640,
          pseudoElement: '::view-transition-new(root)',
        });

        transitions.end();
        await flush();
        expect(root.classList.contains('theme-vt')).toBe(false);
      } finally {
        delete (root as unknown as { animate?: unknown }).animate;
      }
    });

    it('swallows the rejections of a skipped transition and still applies the theme', async () => {
      const transitions = new FakeViewTransitions();
      transitions.settle = 'reject';
      transitions.install();
      const prefs = create();

      prefs.setTheme('terminal', { x: 0, y: 0 });
      transitions.end();
      await flush();

      expect(root.getAttribute('data-theme')).toBe('terminal');
      expect(root.classList.contains('theme-vt')).toBe(false);
    });

    it('switches instantly without startViewTransition', () => {
      const prefs = create();

      prefs.setTheme('terminal', { x: 10, y: 20 });

      expect(root.getAttribute('data-theme')).toBe('terminal');
      expect(root.classList.contains('theme-vt')).toBe(false);
    });

    it('skips the transition when the system asks for reduced motion', () => {
      media.reducedMotion = true;
      const transitions = new FakeViewTransitions();
      transitions.install();
      const prefs = create();

      prefs.setTheme('terminal', { x: 10, y: 20 });

      expect(transitions.calls).toBe(0);
      expect(root.getAttribute('data-theme')).toBe('terminal');
      expect(root.classList.contains('theme-vt')).toBe(false);
    });
  });
});

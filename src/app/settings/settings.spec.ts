import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MEDIA, Media } from '../core/media';
import { PREFS_KEY, PrefsService } from '../core/prefs.service';
import { AppStorage, STORAGE } from '../core/storage';
import { DEFAULT_HUES } from '../core/themes';
import { Settings } from './settings';

class MemoryStorage implements AppStorage {
  readonly values = new Map<string, unknown>();

  get<T>(key: string): T | null {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  set(key: string, value: unknown): boolean {
    this.values.set(key, structuredClone(value));
    return true;
  }

  remove(key: string): void {
    this.values.delete(key);
  }
}

class FakeMedia implements Media {
  readonly dark = signal(false);
  readonly prefersDark = this.dark.asReadonly();

  prefersReducedMotion(): boolean {
    return false;
  }
}

describe('Settings', () => {
  let storage: MemoryStorage;
  let media: FakeMedia;
  let fixture: ComponentFixture<Settings>;
  let prefs: PrefsService;
  const root = document.documentElement;

  async function render(saved?: unknown): Promise<HTMLElement> {
    if (saved !== undefined) {
      storage.values.set(PREFS_KEY, saved);
    }
    TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        { provide: STORAGE, useValue: storage },
        { provide: MEDIA, useValue: media },
      ],
    });
    prefs = TestBed.inject(PrefsService);
    fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const radios = (page: HTMLElement) =>
    Array.from(page.querySelectorAll<HTMLButtonElement>('[role=radio]'));
  const accentButtons = (page: HTMLElement) =>
    Array.from(page.querySelectorAll<HTMLButtonElement>('.swatches button'));
  const slider = (page: HTMLElement) => page.querySelector<HTMLInputElement>('input[type=range]')!;
  const pressed = (page: HTMLElement) =>
    accentButtons(page)
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent!.trim());

  beforeEach(() => {
    storage = new MemoryStorage();
    media = new FakeMedia();
    delete root.dataset['theme'];
    root.style.removeProperty('--accent-h-user');
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  });

  it('shows the eyebrow, the title and four theme options in order', async () => {
    const page = await render();

    expect(page.querySelector('.eyebrow')?.textContent?.trim()).toBe('Персоналізація');
    expect(page.querySelector('h1')?.textContent?.trim()).toBe('Налаштування');
    expect(page.querySelector('[role=radiogroup]')).not.toBeNull();
    expect(radios(page).map((radio) => radio.querySelector('strong')?.textContent)).toEqual([
      'Aurora',
      'Daylight',
      'Terminal',
      'Авто',
    ]);
    expect(page.querySelectorAll('app-theme-preview[aria-hidden=true]')).toHaveLength(4);
  });

  it('marks only the chosen theme as checked', async () => {
    const page = await render({ theme: 'daylight', accent: null });

    expect(radios(page).map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
  });

  it('marks auto as checked when nothing is saved', async () => {
    const page = await render();

    expect(radios(page).map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
      'true',
    ]);
  });

  it('picks Terminal on click and moves the check to it', async () => {
    const page = await render();

    radios(page)[2].click();
    await fixture.whenStable();

    expect(prefs.theme()).toBe('terminal');
    expect(root.getAttribute('data-theme')).toBe('terminal');
    expect(radios(page).map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ]);
    expect(storage.values.get(PREFS_KEY)).toEqual({ theme: 'terminal', accent: null });
  });

  it('passes the click point to the theme switch', async () => {
    const page = await render();
    const setTheme = vi.spyOn(prefs, 'setTheme');

    radios(page)[0].dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 37, clientY: 91 }),
    );

    expect(setTheme).toHaveBeenCalledWith('aurora', { x: 37, y: 91 });
  });

  it('has a reset and eight named accents; Смарагд sets 160 and is the only one pressed', async () => {
    const page = await render();
    const buttons = accentButtons(page);

    expect(buttons).toHaveLength(9);
    expect(buttons[0].textContent?.trim()).toBe('Колір теми');
    expect(buttons.slice(1).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Фіалковий',
      'Індиго',
      'Блакитний',
      'Смарагд',
      'Лайм',
      'Бурштин',
      'Кораловий',
      'Малиновий',
    ]);
    expect(pressed(page)).toEqual(['Колір теми']);

    buttons.find((button) => button.getAttribute('aria-label') === 'Смарагд')!.click();
    await fixture.whenStable();

    expect(prefs.accent()).toBe(160);
    expect(pressed(page)).toEqual(['Смарагд']);
    expect(slider(page).value).toBe('160');
  });

  it('returns to the theme accent with «Колір теми»', async () => {
    const page = await render({ theme: 'terminal', accent: 160 });

    accentButtons(page)[0].click();
    await fixture.whenStable();

    expect(prefs.accent()).toBeNull();
    expect(root.style.getPropertyValue('--accent-h-user')).toBe('');
    expect(pressed(page)).toEqual(['Колір теми']);
    expect(slider(page).value).toBe(String(DEFAULT_HUES.terminal));
  });

  it.each([
    ['aurora', DEFAULT_HUES.aurora],
    ['daylight', DEFAULT_HUES.daylight],
    ['terminal', DEFAULT_HUES.terminal],
  ])('puts the slider at the own hue of %s without a picked accent', async (theme, hue) => {
    const page = await render({ theme, accent: null });

    const input = slider(page);
    expect(input.getAttribute('aria-label')).toBe('Відтінок акценту');
    expect(input.min).toBe('0');
    expect(input.max).toBe('360');
    expect(input.value).toBe(String(hue));
  });

  it('follows the system theme with the slider while on auto', async () => {
    const page = await render();
    expect(slider(page).value).toBe(String(DEFAULT_HUES.daylight));

    media.dark.set(true);
    await fixture.whenStable();

    expect(slider(page).value).toBe(String(DEFAULT_HUES.aurora));
  });

  it('shows a picked accent of 0 on the slider instead of the theme hue', async () => {
    const page = await render({ theme: 'aurora', accent: 0 });

    expect(slider(page).value).toBe('0');
  });

  it('sets the accent while the slider moves', async () => {
    const page = await render();
    const input = slider(page);

    input.value = '42';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(prefs.accent()).toBe(42);
    expect(root.style.getPropertyValue('--accent-h-user')).toBe('42');
    expect(storage.values.get(PREFS_KEY)).toEqual({ theme: 'auto', accent: 42 });
    expect(pressed(page)).toEqual([]);
  });
});

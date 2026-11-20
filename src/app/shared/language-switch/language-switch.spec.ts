import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationStart, Router, provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { ApiService } from '../../core/api.service';
import { CLOCK } from '../../core/clock';
import { BROWSER_LANGUAGES, LANGUAGES, LanguageId } from '../../core/i18n/languages';
import { Catalog, Field, Test, TestRequest, TestSetup } from '../../core/models';
import { PREFS_KEY } from '../../core/prefs.service';
import { AppStorage, STORAGE } from '../../core/storage';
import { TestSessionService } from '../../core/test-session.service';

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

const FIELD: Field = {
  id: 'it',
  title: 'IT',
  levels: [{ id: 'junior', title: 'Junior', rank: 1 }],
  directions: [
    {
      id: 'backend',
      title: 'Backend',
      stacks: [{ id: 'dotnet', title: '.NET (C#)', topicIds: ['csharp'] }],
    },
  ],
  topics: [{ id: 'csharp', title: 'C#', description: '', questionCounts: { junior: 12 } }],
};

const TEST: Test = {
  questions: [
    {
      id: 'csharp-001',
      topicId: 'csharp',
      levelId: 'junior',
      type: 'single',
      text: 'What is `int`?',
      code: null,
      options: [
        { key: 1, text: 'A class', isCorrect: false },
        { key: 0, text: 'A struct', isCorrect: true },
      ],
      explanation: 'It is System.Int32.',
    },
  ],
};

const SETUP: TestSetup = {
  fieldId: 'it',
  levelIds: ['junior'],
  total: 10,
  topics: [{ topicId: 'csharp', max: 12, count: 10 }],
  timerEnabled: false,
};

class FakeApi {
  getCatalog(): Observable<Catalog> {
    return of({ fields: [FIELD] });
  }

  createTest(_request: TestRequest): Observable<Test> {
    return of(TEST);
  }
}

class RecordingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void {
    this.errors.push(error);
  }
}

describe('Language switch', () => {
  let storage: MemoryStorage;
  let errors: RecordingErrorHandler;
  let fixture: ComponentFixture<App>;
  const root = document.documentElement;

  async function open(
    url: string,
    {
      browser = ['uk'],
      languages = ['uk', 'en'],
    }: { browser?: string[]; languages?: LanguageId[] } = {},
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: ApiService, useValue: new FakeApi() },
        { provide: CLOCK, useValue: { now: () => 0, ticks: new Subject<void>() } },
        { provide: STORAGE, useValue: storage },
        { provide: BROWSER_LANGUAGES, useValue: browser },
        { provide: LANGUAGES, useValue: languages },
        { provide: ErrorHandler, useValue: errors },
      ],
    });
    fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  /** The switch is the only button of the header. */
  const headerSwitch = (page: HTMLElement) =>
    page.querySelector<HTMLButtonElement>('header button');
  const settingsRadios = (page: HTMLElement) => [
    ...page.querySelectorAll<HTMLButtonElement>('.languages [role=radio]'),
  ];

  beforeEach(() => {
    storage = new MemoryStorage();
    errors = new RecordingErrorHandler();
    root.lang = 'xx';
  });

  afterEach(() => {
    expect(errors.errors).toEqual([]);
  });

  it('names the other language in that language, with its lang', async () => {
    const page = await open('/', { browser: ['uk-UA'] });

    expect(headerSwitch(page)?.textContent?.trim()).toBe('English');
    expect(headerSwitch(page)?.getAttribute('lang')).toBe('en');
    expect(root.lang).toBe('uk');
  });

  it('a click switches the language of / at once, without a navigation, and saves it', async () => {
    const page = await open('/', { browser: ['uk-UA'] });
    const router = TestBed.inject(Router);
    const navigations: string[] = [];
    router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        navigations.push(event.url);
      }
    });
    const title = page.querySelector('h1')!;
    expect(title.textContent?.trim()).toBe('Налаштування тесту');
    expect(page.textContent).toContain('Напрям і стек');

    headerSwitch(page)!.click();
    await fixture.whenStable();

    expect(navigations).toEqual([]);
    expect(router.url).toBe('/');
    // The same element: the page was not rendered again, only its texts changed.
    expect(page.querySelector('h1')).toBe(title);
    expect(title.textContent?.trim()).toBe('Test setup');
    expect(page.textContent).toContain('Area and stack');
    expect(page.textContent).toContain('Start');
    expect(page.querySelector('header a[href="/settings"]')?.textContent?.trim()).toBe('Settings');
    expect(root.lang).toBe('en');
    expect(headerSwitch(page)?.textContent?.trim()).toBe('Українська');
    expect(headerSwitch(page)?.getAttribute('lang')).toBe('uk');
    expect(storage.values.get(PREFS_KEY)).toEqual({ theme: 'auto', accent: null, language: 'en' });

    headerSwitch(page)!.click();
    await fixture.whenStable();

    expect(title.textContent?.trim()).toBe('Налаштування тесту');
    expect(root.lang).toBe('uk');
  });

  it('is not in the header on /test, and is back after the test', async () => {
    const page = await open('/');
    const sessions = TestBed.inject(TestSessionService);

    await sessions.start(SETUP, FIELD);
    await TestBed.inject(Router).navigateByUrl('/test');
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/test');
    expect(page.querySelector('app-language-switch')).toBeNull();
    expect(headerSwitch(page)).toBeNull();
    expect(page.querySelector('header [lang]')).toBeNull();

    await sessions.finish({});
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/result');
    expect(headerSwitch(page)?.getAttribute('lang')).toBe('en');
  });

  it('/settings lists every language in its own language and applies a pick at once', async () => {
    const page = await open('/settings', { browser: ['uk'] });

    const radios = settingsRadios(page);
    expect(radios.map((radio) => [radio.textContent?.trim(), radio.getAttribute('lang')])).toEqual([
      ['Українська', 'uk'],
      ['English', 'en'],
    ]);
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(page.querySelector('h1')?.textContent?.trim()).toBe('Налаштування');

    radios[1].click();
    await fixture.whenStable();

    expect(settingsRadios(page).map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
    ]);
    expect(page.querySelector('h1')?.textContent?.trim()).toBe('Settings');
    expect(page.querySelector('#language-title')?.textContent?.trim()).toBe('Language');
    expect(root.lang).toBe('en');
    expect(storage.values.get(PREFS_KEY)).toEqual({ theme: 'auto', accent: null, language: 'en' });
  });

  it('with a single language there is no switch in the header and no language section on /settings', async () => {
    const page = await open('/settings', { browser: ['en-US'], languages: ['uk'] });

    expect(root.lang).toBe('uk');
    expect(headerSwitch(page)).toBeNull();
    expect(page.querySelector('header [lang]')).toBeNull();
    expect(page.querySelector('header a[href="/settings"]')?.textContent?.trim()).toBe(
      'Налаштування',
    );
    expect(page.querySelector('[aria-labelledby=language-title]')).toBeNull();
    expect(page.querySelector('.languages')).toBeNull();
    expect(page.querySelectorAll('[role=radio][lang]')).toHaveLength(0);
    // The rest of the page is there.
    expect(page.querySelector('h1')?.textContent?.trim()).toBe('Налаштування');
    expect(page.querySelectorAll('.themes [role=radio]')).toHaveLength(4);
  });
});

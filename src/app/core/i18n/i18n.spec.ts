import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { ApiService } from '../api.service';
import { CLOCK } from '../clock';
import { Catalog, Field, Question, Test, TestRequest, TestSetup } from '../models';
import { STORAGE } from '../storage';
import { TestSessionService } from '../test-session.service';
import { apiErrorKey } from './errors';
import { BROWSER_LANGUAGES, currentLanguage } from './languages';
import { richParts, translate, translatePlural } from './translate';

/** Any Cyrillic letter, Ukrainian or not. */
const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * Cyrillic words of the page in the text and in the attributes a user meets (screen reader, placeholder,
 * tooltip). Elements in another language (`[lang]:not([lang=en])`, a language named in itself, ADR 006) are left out.
 */
function cyrillicIn(element: HTMLElement): string[] {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[lang]:not([lang=en])').forEach((other) => other.remove());
  const found: string[] = [...((clone.textContent ?? '').match(/\S*[\u0400-\u04FF]+\S*/g) ?? [])];
  for (const node of clone.querySelectorAll('*')) {
    for (const name of ['aria-label', 'placeholder', 'title']) {
      const value = node.getAttribute(name);
      if (value && CYRILLIC.test(value)) {
        found.push(`${name}="${value}"`);
      }
    }
  }
  return found;
}

const FIELD: Field = {
  id: 'it',
  title: 'IT',
  levels: [
    { id: 'junior', title: 'Junior', rank: 1 },
    { id: 'middle', title: 'Middle', rank: 2 },
  ],
  directions: [
    {
      id: 'backend',
      title: 'Backend',
      stacks: [{ id: 'dotnet', title: '.NET (C#)', topicIds: ['csharp', 'sql', 'azure'] }],
    },
    {
      id: 'frontend',
      title: 'Frontend',
      stacks: [{ id: 'react', title: 'React', topicIds: ['javascript'] }],
    },
  ],
  topics: [
    {
      id: 'csharp',
      title: 'C#',
      description: 'The language',
      questionCounts: { junior: 4, middle: 4 },
    },
    { id: 'sql', title: 'SQL', description: 'Queries', questionCounts: { junior: 2 } },
    { id: 'azure', title: 'Azure', description: 'Cloud', questionCounts: {} },
    { id: 'javascript', title: 'JavaScript', description: '', questionCounts: { junior: 4 } },
  ],
};

const option = (key: number, isCorrect: boolean, text: string) => ({ key, text, isCorrect });

const QUESTIONS: Question[] = [
  {
    id: 'csharp-001',
    topicId: 'csharp',
    levelId: 'junior',
    type: 'single',
    text: 'What does `AsNoTracking()` do?',
    code: { lang: 'csharp', source: 'var xs = db.Users.AsNoTracking();' },
    options: [option(1, false, 'Caches the query'), option(0, true, 'Skips the change tracker')],
    explanation: 'Entities are not tracked.',
  },
  {
    id: 'sql-001',
    topicId: 'sql',
    levelId: 'middle',
    type: 'multiple',
    text: 'Which are aggregates?',
    code: null,
    options: [option(2, true, '`COUNT`'), option(0, true, '`SUM`'), option(1, false, '`LIKE`')],
    explanation: 'COUNT and SUM aggregate rows.',
  },
  {
    id: 'csharp-002',
    topicId: 'csharp',
    levelId: 'junior',
    type: 'single',
    text: 'Is `string` a reference type?',
    code: null,
    options: [option(0, true, 'Yes'), option(1, false, 'No')],
    explanation: 'It is a class.',
  },
];

const SETUP: TestSetup = {
  fieldId: 'it',
  levelIds: ['junior', 'middle'],
  total: 3,
  topics: [
    { topicId: 'csharp', max: 8, count: 2 },
    { topicId: 'sql', max: 2, count: 1 },
  ],
  timerEnabled: true,
};

class FakeApi {
  getCatalog(): Observable<Catalog> {
    return of({ fields: [FIELD, { ...FIELD, id: 'other', title: 'Other' }] });
  }

  createTest(_request: TestRequest): Observable<Test> {
    return of({ questions: QUESTIONS });
  }
}

class RecordingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void {
    this.errors.push(error);
  }
}

describe('English pages', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  let errors: RecordingErrorHandler;

  beforeEach(() => {
    errors = new RecordingErrorHandler();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: ApiService, useValue: new FakeApi() },
        { provide: CLOCK, useValue: { now: () => 0, ticks: new Subject<void>() } },
        {
          provide: STORAGE,
          useValue: { get: () => null, set: () => true, remove: () => undefined },
        },
        { provide: BROWSER_LANGUAGES, useValue: ['en-GB'] },
        { provide: ErrorHandler, useValue: errors },
      ],
    });
    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    expect(errors.errors).toEqual([]);
  });

  const page = () => fixture.nativeElement as HTMLElement;

  async function go(url: string): Promise<void> {
    await router.navigateByUrl(url);
    await fixture.whenStable();
  }

  async function click(element: HTMLElement | null | undefined): Promise<void> {
    expect(element).toBeTruthy();
    element!.click();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  const button = (label: string) =>
    [...page().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    );

  async function choose(index: number, value: string): Promise<void> {
    const select = page().querySelectorAll('select')[index];
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function type(input: HTMLInputElement, value: string): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('/ has no Cyrillic, also with the field step, a stack, the topic search, a total out of range and the hint', async () => {
    await go('/');
    expect(page().querySelector('h1')?.textContent?.trim()).toBe('Test setup');
    expect(cyrillicIn(page())).toEqual([]);

    await choose(1, 'backend');
    await choose(2, 'dotnet');
    await click(button('Add topic'));
    await type(page().querySelector<HTMLInputElement>('input[type=search]')!, 'zzz');
    await type(page().querySelector<HTMLInputElement>('input.number')!, '101');

    const text = page().textContent ?? '';
    expect(text).toContain('Nothing found.');
    expect(text).toContain('Between 10 and 100 questions.');
    expect(text).toContain('Add more topics or levels (10 questions available).');
    expect(text).toContain('0 questions');
    expect(text).toContain('max 8');
    expect(text).toContain('Timer: 101 min');
    expect(cyrillicIn(page())).toEqual([]);
  });

  it('/settings has no Cyrillic outside the language named in itself', async () => {
    await go('/settings');

    expect(page().querySelector('h1')?.textContent?.trim()).toBe('Settings');
    expect(page().querySelectorAll('[lang=uk]').length).toBeGreaterThan(0);
    expect(cyrillicIn(page())).toEqual([]);
  });

  it('/test and /result have no Cyrillic: question states, the check, the confirmation, the review', async () => {
    await go('/');
    await TestBed.inject(TestSessionService).start(SETUP, FIELD);
    await go('/test');
    expect(router.url).toBe('/test');
    expect(page().textContent).toContain('3:00 left');
    expect(cyrillicIn(page())).toEqual([]);

    // Answer and check the first question, go to the multiple one, ask to finish with unanswered questions.
    await click(page().querySelector<HTMLInputElement>('.options input'));
    await click(button('Check'));
    expect(page().querySelector('.verdict')?.textContent?.trim()).toMatch(/^(Correct|Incorrect)$/);
    await click(button('Next'));
    expect(page().textContent).toContain('Select all that apply');
    await click(button('Finish test'));
    expect(page().querySelector('[role=alertdialog]')?.textContent).toContain(
      '2 questions have no answer and will count as wrong. Finish the test?',
    );
    expect(cyrillicIn(page())).toEqual([]);

    await click(button('Finish'));
    expect(router.url).toBe('/result');
    expect(page().querySelector('h1')?.textContent?.trim()).toBe('Result');
    expect(page().textContent).toContain('Not answered');
    expect(cyrillicIn(page())).toEqual([]);

    await click(page().querySelector<HTMLInputElement>('input[type=checkbox][role=switch]'));
    expect(cyrillicIn(page())).toEqual([]);
  });
});

describe('translate', () => {
  afterEach(() => currentLanguage.set('uk'));

  it('fills parameters and leaves an unknown one as is', () => {
    currentLanguage.set('en');

    expect(translate('result.score', { correct: 7, total: 10 })).toBe('7 of 10');
    expect(translate('result.score', { correct: 7 })).toBe('7 of {total}');
  });

  it.each([
    [1, 'Від 10 до 1 питання.'],
    [2, 'Від 10 до 2 питань.'],
    [5, 'Від 10 до 5 питань.'],
    [21, 'Від 10 до 21 питання.'],
    [22, 'Від 10 до 22 питань.'],
    [100, 'Від 10 до 100 питань.'],
  ])('Ukrainian plural for %i', (n, text) => {
    currentLanguage.set('uk');

    expect(translatePlural('setup.totalRange', n, { min: 10 })).toBe(text);
  });

  it.each([
    [1, '1 question has no answer and will count as wrong. Finish the test?'],
    [2, '2 questions have no answer and will count as wrong. Finish the test?'],
    [21, '21 questions have no answer and will count as wrong. Finish the test?'],
  ])('English plural for %i', (n, text) => {
    currentLanguage.set('en');

    expect(translatePlural('test.confirm', n)).toBe(text);
  });

  it('a message without plural forms still fills {n}', () => {
    currentLanguage.set('uk');

    expect(translatePlural('test.confirm', 3)).toBe(
      'Питань без відповіді: 3. Вони зарахуються як неправильні. Завершити тест?',
    );
  });

  it('splits **bold** into parts without markup', () => {
    currentLanguage.set('en');

    expect(richParts('setup.distributed', { distributed: 7, total: 10 })).toEqual([
      { text: 'Distributed ', bold: false },
      { text: '7', bold: true },
      { text: ' of 10', bold: false },
    ]);
  });
});

describe('apiErrorKey', () => {
  it.each([
    [0, null, 'errors.network'],
    [0, 'Test.NotEnoughQuestions', 'errors.network'],
    [429, null, 'errors.tooManyRequests'],
    [400, 'Test.FieldNotFound', 'errors.catalogChanged'],
    [400, 'Test.UnknownLevel', 'errors.catalogChanged'],
    [400, 'Test.UnknownTopic', 'errors.catalogChanged'],
    [400, 'Test.NotEnoughQuestions', 'errors.catalogChanged'],
    [400, 'Test.CountTooSmall', 'errors.rejected'],
    [400, null, 'errors.rejected'],
    [500, 'Test.NotEnoughQuestions', 'errors.server'],
    [503, null, 'errors.server'],
  ] as const)('status %i, code %s → %s', (status, code, key) => {
    expect(apiErrorKey(status, code)).toBe(key);
  });
});

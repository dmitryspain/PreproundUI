import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, Observable, Subject, of, throwError } from 'rxjs';
import { routes } from '../app.routes';
import { ApiService } from '../core/api.service';
import { CLOCK } from '../core/clock';
import { ApiError, Catalog, Field, Question, Test, TestRequest, TestSetup } from '../core/models';
import { TestSessionService } from '../core/test-session.service';

/** Records every request; `/` renders Setup, so the catalog never arrives instead of hitting the network. */
class FakeApi {
  readonly requests: TestRequest[] = [];
  reply: () => Observable<Test> = () => of(TEST);

  getCatalog(): Observable<Catalog> {
    return NEVER;
  }

  createTest(request: TestRequest): Observable<Test> {
    this.requests.push(request);
    return this.reply();
  }
}

/** Time stands still until a test moves it. */
class FakeClock {
  time = Date.UTC(2026, 10, 14, 12, 0, 0);
  readonly ticks = new Subject<void>();

  now(): number {
    return this.time;
  }
}

class RecordingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void {
    this.errors.push(error);
  }
}

const option = (key: number, isCorrect: boolean) => ({ key, text: `o${key}`, isCorrect });

function question(id: string, topicId: string, levelId = 'level-a'): Question {
  return {
    id,
    topicId,
    levelId,
    type: 'single',
    text: `Текст ${id}`,
    code: null,
    options: [option(1, false), option(0, true)],
    explanation: `Пояснення ${id}`,
  };
}

// Mixed across topics, like the server returns them.
const TEST: Test = {
  questions: [
    question('a1', 'topic-a'),
    question('b1', 'topic-b', 'level-b'),
    question('a2', 'topic-a'),
    question('c1', 'topic-c'),
    question('b2', 'topic-b'),
  ],
};

const FIELD: Field = {
  id: 'f',
  title: 'F',
  levels: [
    { id: 'level-a', title: 'Рівень А', rank: 1 },
    { id: 'level-b', title: 'Рівень Б', rank: 2 },
  ],
  directions: [],
  topics: [
    { id: 'topic-a', title: 'Тема А', description: '', questionCounts: {} },
    { id: 'topic-b', title: 'Тема Б', description: '', questionCounts: {} },
    { id: 'topic-c', title: 'Тема В', description: '', questionCounts: {} },
    { id: 'topic-empty', title: 'Порожня', description: '', questionCounts: {} },
  ],
};

function setup(timerEnabled: boolean): TestSetup {
  return {
    fieldId: 'f',
    levelIds: ['level-a', 'level-b'],
    total: 5,
    topics: [
      { topicId: 'topic-c', max: 3, count: 1 },
      { topicId: 'topic-empty', max: 0, count: 0 },
      { topicId: 'topic-a', max: 3, count: 2 },
      { topicId: 'topic-b', max: 3, count: 2 },
    ],
    timerEnabled,
  };
}

describe('Result page', () => {
  let api: FakeApi;
  let clock: FakeClock;
  let errors: RecordingErrorHandler;
  let harness: RouterTestingHarness;
  let sessions: TestSessionService;

  beforeEach(async () => {
    api = new FakeApi();
    clock = new FakeClock();
    errors = new RecordingErrorHandler();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: ApiService, useValue: api },
        { provide: CLOCK, useValue: clock },
        { provide: ErrorHandler, useValue: errors },
      ],
    });
    sessions = TestBed.inject(TestSessionService);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    expect(errors.errors).toEqual([]);
  });

  const page = () => harness.routeNativeElement as HTMLElement;
  const url = () => TestBed.inject(Router).url;
  const button = (label: string) =>
    [...page().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    )!;
  const retryButton = () => button('Пройти ще раз з тими самими налаштуваннями');

  /** Lets the awaited navigation inside `finish()` / `retry()` run. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
  }

  /** Starts a test, lets `elapsedMs` pass on the fake clock and finishes it with `answers`. */
  async function finish(
    answers: Record<string, number[]>,
    elapsedMs = 42_000,
    timerEnabled = false,
  ): Promise<void> {
    api.reply = () => of(TEST);
    await sessions.start(setup(timerEnabled), FIELD);
    clock.time += elapsedMs;
    await sessions.finish(answers);
    await settle();
  }

  it('a direct visit to /result without a result redirects to /', async () => {
    await harness.navigateByUrl('/result');

    expect(url()).toBe('/');
  });

  it('/result while the test is still in progress redirects to /', async () => {
    await sessions.start(setup(false), FIELD);

    await harness.navigateByUrl('/result');

    expect(url()).toBe('/');
  });

  it('an unknown path redirects to /', async () => {
    await harness.navigateByUrl('/nope');
    expect(url()).toBe('/');

    await harness.navigateByUrl('/nope/deeper');
    expect(url()).toBe('/');
  });

  it('after finish shows the score and the topics with catalog titles, weakest first, ties in the setup order', async () => {
    // a: 2/2, b: 0/2 (one wrong, one without an answer), c: 0/1 (wrong).
    await finish({ a1: [0], a2: [0], b1: [1], c1: [1] });

    expect(url()).toBe('/result');
    expect(page().querySelector('.percent')?.textContent?.trim()).toBe('40%');
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('2 з 5');
    const rows = [...page().querySelectorAll('.topic')].map(
      (row) =>
        `${row.querySelector('.topic-title')?.textContent?.trim()}: ${row.querySelector('.topic-score')?.textContent?.trim()}`,
    );
    // b and c are both 0 %: the setup lists c before b; the inactive topic is not shown.
    expect(rows).toEqual(['Тема В: 0 / 1', 'Тема Б: 0 / 2', 'Тема А: 2 / 2']);
  });

  it('the review follows the test order with catalog titles and verdicts; "Лише помилки" keeps the wrong and the unanswered', async () => {
    await finish({ a1: [0], a2: [0], b1: [1], c1: [1] });

    const metas = () =>
      [...page().querySelectorAll('.review .meta')].map((el) => el.textContent?.trim());
    expect(metas()).toEqual([
      'Питання 1 · Тема А · Рівень А',
      'Питання 2 · Тема Б · Рівень Б',
      'Питання 3 · Тема А · Рівень А',
      'Питання 4 · Тема В · Рівень А',
      'Питання 5 · Тема Б · Рівень А',
    ]);
    expect(
      [...page().querySelectorAll('.review .verdict')].map((el) => el.textContent?.trim()),
    ).toEqual(['Правильно', 'Неправильно', 'Правильно', 'Неправильно', 'Без відповіді']);

    page().querySelector<HTMLInputElement>('input[role=switch]')!.click();
    await harness.fixture.whenStable();

    expect(metas()).toEqual([
      'Питання 2 · Тема Б · Рівень Б',
      'Питання 4 · Тема В · Рівень А',
      'Питання 5 · Тема Б · Рівень А',
    ]);
  });

  it('elapsed time with a fake CLOCK: 125 s → 2:05', async () => {
    await finish({}, 125_000);

    expect(page().querySelector('.elapsed')?.textContent?.trim()).toBe('Витрачений час: 2:05');
  });

  it('elapsed time with a fake CLOCK and the timer off: 3725 s → 1:02:05', async () => {
    await finish({}, 3_725_000, false);

    expect(page().querySelector('.elapsed')?.textContent?.trim()).toBe('Витрачений час: 1:02:05');
  });

  it('the timer running out on /test opens /result with 60 s × N spent, unanswered questions are wrong', async () => {
    api.reply = () => of(TEST);
    await sessions.start(setup(true), FIELD);
    await harness.navigateByUrl('/test');

    // The tick comes a bit late, after the deadline of 5 × 60 s.
    clock.time += 5 * 60_000 + 700;
    clock.ticks.next();
    await settle();

    expect(url()).toBe('/result');
    expect(page().querySelector('.elapsed')?.textContent?.trim()).toBe('Витрачений час: 5:00');
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('0 з 5');
    expect(
      [...page().querySelectorAll('.review .verdict')].every(
        (el) => el.textContent?.trim() === 'Без відповіді',
      ),
    ).toBe(true);
  });

  it('"Пройти ще раз" sends the same body as the first createTest and opens /test with the new test', async () => {
    await finish({ a1: [0] });
    const second: Test = { questions: [question('n1', 'topic-a'), question('n2', 'topic-b')] };
    api.reply = () => of(second);

    retryButton().click();
    await settle();

    expect(api.requests).toHaveLength(2);
    expect(api.requests[1]).toStrictEqual(api.requests[0]);
    expect(api.requests[1].excludeQuestionIds).toEqual([]);
    expect(url()).toBe('/test');
    expect(sessions.result()).toBeNull();
    expect(sessions.session()?.test).toBe(second);
    expect(page().querySelector('.position')?.textContent?.trim()).toBe('1 / 2');

    // The old result is gone, so going back to /result lands on the setup.
    await harness.navigateByUrl('/result');
    expect(url()).toBe('/');
  });

  it('a double click on "Пройти ще раз" sends a single request', async () => {
    await finish({});
    const pending = new Subject<Test>();
    api.reply = () => pending;

    retryButton().click();
    await harness.fixture.whenStable();
    expect(retryButton().disabled).toBe(true);
    retryButton().click();
    pending.next(TEST);
    pending.complete();
    await settle();

    expect(api.requests).toHaveLength(2);
    expect(url()).toBe('/test');
  });

  it('an API error on "Пройти ще раз" shows on /result, the result stays, the button works again', async () => {
    await finish({ a1: [0] });
    api.reply = () => throwError(() => new ApiError('Забагато запитів. Спробуйте за хвилину.'));

    retryButton().click();
    await settle();

    expect(url()).toBe('/result');
    expect(page().querySelector('.error[role=alert]')?.textContent?.trim()).toBe(
      'Забагато запитів. Спробуйте за хвилину.',
    );
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('1 з 5');
    expect(retryButton().disabled).toBe(false);

    api.reply = () => of(TEST);
    retryButton().click();
    await settle();
    expect(url()).toBe('/test');
  });

  it('"Нові налаштування" opens /', async () => {
    await finish({});

    const link = [...page().querySelectorAll<HTMLAnchorElement>('a')].find(
      (a) => a.textContent?.trim() === 'Нові налаштування',
    )!;
    expect(link.getAttribute('href')).toBe('/');
    link.click();
    await settle();

    expect(url()).toBe('/');
  });
});

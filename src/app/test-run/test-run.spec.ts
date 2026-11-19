import { ViewportScroller } from '@angular/common';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, Observable, Subject, of } from 'rxjs';
import { routes } from '../app.routes';
import { ApiService } from '../core/api.service';
import { CLOCK } from '../core/clock';
import { Catalog, Field, Question, Test, TestRequest, TestSetup } from '../core/models';
import { TestSessionService } from '../core/test-session.service';

/** `/` renders Setup during a redirect, so the catalog never arrives instead of hitting the network. */
class FakeApi {
  test: Test = { questions: [] };

  getCatalog(): Observable<Catalog> {
    return NEVER;
  }

  createTest(_request: TestRequest): Observable<Test> {
    return of(this.test);
  }
}

/** Time stands still until a test moves it and fires a tick by hand. */
class FakeClock {
  time = Date.UTC(2026, 10, 14, 12, 0, 0);
  readonly ticks = new Subject<void>();

  now(): number {
    return this.time;
  }

  advance(ms: number): void {
    this.time += ms;
    this.ticks.next();
  }
}

class RecordingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void {
    this.errors.push(error);
  }
}

const option = (key: number, isCorrect: boolean, text = `o${key}`) => ({ key, text, isCorrect });

/** Shuffled options: in the file the correct one is the first (key 0), on screen it must not be. */
const SINGLE: Question = {
  id: 'q-single',
  topicId: 'topic-a',
  levelId: 'level-b',
  type: 'single',
  text: 'Що робить `AsNoTracking()`? <script>alert(1)</script>',
  code: { lang: 'csharp', source: 'var xs = new List<int>();\n<b>bold</b>' },
  options: [option(2, false), option(0, true), option(1, false)],
  explanation: 'Бо `ChangeTracker` <img src=x onerror=alert(1)>',
};

const MULTIPLE: Question = {
  id: 'q-multiple',
  topicId: 'topic-b',
  levelId: 'level-a',
  type: 'multiple',
  text: 'Оберіть усі правильні',
  code: null,
  options: [option(1, false), option(0, true), option(2, true)],
  explanation: 'Пояснення 2',
};

const THIRD: Question = {
  id: 'q-third',
  topicId: 'topic-a',
  levelId: 'level-a',
  type: 'single',
  text: 'Третє',
  code: null,
  options: [option(1, true), option(0, false)],
  explanation: 'Пояснення 3',
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
  ],
};

function setup(timerEnabled: boolean): TestSetup {
  return {
    fieldId: 'f',
    levelIds: ['level-a', 'level-b'],
    total: 10,
    topics: [{ topicId: 'topic-a', max: 10, count: 10 }],
    timerEnabled,
  };
}

describe('Test page', () => {
  let api: FakeApi;
  let clock: FakeClock;
  let errors: RecordingErrorHandler;
  let harness: RouterTestingHarness;
  let sessions: TestSessionService;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    api = new FakeApi();
    api.test = { questions: [SINGLE, MULTIPLE, THIRD] };
    clock = new FakeClock();
    errors = new RecordingErrorHandler();
    consoleError = vi.spyOn(console, 'error');
    consoleWarn = vi.spyOn(console, 'warn');
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
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  async function open(timerEnabled = true): Promise<void> {
    await sessions.start(setup(timerEnabled), FIELD);
    await harness.navigateByUrl('/test');
  }

  /** Lets the awaited navigation inside `finish()` run. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
  }

  const page = () => harness.routeNativeElement as HTMLElement;
  const url = () => TestBed.inject(Router).url;
  const inputs = () => [...page().querySelectorAll<HTMLInputElement>('.options input')];
  const optionTexts = () =>
    [...page().querySelectorAll('.option-text')].map((el) => el.textContent);
  const checkedKeys = () =>
    inputs()
      .filter((input) => input.checked)
      .map((input) => Number(input.value));
  const selectedRows = () =>
    [...page().querySelectorAll('.option.selected .option-text')].map((el) => el.textContent);
  const button = (label: string) =>
    [...page().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    )!;
  const states = () =>
    [...page().querySelectorAll('.cell')].map((cell) => cell.getAttribute('data-state'));
  const timer = () => page().querySelector('.timer[role=timer]')?.textContent?.trim() ?? null;

  async function click(element: HTMLElement): Promise<void> {
    element.click();
    await harness.fixture.whenStable();
  }

  /** What a keyboard does to a box in a browser (Space, arrows): it checks the box and fires change. */
  async function pressInto(input: HTMLInputElement): Promise<void> {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.checked = !input.checked || input.type === 'radio';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await harness.fixture.whenStable();
  }

  it('a direct visit to /test without a test redirects to /', async () => {
    await harness.navigateByUrl('/test');

    expect(url()).toBe('/');
  });

  it('shows "1 / 3", the topic and level titles from the catalog and options in the API order 2, 0, 1 (not by key)', async () => {
    await open();

    expect(page().querySelector('.position')?.textContent?.trim()).toBe('1 / 3');
    expect(page().querySelector('.meta')?.textContent).toContain('Тема А');
    expect(page().querySelector('.meta')?.textContent).toContain('Рівень Б');
    expect(inputs().map((input) => Number(input.value))).toEqual([2, 0, 1]);
    expect(optionTexts()).toEqual(['o2', 'o0', 'o1']);
  });

  it('single uses radios without the hint, multiple uses checkboxes with "Кілька правильних відповідей"', async () => {
    await open();
    expect(inputs().every((input) => input.type === 'radio')).toBe(true);
    expect(page().textContent).not.toContain('Кілька правильних відповідей');

    await click(button('Далі'));

    expect(inputs().every((input) => input.type === 'checkbox')).toBe(true);
    expect(page().querySelector('legend')?.textContent).toContain('Кілька правильних відповідей');
  });

  it('every option is a label wrapping its input', async () => {
    await open();

    for (const input of inputs()) {
      expect(input.parentElement?.tagName).toBe('LABEL');
      expect(input.parentElement?.classList).toContain('option');
    }
  });

  it('a click on the option text (not the input) selects the option', async () => {
    await open();

    await click(page().querySelectorAll<HTMLElement>('.option-text')[2]);

    expect(checkedKeys()).toEqual([1]);
    expect(selectedRows()).toEqual(['o1']);
  });

  it('"Перевірити" is disabled until an option is selected', async () => {
    await open();
    expect(button('Перевірити').disabled).toBe(true);

    await click(inputs()[0]);

    expect(button('Перевірити').disabled).toBe(false);
  });

  it('without "Перевірити" the answer can change by click and by keyboard, also after leaving the question', async () => {
    await open();

    await click(inputs()[0]);
    await click(page().querySelectorAll<HTMLElement>('.option-text')[1]);
    expect(checkedKeys()).toEqual([0]);
    await pressInto(inputs()[2]);
    expect(checkedKeys()).toEqual([1]);

    await click(button('Далі'));
    await click(inputs()[0]);
    await click(inputs()[2]);
    await click(inputs()[0]);
    expect(checkedKeys()).toEqual([2]);
    await click(button('Назад'));
    await click(inputs()[1]);

    expect(checkedKeys()).toEqual([0]);
  });

  it('after "Перевірити" neither a click nor the keyboard changes the answer, and the inputs are disabled', async () => {
    await open();
    await click(inputs()[0]); // key 2, wrong
    await click(button('Перевірити'));

    expect(inputs().every((input) => input.disabled)).toBe(true);
    inputs()[1].focus();
    expect(document.activeElement).not.toBe(inputs()[1]);

    await click(inputs()[1]);
    await click(page().querySelectorAll<HTMLElement>('.option-text')[2]);
    await pressInto(inputs()[1]);
    await pressInto(inputs()[2]);
    expect(checkedKeys()).toEqual([2]);
    expect(selectedRows()).toEqual(['o2']);

    // Still locked after going away and back.
    await click(button('Далі'));
    await click(button('Назад'));
    await pressInto(inputs()[1]);
    expect(checkedKeys()).toEqual([2]);
    expect(button('Перевірити').disabled).toBe(true);
  });

  it('after "Перевірити" a multiple answer cannot be unchecked or extended', async () => {
    await open();
    await click(button('Далі'));
    await click(inputs()[1]); // key 0
    await click(button('Перевірити'));

    await pressInto(inputs()[1]);
    await pressInto(inputs()[2]);

    expect(checkedKeys()).toEqual([0]);
    expect(page().querySelector('.verdict')?.textContent?.trim()).toBe('Неправильно');
  });

  it('"Перевірити" shows the verdict, marks the correct options and the wrong pick, and shows the explanation', async () => {
    await open();
    expect(page().querySelector('.verdict')).toBeNull();
    expect(page().querySelector('.explanation')).toBeNull();

    await click(inputs()[0]); // key 2, wrong
    await click(button('Перевірити'));

    expect(page().querySelector('.verdict')?.textContent?.trim()).toBe('Неправильно');
    expect(
      [...page().querySelectorAll('.option.correct .option-text')].map((el) => el.textContent),
    ).toEqual(['o0']);
    expect(
      [...page().querySelectorAll('.option.wrong .option-text')].map((el) => el.textContent),
    ).toEqual(['o2']);
    expect(page().querySelector('.option.correct')?.textContent).toContain('правильна');
    expect(page().querySelector('.explanation')?.textContent).toContain('ChangeTracker');

    await click(button('Далі'));
    await click(inputs()[1]);
    await click(inputs()[2]);
    await click(button('Перевірити'));
    expect(page().querySelector('.verdict')?.textContent?.trim()).toBe('Правильно');
    expect(page().querySelectorAll('.option.wrong')).toHaveLength(0);
  });

  it('the number grid shows unanswered, answered, checked right and checked wrong, and marks the current question', async () => {
    await open();
    expect(states()).toEqual(['unanswered', 'unanswered', 'unanswered']);

    await click(inputs()[1]); // key 0, right
    expect(states()).toEqual(['answered', 'unanswered', 'unanswered']);
    await click(button('Перевірити'));
    expect(states()).toEqual(['correct', 'unanswered', 'unanswered']);

    await click(page().querySelectorAll<HTMLButtonElement>('.cell')[2]);
    expect(page().querySelector('.position')?.textContent?.trim()).toBe('3 / 3');
    expect(page().querySelectorAll('.cell')[2].getAttribute('aria-current')).toBe('step');
    expect(page().querySelectorAll('[aria-current]')).toHaveLength(1);
    await click(inputs()[1]); // key 0, wrong
    await click(button('Перевірити'));

    expect(states()).toEqual(['correct', 'unanswered', 'incorrect']);

    // Unchecking the only box of an unchecked multiple answer makes it unanswered again.
    await click(page().querySelectorAll<HTMLButtonElement>('.cell')[1]);
    await click(inputs()[0]);
    expect(states()[1]).toBe('answered');
    await click(inputs()[0]);
    expect(states()[1]).toBe('unanswered');
  });

  it('"Завершити тест" with unanswered questions asks in the page (not confirm()) with their count; "Продовжити тест" goes back', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    await open();
    await click(inputs()[0]);

    await click(button('Завершити тест'));

    const dialog = page().querySelector('.confirm[role=alertdialog]');
    expect(dialog?.textContent).toContain('Питань без відповіді: 2');
    expect(confirm).not.toHaveBeenCalled();
    expect(sessions.result()).toBeNull();

    await click(button('Продовжити тест'));
    expect(page().querySelector('.confirm')).toBeNull();
    expect(url()).toBe('/test');

    await click(button('Завершити тест'));
    await click(button('Завершити'));
    await settle();

    expect(sessions.result()?.answers).toEqual({ 'q-single': [2] });
    expect(url()).toBe('/result');
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('"Завершити тест" with every question answered finishes at once and passes the answers to finish()', async () => {
    await open(false);
    await click(inputs()[1]);
    await click(button('Далі'));
    await click(inputs()[1]);
    await click(inputs()[2]);
    await click(button('Далі'));
    await click(inputs()[1]);

    await click(button('Завершити тест'));
    await settle();

    expect(page().querySelector('.confirm')).toBeNull();
    expect(sessions.result()?.answers).toEqual({
      'q-single': [0],
      'q-multiple': [0, 2],
      'q-third': [0],
    });
    expect(sessions.result()?.score).toEqual({ correct: 2, total: 3, percent: 67 });
    expect(url()).toBe('/result');
  });

  it('timer with a fake CLOCK: 3 questions start from 3:00, count down, and finish the test at 0', async () => {
    const t0 = clock.time;
    await open(true);
    expect(timer()).toBe('Залишилось 3:00');

    clock.advance(1000);
    await harness.fixture.whenStable();
    expect(timer()).toBe('Залишилось 2:59');

    await click(inputs()[1]);
    clock.advance(178_000);
    await harness.fixture.whenStable();
    expect(timer()).toBe('Залишилось 0:01');
    expect(sessions.result()).toBeNull();

    clock.time = t0 + 180_400;
    clock.ticks.next();
    await settle();

    expect(sessions.result()?.answers).toEqual({ 'q-single': [0] });
    expect(sessions.result()?.elapsedMs).toBe(180_000);
    expect(url()).toBe('/result');
  });

  it('the timer pill turns .neg only under 60 s left', async () => {
    await open(true);
    const pill = () => page().querySelector('.timer[role=timer]')!;
    expect(pill().classList.contains('neg')).toBe(false);

    clock.advance(120_000);
    await harness.fixture.whenStable();
    expect(timer()).toBe('Залишилось 1:00');
    expect(pill().classList.contains('neg')).toBe(false);

    clock.advance(1000);
    await harness.fixture.whenStable();
    expect(timer()).toBe('Залишилось 0:59');
    expect(pill().classList.contains('neg')).toBe(true);
  });

  it('the progress bar in the top strip fills by the share of questions with an answer, checked or not', async () => {
    await open(true);
    const fill = () => page().querySelector<HTMLElement>('.bar .progress-fill')!.style.width;
    expect(fill()).toBe('0%');

    await click(inputs()[0]);
    expect(fill()).toMatch(/^33\.33/);

    await click(button('Перевірити'));
    await click(button('Далі'));
    await click(inputs()[0]);
    expect(fill()).toMatch(/^66\.66/);

    // Unchecking the only box of a multiple answer leaves the question without an answer again.
    await click(inputs()[0]);
    expect(fill()).toMatch(/^33\.33/);
  });

  it('the timer shows H:MM:SS from an hour on (100 questions → 1:40:00)', async () => {
    api.test = {
      questions: Array.from({ length: 100 }, (_, i) => ({ ...THIRD, id: `q${i}` })),
    };
    await open(true);

    expect(timer()).toBe('Залишилось 1:40:00');
  });

  it('with the timer off there is no countdown and no finish by time, but the elapsed time is counted', async () => {
    const finish = vi.spyOn(sessions, 'finish');
    await open(false);

    expect(page().querySelector('.timer')).toBeNull();
    clock.advance(3 * 60_000);
    clock.advance(10 * 3600_000);
    await settle();
    expect(page().querySelector('.timer')).toBeNull();
    expect(finish).not.toHaveBeenCalled();
    expect(url()).toBe('/test');

    await click(button('Завершити тест'));
    await click(button('Завершити'));
    await settle();

    expect(finish).toHaveBeenCalledTimes(1);
    expect(sessions.result()?.elapsedMs).toBe(3 * 60_000 + 10 * 3600_000);
  });

  it('after the test is finished /test redirects to /', async () => {
    await open(false);
    await click(button('Завершити тест'));
    await click(button('Завершити'));
    await settle();

    await harness.navigateByUrl('/test');

    expect(url()).toBe('/');
  });

  it('content text is escaped: <script> and <img> stay text, backticks become <code>, the code block is <pre><code> text', async () => {
    await open();

    const text = page().querySelector('.text')!;
    expect(text.querySelector('script')).toBeNull();
    expect(text.textContent).toBe('Що робить AsNoTracking()? <script>alert(1)</script>');
    expect(text.querySelector('code')?.textContent).toBe('AsNoTracking()');

    const block = page().querySelector('pre.code > code')!;
    expect(block.textContent).toBe('var xs = new List<int>();\n<b>bold</b>');
    expect(block.children).toHaveLength(0);

    await click(inputs()[0]);
    await click(button('Перевірити'));
    const explanation = page().querySelector('.explanation')!;
    expect(explanation.querySelector('img')).toBeNull();
    expect(explanation.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(explanation.querySelector('code')?.textContent).toBe('ChangeTracker');
  });

  it('beforeunload asks while the test is in progress', async () => {
    await open();

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

/** Pretends the page is scrolled down, so a move to the top can be seen. */
class FakeViewport {
  position: [number, number] = [0, 500];
  readonly moves: [number, number][] = [];

  getScrollPosition(): [number, number] {
    return this.position;
  }

  scrollToPosition(position: [number, number]): void {
    this.moves.push(position);
    this.position = position;
  }

  setOffset(): void {}
  scrollToAnchor(): void {}
  setHistoryScrollRestoration(): void {}
}

describe('Test page scrolling', () => {
  let viewport: FakeViewport;
  let harness: RouterTestingHarness;
  let sessions: TestSessionService;

  beforeEach(async () => {
    const api = new FakeApi();
    api.test = { questions: [SINGLE, MULTIPLE, THIRD] };
    viewport = new FakeViewport();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: ApiService, useValue: api },
        { provide: CLOCK, useValue: new FakeClock() },
        { provide: ViewportScroller, useValue: viewport },
      ],
    });
    sessions = TestBed.inject(TestSessionService);
    harness = await RouterTestingHarness.create();
    await sessions.start(setup(false), FIELD);
    await harness.navigateByUrl('/test');
  });

  const page = () => harness.routeNativeElement as HTMLElement;
  const button = (label: string) =>
    [...page().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    )!;
  const position = () => page().querySelector('.position')?.textContent?.trim();

  async function click(element: HTMLElement): Promise<void> {
    element.click();
    await harness.fixture.whenStable();
  }

  it('"Далі", "Назад" and a click on a grid cell scroll a scrolled page to the top', async () => {
    expect(viewport.moves).toEqual([]);

    await click(button('Далі'));
    expect(position()).toBe('2 / 3');
    expect(viewport.moves).toEqual([[0, 0]]);

    viewport.position = [0, 800];
    await click(button('Назад'));
    expect(position()).toBe('1 / 3');
    expect(viewport.moves).toEqual([
      [0, 0],
      [0, 0],
    ]);

    viewport.position = [0, 300];
    await click(page().querySelectorAll<HTMLButtonElement>('.cell')[2]);
    expect(position()).toBe('3 / 3');
    expect(viewport.moves).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
  });

  it('a page already at the top is not scrolled, and choosing an option does not scroll', async () => {
    viewport.position = [0, 0];
    await click(button('Далі'));
    expect(viewport.moves).toEqual([]);

    viewport.position = [0, 400];
    await click(page().querySelectorAll<HTMLInputElement>('.options input')[0]);
    expect(viewport.moves).toEqual([]);
  });
});

import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { CLOCK } from './clock';
import { ApiError, Field, Question, Test, TestRequest, TestSetup } from './models';
import { TestSessionService } from './test-session.service';

/** Records every request; each call gets a fresh observable from `reply`. */
class FakeApi {
  readonly requests: TestRequest[] = [];
  reply: () => Observable<Test> = () => of(TEST);

  createTest(request: TestRequest): Observable<Test> {
    this.requests.push(request);
    return this.reply();
  }
}

const TEST: Test = { questions: [] };
const FIELD: Field = { id: 'it', title: 'IT', levels: [], directions: [], topics: [] };
const SETUP: TestSetup = {
  fieldId: 'it',
  levelIds: ['middle', 'senior'],
  total: 20,
  topics: [
    { topicId: 'a', max: 12, count: 10 },
    { topicId: 'empty', max: 0, count: 0 },
    { topicId: 'b', max: 12, count: 10 },
  ],
  timerEnabled: false,
};

describe('TestSessionService.start', () => {
  let api: FakeApi;
  let service: TestSessionService;

  beforeEach(() => {
    api = new FakeApi();
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    service = TestBed.inject(TestSessionService);
  });

  it('sends only the active topics with their counts and an empty excludeQuestionIds', async () => {
    await service.start(SETUP, FIELD);

    expect(api.requests).toStrictEqual([
      {
        fieldId: 'it',
        levelIds: ['middle', 'senior'],
        topics: [
          { topicId: 'a', count: 10 },
          { topicId: 'b', count: 10 },
        ],
        excludeQuestionIds: [],
      },
    ]);
    expect(service.session()).toEqual({ field: FIELD, setup: SETUP, test: TEST });
  });

  it('keeps the previous session and rejects with the ApiError when the request fails', async () => {
    await service.start(SETUP, FIELD);
    const previous = service.session();
    api.reply = () => throwError(() => new ApiError('Забагато запитів. Спробуйте за хвилину.'));

    await expect(service.start({ ...SETUP, total: 30 }, FIELD)).rejects.toEqual(
      new ApiError('Забагато запитів. Спробуйте за хвилину.'),
    );
    expect(service.session()).toBe(previous);
  });
});

describe('TestSessionService.finish', () => {
  let api: FakeApi;
  let service: TestSessionService;
  let now: number;

  const T0 = Date.UTC(2026, 10, 14, 12, 0, 0);
  const option = (key: number, isCorrect: boolean) => ({ key, text: `o${key}`, isCorrect });
  const QUESTIONS: Question[] = [
    {
      id: 'q1',
      topicId: 'a',
      levelId: 'l',
      type: 'single',
      text: '',
      code: null,
      explanation: '',
      options: [option(1, false), option(0, true)],
    },
    {
      id: 'q2',
      topicId: 'b',
      levelId: 'l',
      type: 'multiple',
      text: '',
      code: null,
      explanation: '',
      options: [option(2, true), option(0, true), option(1, false)],
    },
    {
      id: 'q3',
      topicId: 'a',
      levelId: 'l',
      type: 'single',
      text: '',
      code: null,
      explanation: '',
      options: [option(0, true), option(1, false)],
    },
  ];

  beforeEach(() => {
    api = new FakeApi();
    api.reply = () => of({ questions: QUESTIONS });
    now = T0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'result', children: [] },
        ]),
        { provide: ApiService, useValue: api },
        { provide: CLOCK, useValue: { now: () => now, ticks: new Subject<void>() } },
      ],
    });
    service = TestBed.inject(TestSessionService);
  });

  it('with the timer off has no deadline and still counts the elapsed time, without a cap', async () => {
    await service.start({ ...SETUP, timerEnabled: false }, FIELD);
    expect(service.deadline()).toBeNull();

    now = T0 + 5 * 3600_000 + 1234;
    await service.finish({});

    expect(service.result()?.elapsedMs).toBe(5 * 3600_000 + 1234);
  });

  it('with the timer on the deadline is 60 s per question from the moment the test came, and elapsed time is capped by it', async () => {
    await service.start({ ...SETUP, timerEnabled: true }, FIELD);
    expect(service.deadline()).toBe(T0 + 3 * 60_000);

    now = T0 + 3 * 60_000 + 900;
    await service.finish({});

    expect(service.result()?.elapsedMs).toBe(180_000);
  });

  it('grades every question, keeps only the answered questions of this test, scores and opens /result', async () => {
    await service.start(SETUP, FIELD);
    expect(service.inProgress()).toBe(true);
    now = T0 + 42_000;

    await service.finish({ q1: [0], q2: [2], q3: [], other: [1] });

    expect(service.result()).toEqual({
      answers: { q1: [0], q2: [2] },
      grades: { q1: true, q2: false, q3: false },
      score: { correct: 1, total: 3, percent: 33 },
      elapsedMs: 42_000,
    });
    expect(service.inProgress()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/result');
  });

  it('a second finish (timer and button together) changes nothing', async () => {
    await service.start(SETUP, FIELD);
    await service.finish({ q1: [0] });
    const first = service.result();

    now = T0 + 99_000;
    await service.finish({ q1: [1], q2: [2, 0], q3: [0] });

    expect(service.result()).toBe(first);
  });

  it('does nothing before a test was created', async () => {
    await service.finish({ q1: [0] });

    expect(service.result()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('a new start after finish clears the result and restarts the clock', async () => {
    await service.start({ ...SETUP, timerEnabled: true }, FIELD);
    await service.finish({});

    now = T0 + 600_000;
    await service.start({ ...SETUP, timerEnabled: true }, FIELD);

    expect(service.result()).toBeNull();
    expect(service.inProgress()).toBe(true);
    expect(service.deadline()).toBe(T0 + 600_000 + 180_000);
  });
});

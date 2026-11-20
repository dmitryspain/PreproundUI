import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiService, errorText } from './api.service';
import { API_BASE_URL } from './config';
import { BROWSER_LANGUAGES, LanguageId } from './i18n/languages';
import { ApiError } from './models';
import { AppStorage, STORAGE } from './storage';

/** Keeps `setLanguage` and the prefs away from the real localStorage. */
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

describe('ApiService.health', () => {
  const baseUrl = 'https://api.test/api';
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: baseUrl }],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('calls GET {API_BASE_URL}/health and reports ok as available', async () => {
    const status = firstValueFrom(api.health());

    const request = http.expectOne(`${baseUrl}/health`);
    expect(request.request.method).toBe('GET');
    request.flush({ status: 'ok' });

    expect(await status).toBe('available');
  });

  it('reports an unexpected body as unavailable', async () => {
    const status = firstValueFrom(api.health());

    http.expectOne(`${baseUrl}/health`).flush({ status: 'degraded' });

    expect(await status).toBe('unavailable');
  });

  it('reports an error status as unavailable instead of erroring', async () => {
    const status = firstValueFrom(api.health());

    http.expectOne(`${baseUrl}/health`).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(await status).toBe('unavailable');
  });

  it('reports no answer at all (API down, CORS, untrusted certificate) as unavailable', async () => {
    const status = firstValueFrom(api.health());

    http.expectOne(`${baseUrl}/health`).error(new ProgressEvent('error'));

    expect(await status).toBe('unavailable');
  });
});

describe('ApiService.getCatalog and createTest', () => {
  const baseUrl = 'https://api.test/api';
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: baseUrl },
        { provide: STORAGE, useValue: new MemoryStorage() },
        // The text checked below is Ukrainian, and jsdom prefers en-US.
        { provide: BROWSER_LANGUAGES, useValue: ['uk'] },
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps GET {API_BASE_URL}/catalog to the model, keeping the server order of topics', async () => {
    const catalog = firstValueFrom(api.getCatalog());

    const request = http.expectOne(`${baseUrl}/catalog`);
    expect(request.request.method).toBe('GET');
    request.flush({
      fields: [
        {
          id: 'it',
          title: 'IT',
          levels: [{ id: 'junior', title: 'Junior', rank: 1 }],
          directions: [
            { id: 'backend', title: 'Backend', stacks: [{ id: 'dotnet', title: '.NET (C#)', topicIds: ['zeta', 'alpha'] }] },
          ],
          topics: [
            { id: 'zeta', title: 'Zeta', description: 'Z', questionCounts: { junior: 4 } },
            { id: 'alpha', title: 'Alpha', description: null, questionCounts: null },
          ],
        },
      ],
    });

    expect(await catalog).toEqual({
      fields: [
        {
          id: 'it',
          title: 'IT',
          levels: [{ id: 'junior', title: 'Junior', rank: 1 }],
          directions: [
            { id: 'backend', title: 'Backend', stacks: [{ id: 'dotnet', title: '.NET (C#)', topicIds: ['zeta', 'alpha'] }] },
          ],
          topics: [
            { id: 'zeta', title: 'Zeta', description: 'Z', questionCounts: { junior: 4 } },
            { id: 'alpha', title: 'Alpha', description: '', questionCounts: {} },
          ],
        },
      ],
    });
  });

  it('posts exactly the spec 5.2 body to {API_BASE_URL}/tests and maps the questions', async () => {
    const test = firstValueFrom(
      api.createTest({
        fieldId: 'it',
        levelIds: ['middle', 'senior'],
        topics: [{ topicId: 'ef-core', count: 10 }],
        excludeQuestionIds: [],
      }),
    );

    const request = http.expectOne(`${baseUrl}/tests`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toStrictEqual({
      fieldId: 'it',
      levelIds: ['middle', 'senior'],
      topics: [{ topicId: 'ef-core', count: 10 }],
      excludeQuestionIds: [],
    });
    request.flush({
      questions: [
        {
          id: 'ef-core-007',
          topicId: 'ef-core',
          levelId: 'middle',
          type: 'multiple',
          text: 'Q',
          code: null,
          options: [{ key: 2, text: 'A', isCorrect: true }],
          explanation: 'E',
        },
      ],
    });

    expect(await test).toEqual({
      questions: [
        {
          id: 'ef-core-007',
          topicId: 'ef-core',
          levelId: 'middle',
          type: 'multiple',
          text: 'Q',
          code: null,
          options: [{ key: 2, text: 'A', isCorrect: true }],
          explanation: 'E',
        },
      ],
    });
  });

  it('reports a 200 body that breaks the contract with the general text, not a TypeError', async () => {
    const result = firstValueFrom(api.getCatalog());
    http.expectOne(`${baseUrl}/catalog`).flush({ unexpected: true });

    await expect(result).rejects.toEqual(new ApiError('Сервер не зміг обробити запит. Спробуйте пізніше.'));
  });
});

/** The texts the user sees, per language: worded by status and `code`, never by the server's `message` (ADR 006). */
const TEXTS: Record<LanguageId, Record<'catalogChanged' | 'rejected' | 'tooManyRequests' | 'network' | 'server', string>> = {
  uk: {
    catalogChanged: 'Каталог оновився. Оновіть сторінку й перевірте розподіл.',
    rejected: 'Сервер відхилив налаштування тесту.',
    tooManyRequests: 'Забагато запитів. Спробуйте за хвилину.',
    network: "Не вдалося зв'язатися із сервером.",
    server: 'Сервер не зміг обробити запит. Спробуйте пізніше.',
  },
  en: {
    catalogChanged: 'The catalog has been updated. Reload the page and check the distribution.',
    rejected: 'The server rejected the test settings.',
    tooManyRequests: 'Too many requests. Try again in a minute.',
    network: 'Could not reach the server.',
    server: 'The server could not process the request. Try again later.',
  },
};

/** A `message` no case may show: the interface words every error itself. */
const BODY_MESSAGE = 'У темі немає стільки питань (server message)';

const badRequest = { status: 400, statusText: 'Bad Request' };

const failures: [name: string, fail: (request: TestRequest) => void, text: keyof (typeof TEXTS)['uk']][] = [
  ['400 Test.NotEnoughQuestions', (r) => r.flush({ code: 'Test.NotEnoughQuestions', message: BODY_MESSAGE }, badRequest), 'catalogChanged'],
  ['400 Test.FieldNotFound', (r) => r.flush({ code: 'Test.FieldNotFound', message: BODY_MESSAGE }, badRequest), 'catalogChanged'],
  ['400 Test.UnknownLevel', (r) => r.flush({ code: 'Test.UnknownLevel', message: BODY_MESSAGE }, badRequest), 'catalogChanged'],
  ['400 Test.UnknownTopic', (r) => r.flush({ code: 'Test.UnknownTopic', message: BODY_MESSAGE }, badRequest), 'catalogChanged'],
  ['400 Test.CountTooSmall', (r) => r.flush({ code: 'Test.CountTooSmall', message: BODY_MESSAGE }, badRequest), 'rejected'],
  ['400 with a code in another case', (r) => r.flush({ code: 'test.notenoughquestions', message: BODY_MESSAGE }, badRequest), 'rejected'],
  [
    '400 ProblemDetails without message',
    (r) => r.flush({ type: 'about:blank', title: 'One or more validation errors occurred.', status: 400 }, badRequest),
    'rejected',
  ],
  ['400 with an empty body', (r) => r.flush(null, badRequest), 'rejected'],
  ['429', (r) => r.flush({ code: 'Test.NotEnoughQuestions', message: BODY_MESSAGE }, { status: 429, statusText: 'Too Many Requests' }), 'tooManyRequests'],
  ['500 with a catalog code', (r) => r.flush({ code: 'Test.NotEnoughQuestions', message: BODY_MESSAGE }, { status: 500, statusText: 'Server Error' }), 'server'],
  ['404', (r) => r.flush({ message: BODY_MESSAGE }, { status: 404, statusText: 'Not Found' }), 'server'],
  ['no answer (status 0)', (r) => r.error(new ProgressEvent('error')), 'network'],
];

for (const language of ['uk', 'en'] as const) {
  describe(`ApiService errors in ${language}`, () => {
    const baseUrl = 'https://api.test/api';
    let api: ApiService;
    let http: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: API_BASE_URL, useValue: baseUrl },
          { provide: STORAGE, useValue: new MemoryStorage() },
          { provide: BROWSER_LANGUAGES, useValue: [language] },
        ],
      });
      api = TestBed.inject(ApiService);
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    async function failure(result: Promise<unknown>): Promise<ApiError> {
      try {
        await result;
      } catch (error) {
        return error as ApiError;
      }
      throw new Error('expected the request to fail');
    }

    for (const [name, fail, text] of failures) {
      it(`getCatalog: ${name} → errors.${text}`, async () => {
        const result = firstValueFrom(api.getCatalog());
        fail(http.expectOne(`${baseUrl}/catalog`));

        const error = await failure(result);
        expect(error).toBeInstanceOf(ApiError);
        expect(error.message).toBe(TEXTS[language][text]);
        expect(error.message).not.toContain(BODY_MESSAGE);
      });

      it(`createTest: ${name} → errors.${text}`, async () => {
        const result = firstValueFrom(
          api.createTest({ fieldId: 'it', levelIds: ['l'], topics: [{ topicId: 't', count: 10 }], excludeQuestionIds: [] }),
        );
        fail(http.expectOne(`${baseUrl}/tests`));

        const error = await failure(result);
        expect(error).toBeInstanceOf(ApiError);
        expect(error.message).toBe(TEXTS[language][text]);
        expect(error.message).not.toContain(BODY_MESSAGE);
      });
    }

    it('a 200 body that breaks the contract gives errors.server, not a TypeError', async () => {
      const result = firstValueFrom(api.getCatalog());
      http.expectOne(`${baseUrl}/catalog`).flush({ unexpected: true });

      await expect(result).rejects.toEqual(new ApiError(TEXTS[language].server));
    });

    it('errorText keeps an ApiError and words anything else as errors.server', () => {
      expect(errorText(new ApiError('kept as is'))).toBe('kept as is');
      expect(errorText(new TypeError('x is undefined'))).toBe(TEXTS[language].server);
      expect(errorText(undefined)).toBe(TEXTS[language].server);
    });
  });
}

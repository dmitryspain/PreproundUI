import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { API_BASE_URL } from './config';
import { ApiError } from './models';

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
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: baseUrl }],
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

  const failures: [name: string, fail: (request: TestRequest) => void, text: string][] = [
    [
      '400 {code, message} → the message',
      (r) => r.flush({ code: 'Test.NotEnoughQuestions', message: 'У темі немає стільки питань.' }, { status: 400, statusText: 'Bad Request' }),
      'У темі немає стільки питань.',
    ],
    [
      '400 ProblemDetails without message → the general text',
      (r) => r.flush({ type: 'about:blank', title: 'One or more validation errors occurred.', status: 400 }, { status: 400, statusText: 'Bad Request' }),
      'Сервер не зміг обробити запит. Спробуйте пізніше.',
    ],
    [
      '400 with an empty message → the general text',
      (r) => r.flush({ code: 'X.Y', message: '  ' }, { status: 400, statusText: 'Bad Request' }),
      'Сервер не зміг обробити запит. Спробуйте пізніше.',
    ],
    [
      '500 → the general text',
      (r) => r.flush({ message: 'Npgsql exploded' }, { status: 500, statusText: 'Server Error' }),
      'Сервер не зміг обробити запит. Спробуйте пізніше.',
    ],
    [
      '429 → too many requests',
      (r) => r.flush(null, { status: 429, statusText: 'Too Many Requests' }),
      'Забагато запитів. Спробуйте за хвилину.',
    ],
    [
      'no answer (status 0) → cannot reach the server',
      (r) => r.error(new ProgressEvent('error')),
      "Не вдалося зв'язатися із сервером.",
    ],
  ];

  for (const [name, fail, text] of failures) {
    it(`getCatalog: ${name}`, async () => {
      const result = firstValueFrom(api.getCatalog());
      fail(http.expectOne(`${baseUrl}/catalog`));

      await expect(result).rejects.toEqual(new ApiError(text));
      await expect(result).rejects.toBeInstanceOf(ApiError);
    });

    it(`createTest: ${name}`, async () => {
      const result = firstValueFrom(
        api.createTest({ fieldId: 'it', levelIds: ['l'], topics: [{ topicId: 't', count: 10 }], excludeQuestionIds: [] }),
      );
      fail(http.expectOne(`${baseUrl}/tests`));

      await expect(result).rejects.toEqual(new ApiError(text));
    });
  }

  it('reports a 200 body that breaks the contract with the general text, not a TypeError', async () => {
    const result = firstValueFrom(api.getCatalog());
    http.expectOne(`${baseUrl}/catalog`).flush({ unexpected: true });

    await expect(result).rejects.toEqual(new ApiError('Сервер не зміг обробити запит. Спробуйте пізніше.'));
  });
});

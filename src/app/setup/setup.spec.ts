import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER, Observable, Subject, of, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { API_BASE_URL } from '../core/config';
import { ApiError, Catalog, Field, Test, TestRequest, Topic } from '../core/models';
import { TestSessionService } from '../core/test-session.service';
import { Setup } from './setup';

@Component({ template: '' })
class StubTestPage {}

/** Every call gets a fresh observable: a Subject that already errored would fail the next subscription at once. */
class FakeApi {
  catalog: () => Observable<Catalog> = () => of(seedCatalog());
  readonly requests: TestRequest[] = [];
  reply: () => Observable<Test> = () => of(TEST);

  getCatalog(): Observable<Catalog> {
    return this.catalog();
  }

  createTest(request: TestRequest): Observable<Test> {
    this.requests.push(request);
    return this.reply();
  }
}

class RecordingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void {
    this.errors.push(error);
  }
}

const TEST: Test = { questions: [] };
const FULL = { junior: 4, middle: 4, senior: 4 };

// Mirrors the seed: the .NET stack has 10 topics, and only csharp, ef-core and sql have questions.
const DOTNET = ['csharp', 'dotnet-clr', 'dotnet-async', 'aspnet-core', 'ef-core', 'sql', 'architecture', 'messaging', 'azure', 'docker-k8s'];
const REACT = ['javascript', 'typescript', 'html-css', 'react-core', 'react-hooks', 'react-state', 'nextjs', 'react-data-routing', 'frontend-testing', 'web-performance'];
const WITH_QUESTIONS = new Set(['csharp', 'ef-core', 'sql']);

function topic(id: string, questionCounts: Record<string, number> = {}): Topic {
  return { id, title: `T ${id}`, description: '', questionCounts };
}

function seedField(): Field {
  return {
    id: 'it',
    title: 'IT',
    levels: [
      { id: 'junior', title: 'Junior', rank: 1 },
      { id: 'middle', title: 'Middle', rank: 2 },
      { id: 'senior', title: 'Senior', rank: 3 },
    ],
    directions: [
      { id: 'backend', title: 'Backend', stacks: [{ id: 'dotnet', title: '.NET (C#)', topicIds: DOTNET }] },
      { id: 'frontend', title: 'Frontend', stacks: [{ id: 'react', title: 'React', topicIds: REACT }] },
    ],
    topics: [...DOTNET, ...REACT].map((id) => topic(id, WITH_QUESTIONS.has(id) ? FULL : {})),
  };
}

function seedCatalog(): Catalog {
  return { fields: [seedField()] };
}

describe('Setup page', () => {
  let api: FakeApi;
  let errors: RecordingErrorHandler;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    api = new FakeApi();
    errors = new RecordingErrorHandler();
    consoleError = vi.spyOn(console, 'error');
    TestBed.configureTestingModule({
      imports: [Setup],
      providers: [
        provideRouter([
          { path: '', component: Setup },
          { path: 'test', component: StubTestPage },
        ]),
        { provide: ApiService, useValue: api },
        { provide: ErrorHandler, useValue: errors },
      ],
    });
  });

  afterEach(() => {
    expect(errors.errors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  async function render(): Promise<ComponentFixture<Setup>> {
    const fixture = TestBed.createComponent(Setup);
    await fixture.whenStable();
    return fixture;
  }

  /** Lets the awaits inside `start()` (request, then navigation) run before checking. */
  async function settle(fixture: ComponentFixture<Setup>): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  const root = (fixture: ComponentFixture<Setup>) => fixture.nativeElement as HTMLElement;
  const text = (fixture: ComponentFixture<Setup>) => root(fixture).textContent ?? '';
  const selects = (fixture: ComponentFixture<Setup>) => [...root(fixture).querySelectorAll('select')];
  const countInputs = (fixture: ComponentFixture<Setup>) =>
    [...root(fixture).querySelectorAll<HTMLInputElement>('.topic input')];
  const counts = (fixture: ComponentFixture<Setup>) => countInputs(fixture).map((input) => input.value);
  const inactive = (fixture: ComponentFixture<Setup>) => [...root(fixture).querySelectorAll('.topic.inactive')];
  const levelBoxes = (fixture: ComponentFixture<Setup>) =>
    [...root(fixture).querySelectorAll<HTMLInputElement>('fieldset input[type="checkbox"]')];
  const startButton = (fixture: ComponentFixture<Setup>) =>
    root(fixture).querySelector<HTMLButtonElement>('button.btn-primary');
  // The total comes before the topics, so it is the first number field.
  const totalInput = (fixture: ComponentFixture<Setup>) => root(fixture).querySelector<HTMLInputElement>('input.number')!;
  const hint = (fixture: ComponentFixture<Setup>) => root(fixture).querySelector('.hint')?.textContent ?? null;

  async function choose(fixture: ComponentFixture<Setup>, index: number, value: string): Promise<void> {
    const select = selects(fixture)[index];
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function type(fixture: ComponentFixture<Setup>, input: HTMLInputElement, value: string): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function pickDotnet(fixture: ComponentFixture<Setup>): Promise<void> {
    await choose(fixture, 0, 'backend');
    await choose(fixture, 1, 'dotnet');
  }

  it('fills the seed .NET stack with 7/7/6 on the 3 topics that have questions, the rest marked "0 питань"', async () => {
    const fixture = await render();

    await pickDotnet(fixture);

    expect(counts(fixture)).toEqual(['7', '7', '6']);
    const titles = [...root(fixture).querySelectorAll('.topic:not(.inactive) .topic-title')].map((el) => el.textContent?.trim());
    expect(titles).toEqual(['T csharp', 'T ef-core', 'T sql']);
    expect(inactive(fixture)).toHaveLength(7);
    for (const row of inactive(fixture)) {
      expect(row.textContent).toContain('0 питань');
      expect(row.querySelector('input')).toBeNull();
    }
    expect(text(fixture)).toContain('Розподілено 20 з 20');
    expect(hint(fixture)).toBeNull();
    expect(startButton(fixture)!.disabled).toBe(false);
  });

  it('sends exactly the spec 5.2 body: only the 3 active topics and an empty excludeQuestionIds, then opens /test', async () => {
    const fixture = await render();
    await pickDotnet(fixture);

    startButton(fixture)!.click();
    await settle(fixture);

    expect(api.requests).toStrictEqual([
      {
        fieldId: 'it',
        levelIds: ['junior', 'middle', 'senior'],
        topics: [
          { topicId: 'csharp', count: 7 },
          { topicId: 'ef-core', count: 7 },
          { topicId: 'sql', count: 6 },
        ],
        excludeQuestionIds: [],
      },
    ]);
    expect(TestBed.inject(Router).url).toBe('/test');
    expect(TestBed.inject(TestSessionService).session()?.test).toBe(TEST);
  });

  it('with one level selected lowers the values to the max 4/4/4, shows the hint and blocks "Почати"', async () => {
    const fixture = await render();
    await pickDotnet(fixture);

    levelBoxes(fixture)[0].click();
    await fixture.whenStable();
    levelBoxes(fixture)[1].click();
    await fixture.whenStable();

    expect(counts(fixture)).toEqual(['4', '4', '4']);
    expect(countInputs(fixture).map((input) => input.max)).toEqual(['4', '4', '4']);
    expect(text(fixture)).toContain('Розподілено 12 з 20');
    expect(hint(fixture)).toContain('Додайте тем або рівнів');
    expect(startButton(fixture)!.disabled).toBe(true);
    // At least one level stays selected.
    expect(levelBoxes(fixture).map((box) => [box.checked, box.disabled])).toEqual([
      [false, false],
      [false, false],
      [true, true],
    ]);
  });

  it('gives 4/4/4 when the single level is chosen before the stack', async () => {
    const fixture = await render();

    levelBoxes(fixture)[1].click();
    await fixture.whenStable();
    levelBoxes(fixture)[2].click();
    await fixture.whenStable();
    await pickDotnet(fixture);

    expect(counts(fixture)).toEqual(['4', '4', '4']);
    expect(startButton(fixture)!.disabled).toBe(true);
  });

  it('turns a topic left without questions after a level change inactive with 0', async () => {
    api.catalog = () =>
      of({
        fields: [
          {
            ...seedField(),
            directions: [{ id: 'backend', title: 'Backend', stacks: [{ id: 'dotnet', title: '.NET', topicIds: ['a', 'b'] }] }],
            topics: [topic('a', { junior: 10, senior: 10 }), topic('b', { junior: 10 })],
          },
        ],
      });
    const fixture = await render();
    await pickDotnet(fixture);
    expect(counts(fixture)).toEqual(['10', '10']);

    levelBoxes(fixture)[0].click();
    await fixture.whenStable();

    expect(counts(fixture)).toEqual(['10']);
    expect(inactive(fixture)).toHaveLength(1);
    expect(inactive(fixture)[0].textContent).toContain('0 питань');
    expect(text(fixture)).toContain('Розподілено 10 з 20');
    expect(startButton(fixture)!.disabled).toBe(true);
  });

  it('keeps "Почати" inactive until X = Y and every active topic is within its max', async () => {
    const fixture = await render();
    await pickDotnet(fixture);

    await type(fixture, countInputs(fixture)[2], '5');
    expect(text(fixture)).toContain('Розподілено 19 з 20');
    expect(startButton(fixture)!.disabled).toBe(true);

    await type(fixture, countInputs(fixture)[2], '6');
    expect(startButton(fixture)!.disabled).toBe(false);

    // The sum matches, but 13 is above the max of 12.
    await type(fixture, countInputs(fixture)[0], '13');
    await type(fixture, countInputs(fixture)[1], '1');
    expect(text(fixture)).toContain('Розподілено 20 з 20');
    expect(startButton(fixture)!.disabled).toBe(true);

    // An emptied field counts as 0, below the minimum of 1.
    await type(fixture, countInputs(fixture)[0], '');
    await type(fixture, countInputs(fixture)[1], '14');
    expect(startButton(fixture)!.disabled).toBe(true);
  });

  it('sends a single request on a double click and keeps "Почати" inactive while it runs', async () => {
    const pending = new Subject<Test>();
    api.reply = () => pending;
    const fixture = await render();
    await pickDotnet(fixture);

    startButton(fixture)!.click();
    startButton(fixture)!.click();
    await fixture.whenStable();

    expect(api.requests).toHaveLength(1);
    expect(startButton(fixture)!.disabled).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/');

    pending.next(TEST);
    pending.complete();
    await settle(fixture);

    expect(api.requests).toHaveLength(1);
    expect(TestBed.inject(Router).url).toBe('/test');
  });

  it('shows the server message above the button when the test cannot be created, and lets the user retry', async () => {
    api.reply = () => throwError(() => new ApiError('У темі «T sql» немає стільки питань.'));
    const fixture = await render();
    await pickDotnet(fixture);

    startButton(fixture)!.click();
    await settle(fixture);

    const alert = root(fixture).querySelector('[role="alert"]');
    expect(alert?.textContent?.trim()).toBe('У темі «T sql» немає стільки питань.');
    expect(alert?.nextElementSibling).toBe(startButton(fixture));
    expect(startButton(fixture)!.disabled).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(TestBed.inject(TestSessionService).session()).toBeNull();
  });

  it('shows "Завантаження…" while the catalog loads', async () => {
    api.catalog = () => NEVER;
    const fixture = await render();

    expect(text(fixture)).toContain('Завантаження…');
    expect(selects(fixture)).toHaveLength(0);
  });

  it('shows the network error instead of the form when the catalog cannot be loaded', async () => {
    api.catalog = () => throwError(() => new ApiError("Не вдалося зв'язатися із сервером."));
    const fixture = await render();

    expect(root(fixture).querySelector('[role="alert"]')?.textContent?.trim()).toBe("Не вдалося зв'язатися із сервером.");
    expect(selects(fixture)).toHaveLength(0);
    expect(root(fixture).querySelector('input')).toBeNull();
    expect(startButton(fixture)).toBeNull();
    expect(text(fixture)).not.toContain('Завантаження…');
  });

  describe('cold start hint (PRP-022)', () => {
    const SLOW = 'Сервер прокидається після простою — це може тривати до хвилини.';
    const muted = (fixture: ComponentFixture<Setup>) =>
      [...root(fixture).querySelectorAll('p.muted')].map((p) => p.textContent?.trim());

    // On before the component exists: RxJS `timer` reads the global setInterval when it subscribes.
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    /** Zoneless: the view is checked explicitly, because the scheduler's own timers are fake as well. */
    function create(): ComponentFixture<Setup> {
      const fixture = TestBed.createComponent(Setup);
      fixture.detectChanges();
      return fixture;
    }

    async function wait(fixture: ComponentFixture<Setup>, ms: number): Promise<void> {
      await vi.advanceTimersByTimeAsync(ms);
      fixture.detectChanges();
    }

    it('appears under "Завантаження…" at 5 s, not at 4.9 s, while the catalog does not answer', async () => {
      api.catalog = () => NEVER;
      const fixture = create();

      await wait(fixture, 4900);
      expect(muted(fixture)).toEqual(['Завантаження…']);

      await wait(fixture, 100);
      expect(muted(fixture)).toEqual(['Завантаження…', SLOW]);
    });

    it('goes away together with "Завантаження…" when the catalog arrives after 5 s', async () => {
      const catalog = new Subject<Catalog>();
      api.catalog = () => catalog;
      const fixture = create();
      await wait(fixture, 5000);
      expect(text(fixture)).toContain(SLOW);

      catalog.next(seedCatalog());
      fixture.detectChanges();

      expect(text(fixture)).not.toContain(SLOW);
      expect(text(fixture)).not.toContain('Завантаження…');
      expect(selects(fixture)).toHaveLength(2);
    });

    it('goes away together with "Завантаження…" when the catalog fails after 5 s', async () => {
      const catalog = new Subject<Catalog>();
      api.catalog = () => catalog;
      const fixture = create();
      await wait(fixture, 5000);
      expect(text(fixture)).toContain(SLOW);

      catalog.error(new ApiError("Не вдалося зв'язатися із сервером."));
      fixture.detectChanges();

      expect(root(fixture).querySelector('[role="alert"]')?.textContent?.trim()).toBe("Не вдалося зв'язатися із сервером.");
      expect(text(fixture)).not.toContain(SLOW);
      expect(text(fixture)).not.toContain('Завантаження…');
    });

    it('never appears when the catalog answers within 5 s, and its timer is cancelled', async () => {
      const catalog = new Subject<Catalog>();
      api.catalog = () => catalog;
      const fixture = create();
      await wait(fixture, 1000);

      catalog.next(seedCatalog());
      await wait(fixture, 1);
      expect(vi.getTimerCount()).toBe(0);

      await wait(fixture, 10_000);
      expect(text(fixture)).not.toContain(SLOW);
    });

    it('cancels its timer when the catalog fails within 5 s', async () => {
      const catalog = new Subject<Catalog>();
      api.catalog = () => catalog;
      const fixture = create();
      await wait(fixture, 1000);

      catalog.error(new ApiError("Не вдалося зв'язатися із сервером."));
      await wait(fixture, 1);

      expect(vi.getTimerCount()).toBe(0);
    });

    it('cancels its timer when the page is left before the catalog answers', async () => {
      api.catalog = () => NEVER;
      const fixture = create();
      await wait(fixture, 1000);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      fixture.destroy();
      await vi.advanceTimersByTimeAsync(1);

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('hides the field step for a single field and shows it, first field selected, for several', async () => {
    const single = await render();
    expect(text(single)).not.toContain('Галузь');
    expect(selects(single)).toHaveLength(2);
    single.destroy();

    const science: Field = {
      id: 'science',
      title: 'Наука',
      levels: [
        { id: 'phd', title: 'Кандидат наук', rank: 2 },
        { id: 'postgrad', title: 'Аспірант', rank: 1 },
      ],
      directions: [{ id: 'physics', title: 'Фізика', stacks: [] }],
      topics: [],
    };
    api.catalog = () => of({ fields: [seedField(), science] });
    const several = await render();

    expect(text(several)).toContain('Галузь');
    expect(selects(several)).toHaveLength(3);
    expect(selects(several)[0].value).toBe('it');

    await choose(several, 0, 'science');
    expect(levelBoxes(several).map((box) => box.parentElement?.textContent?.trim())).toEqual(['Аспірант', 'Кандидат наук']);
    expect(levelBoxes(several).every((box) => box.checked)).toBe(true);
    expect([...selects(several)[1].options].map((option) => option.textContent?.trim())).toEqual(['Виберіть напрям', 'Фізика']);
  });

  it('shows a data-only level such as Architect in rank order and counts its questions', async () => {
    api.catalog = () =>
      of({
        fields: [
          {
            id: 'it',
            title: 'IT',
            levels: [
              { id: 'senior', title: 'Senior', rank: 3 },
              { id: 'architect', title: 'Architect', rank: 4 },
              { id: 'junior', title: 'Junior', rank: 1 },
              { id: 'middle', title: 'Middle', rank: 2 },
            ],
            directions: [{ id: 'backend', title: 'Backend', stacks: [{ id: 'dotnet', title: '.NET', topicIds: ['arch', 'sql'] }] }],
            topics: [topic('arch', { architect: 12 }), topic('sql', { junior: 12 })],
          },
        ],
      });
    const fixture = await render();
    expect(levelBoxes(fixture).map((box) => box.parentElement?.textContent?.trim())).toEqual(['Junior', 'Middle', 'Senior', 'Architect']);

    await pickDotnet(fixture);
    expect(counts(fixture)).toEqual(['10', '10']);
    for (const index of [0, 1, 2]) {
      levelBoxes(fixture)[index].click();
      await fixture.whenStable();
    }
    await type(fixture, totalInput(fixture), '12');

    expect(counts(fixture)).toEqual(['12']);
    expect(startButton(fixture)!.disabled).toBe(false);
    startButton(fixture)!.click();
    await settle(fixture);
    expect(api.requests[0].levelIds).toEqual(['architect']);
    expect(api.requests[0].topics).toEqual([{ topicId: 'arch', count: 12 }]);
  });

  it('survives a stack where every topic is empty: no fields, hint shown, "Почати" inactive', async () => {
    const fixture = await render();

    await choose(fixture, 0, 'frontend');
    await choose(fixture, 1, 'react');

    expect(countInputs(fixture)).toHaveLength(0);
    expect(inactive(fixture)).toHaveLength(10);
    expect(text(fixture)).toContain('Розподілено 0 з 20');
    expect(hint(fixture)).toContain('Додайте тем або рівнів');
    expect(startButton(fixture)!.disabled).toBe(true);
  });

  it('without a stack shows only "Виберіть стек або додайте тему.", not the hint, also after a direction or a level change', async () => {
    const fixture = await render();

    expect(text(fixture)).toContain('Виберіть стек або додайте тему.');
    expect(hint(fixture)).toBeNull();

    await choose(fixture, 0, 'backend');
    levelBoxes(fixture)[0].click();
    await fixture.whenStable();

    expect(text(fixture)).toContain('Виберіть стек або додайте тему.');
    expect(hint(fixture)).toBeNull();
    expect(startButton(fixture)!.disabled).toBe(true);
  });

  it('shows the hint once a single topic is added, when it has fewer questions than the total', async () => {
    const fixture = await render();
    [...root(fixture).querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Додати тему')!.click();
    await fixture.whenStable();

    root(fixture).querySelector<HTMLButtonElement>('button.candidate')!.click();
    await fixture.whenStable();

    expect(text(fixture)).not.toContain('Виберіть стек або додайте тему.');
    expect(hint(fixture)).toContain('Додайте тем або рівнів (доступно питань: 12)');
  });

  it('offers field topics in the API order, filters them by title without re-sorting and hides added ones', async () => {
    api.catalog = () =>
      of({
        fields: [
          {
            ...seedField(),
            directions: [{ id: 'backend', title: 'Backend', stacks: [{ id: 'dotnet', title: '.NET', topicIds: ['mu'] }] }],
            topics: [
              { id: 'zeta', title: 'Zeta', description: '', questionCounts: { junior: 20 } },
              { id: 'alpha', title: 'Alpha', description: '', questionCounts: { junior: 20 } },
              { id: 'mu', title: 'Mu', description: '', questionCounts: { junior: 20 } },
            ],
          },
        ],
      });
    const fixture = await render();
    const candidates = () => [...root(fixture).querySelectorAll<HTMLButtonElement>('button.candidate')];
    const openAdd = [...root(fixture).querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Додати тему')!;

    openAdd.click();
    await fixture.whenStable();
    expect(candidates().map((button) => button.textContent?.trim())).toEqual(['Zeta', 'Alpha', 'Mu']);

    await type(fixture, root(fixture).querySelector<HTMLInputElement>('input[type="search"]')!, 'A');
    expect(candidates().map((button) => button.textContent?.trim())).toEqual(['Zeta', 'Alpha']);

    await type(fixture, root(fixture).querySelector<HTMLInputElement>('input[type="search"]')!, '');
    await pickDotnet(fixture);
    expect(candidates().map((button) => button.textContent?.trim())).toEqual(['Zeta', 'Alpha']);

    candidates()[1].click();
    await fixture.whenStable();
    expect(candidates().map((button) => button.textContent?.trim())).toEqual(['Zeta']);
    expect(counts(fixture)).toEqual(['10', '10']);

    root(fixture).querySelector<HTMLButtonElement>('button[aria-label="Прибрати тему Mu"]')!.click();
    await fixture.whenStable();
    expect(counts(fixture)).toEqual(['20']);
    expect(candidates().map((button) => button.textContent?.trim())).toEqual(['Zeta', 'Mu']);
  });

  it('redistributes on a new total, flags totals outside 10–100 and labels the timer in minutes', async () => {
    const fixture = await render();
    await pickDotnet(fixture);
    const timer = () => root(fixture).querySelector('input[role="switch"]')!.parentElement!.textContent!.trim();
    expect(timer()).toBe('Таймер: 20 хв');

    await type(fixture, totalInput(fixture), '30');
    expect(counts(fixture)).toEqual(['10', '10', '10']);
    expect(timer()).toBe('Таймер: 30 хв');
    expect(startButton(fixture)!.disabled).toBe(false);

    for (const outside of ['9', '101']) {
      await type(fixture, totalInput(fixture), outside);
      expect(text(fixture)).toContain('Від 10 до 100 питань.');
      expect(startButton(fixture)!.disabled).toBe(true);
    }

    await type(fixture, totalInput(fixture), '10');
    expect(counts(fixture)).toEqual(['4', '3', '3']);
    expect(startButton(fixture)!.disabled).toBe(false);

    root(fixture).querySelector<HTMLInputElement>('input[role="switch"]')!.click();
    await fixture.whenStable();
    expect(timer()).toBe('Таймер: вимкнено');
  });
});

describe('Setup page with the real ApiService', () => {
  it('shows "Не вдалося зв\'язатися із сервером." when the catalog request gets no answer', async () => {
    const errors = new RecordingErrorHandler();
    TestBed.configureTestingModule({
      imports: [Setup],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test/api' },
        { provide: ErrorHandler, useValue: errors },
      ],
    });
    const fixture = TestBed.createComponent(Setup);
    const http = TestBed.inject(HttpTestingController);

    http.expectOne('https://api.test/api/catalog').error(new ProgressEvent('error'));
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')?.textContent?.trim()).toBe("Не вдалося зв'язатися із сервером.");
    expect(root.querySelector('select')).toBeNull();
    expect(errors.errors).toEqual([]);
    http.verify();
  });
});

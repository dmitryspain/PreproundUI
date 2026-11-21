import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { CLOCK } from './clock';
import { SECONDS_PER_QUESTION } from './config';
import { isActive } from './distribution';
import { grade, score } from './grading';
import { I18n } from './i18n/i18n.service';
import { LanguageId } from './i18n/languages';
import { Answers, Field, Test, TestRequest, TestResult, TestSetup } from './models';

/** The test in progress, kept only in memory: a reload loses it (spec 3.2). */
export interface TestSession {
  /** Catalog field of the test: titles of its topics and levels for `/test` and `/result`. */
  field: Field;
  setup: TestSetup;
  test: Test;
}

@Injectable({ providedIn: 'root' })
export class TestSessionService {
  private readonly api = inject(ApiService);
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly current = signal<TestSession | null>(null);
  private readonly contentLanguage = signal<LanguageId | null>(null);
  /** `CLOCK.now()` when the current test was received. */
  private readonly startedAt = signal(0);
  private readonly outcome = signal<TestResult | null>(null);

  /** `null` until a test has been created. */
  readonly session = this.current.asReadonly();

  /**
   * Language of the current test's questions and of its `field`: the one on screen when it was created.
   * The test keeps it for good (spec 3.7); `null` until a test has been created.
   */
  readonly language = this.contentLanguage.asReadonly();

  /** Result of the current test once it is finished; `null` while it is in progress. */
  readonly result = this.outcome.asReadonly();

  /** A test has been created and not finished yet: only then `/test` makes sense. */
  readonly inProgress = computed(() => this.current() !== null && this.outcome() === null);

  /** When the timer runs out, in `CLOCK.now()` terms; `null` without a session or with the timer off. */
  readonly deadline = computed(() => {
    const limit = timeLimitMs(this.current());
    return limit === null ? null : this.startedAt() + limit;
  });

  /**
   * The only place that builds the body of `POST /api/tests`, so "try again" and "already seen"
   * change just this method. Keeps the previous session when the request fails; rejects with an `ApiError`.
   */
  async start(setup: TestSetup, field: Field): Promise<void> {
    const request: TestRequest = {
      fieldId: setup.fieldId,
      levelIds: [...setup.levelIds],
      // Inactive topics have no questions on the selected levels, and the API rejects a count of 0.
      topics: setup.topics
        .filter(isActive)
        .map((topic) => ({ topicId: topic.topicId, count: topic.count })),
      excludeQuestionIds: [],
    };

    // Read together with the request, which takes the same language for its `lang`.
    const language = this.i18n.language();
    const test = await firstValueFrom(this.api.createTest(request));
    this.current.set({ field, setup, test });
    this.contentLanguage.set(language);
    this.startedAt.set(this.clock.now());
    this.outcome.set(null);
  }

  /**
   * The only way a test ends, by the button or by the timer: grades the answers, keeps the result
   * and goes to `/result`. Does nothing when no test is in progress, so the timer and the button
   * firing together finish the test once.
   */
  async finish(answers: Answers): Promise<void> {
    const session = this.current();
    if (!session || this.outcome() !== null) {
      return;
    }

    const { test } = session;
    // Only the questions of this test, and only those with an answer: a missing id means "no answer".
    const kept: Record<string, readonly number[]> = {};
    const grades: Record<string, boolean> = {};
    for (const question of test.questions) {
      const selected = answers[question.id] ?? [];
      if (selected.length > 0) {
        kept[question.id] = [...selected];
      }
      grades[question.id] = grade(question, selected);
    }

    // The timer is checked once a second, so the clock may already be a bit past the deadline.
    const limit = timeLimitMs(session) ?? Number.POSITIVE_INFINITY;
    const elapsedMs = Math.min(Math.max(0, this.clock.now() - this.startedAt()), limit);

    this.outcome.set({ answers: kept, grades, score: score(test, kept), elapsedMs });
    await this.router.navigate(['/result']);
  }
}

/** The timer gives `SECONDS_PER_QUESTION` per question of the test (spec 3.1, item 6); `null` when it is off. */
function timeLimitMs(session: TestSession | null): number | null {
  return session?.setup.timerEnabled
    ? session.test.questions.length * SECONDS_PER_QUESTION * 1000
    : null;
}

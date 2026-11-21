import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, errorText } from '../core/api.service';
import { refit } from '../core/distribution';
import { breakdownByTopic } from '../core/grading';
import { I18n } from '../core/i18n/i18n.service';
import { LanguageId } from '../core/i18n/languages';
import { TPipe } from '../core/i18n/pipes';
import { type MessageKey, translate } from '../core/i18n/translate';
import { Field, TestResult, TestSetup } from '../core/models';
import { TestSession, TestSessionService } from '../core/test-session.service';
import { ResultView, ResultViewModel } from './result-view';

/** What "try again" starts: the settings and the catalog field, both in the language of the new test. */
interface Retake {
  setup: TestSetup;
  field: Field;
}

/** `/result`: the test that was just finished (spec 3.4). The route opens only when there is a result. */
@Component({
  imports: [ResultView, RouterLink, TPipe],
  selector: 'app-result',
  styleUrl: './result.scss',
  templateUrl: './result.html',
})
export class Result {
  private readonly sessions = inject(TestSessionService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18n);

  /**
   * Taken once, when the page opens: "try again" replaces the session and clears the result
   * a moment before `/test` opens, and the page should not go blank meanwhile.
   */
  private readonly session = this.sessions.session();
  /** Language of the finished test's questions and titles, taken together with the session. */
  private readonly sessionLanguage = this.sessions.language();
  protected readonly view = toView(this.session, this.sessions.result());

  protected readonly retrying = signal(false);
  protected readonly retryError = signal<string | null>(null);

  /** The same path as `setup.start`: `start` is the only place that builds the request, so the body repeats as is. */
  protected async retry(): Promise<void> {
    const session = this.session;
    // Checked before anything is awaited, so a double click sends a single request.
    if (this.retrying() || !session) {
      return;
    }

    this.retrying.set(true);
    this.retryError.set(null);
    try {
      // The switch stays in the header meanwhile: a language picked while the catalog loads is loaded again,
      // so the test request below goes in the same language as the field it is given.
      let language: LanguageId;
      let retake: Retake | MessageKey;
      do {
        language = this.i18n.language();
        retake = await this.retakeIn(language, session);
      } while (this.i18n.language() !== language);

      if (typeof retake === 'string') {
        this.retryError.set(translate(retake));
        return;
      }
      await this.sessions.start(retake.setup, retake.field);
      await this.router.navigate(['/test']);
    } catch (error) {
      this.retryError.set(errorText(error));
    } finally {
      this.retrying.set(false);
    }
  }

  /**
   * The same settings in `language` (spec 3.7): a test never mixes languages. In the language of the finished
   * test they repeat as they are. In another one the field comes from the catalog in that language, and counts
   * above its maxima drop to them, as on the setup page. A message key instead when no such test can be built.
   */
  private async retakeIn(language: LanguageId, session: TestSession): Promise<Retake | MessageKey> {
    if (language === this.sessionLanguage) {
      return { setup: session.setup, field: session.field };
    }

    const catalog = await firstValueFrom(this.api.getCatalog());
    const field = catalog.fields.find((candidate) => candidate.id === session.field.id);
    if (!field) {
      return 'errors.catalogChanged';
    }
    const setup = refit(session.setup, field);
    return setup ? { setup, field } : 'result.retryLanguage';
  }
}

/** Grades are already in the result; this only adds the catalog titles and the topic breakdown. */
function toView(session: TestSession | null, result: TestResult | null): ResultViewModel | null {
  if (!session || !result) {
    return null;
  }

  const { field, setup, test } = session;
  const topicTitles = new Map(field.topics.map((topic) => [topic.id, topic.title]));
  const levelTitles = new Map(field.levels.map((level) => [level.id, level.title]));
  const topicOrder = setup.topics.map((topic) => topic.topicId);

  return {
    score: result.score,
    elapsedMs: result.elapsedMs,
    topics: breakdownByTopic(test, result.answers, topicOrder).map((topic) => ({
      ...topic,
      title: topicTitles.get(topic.topicId) ?? topic.topicId,
    })),
    review: test.questions.map((question) => ({
      question,
      topicTitle: topicTitles.get(question.topicId) ?? question.topicId,
      levelTitle: levelTitles.get(question.levelId) ?? question.levelId,
      selectedKeys: result.answers[question.id] ?? [],
      correct: result.grades[question.id] ?? false,
    })),
  };
}

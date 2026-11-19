import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { errorText } from '../core/api.service';
import { breakdownByTopic } from '../core/grading';
import { TestResult } from '../core/models';
import { TestSession, TestSessionService } from '../core/test-session.service';
import { ResultView, ResultViewModel } from './result-view';

/** `/result`: the test that was just finished (spec 3.4). The route opens only when there is a result. */
@Component({
  imports: [ResultView, RouterLink],
  selector: 'app-result',
  styleUrl: './result.scss',
  templateUrl: './result.html',
})
export class Result {
  private readonly sessions = inject(TestSessionService);
  private readonly router = inject(Router);

  /**
   * Taken once, when the page opens: "try again" replaces the session and clears the result
   * a moment before `/test` opens, and the page should not go blank meanwhile.
   */
  private readonly session = this.sessions.session();
  protected readonly view = toView(this.session, this.sessions.result());

  protected readonly retrying = signal(false);
  protected readonly retryError = signal<string | null>(null);

  /** The same path as "Почати": `start` is the only place that builds the request, so the body repeats as is. */
  protected async retry(): Promise<void> {
    const session = this.session;
    // Checked before anything is awaited, so a double click sends a single request.
    if (this.retrying() || !session) {
      return;
    }

    this.retrying.set(true);
    this.retryError.set(null);
    try {
      await this.sessions.start(session.setup, session.field);
      await this.router.navigate(['/test']);
    } catch (error) {
      this.retryError.set(errorText(error));
    } finally {
      this.retrying.set(false);
    }
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

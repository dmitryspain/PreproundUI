import { Component, computed, input, signal } from '@angular/core';
import { formatDuration } from '../core/format';
import { TPipe } from '../core/i18n/pipes';
import { Question, Score } from '../core/models';
import { ContentTextPipe } from '../shared/content-text.pipe';

/** Below this share of correct answers, in percent, a topic is weak: its bar is red. */
export const WEAK_BELOW_PERCENT = 50;

/** From this share on, in percent, a topic is strong: its bar is green. Between the two it is yellow. */
export const STRONG_FROM_PERCENT = 80;

/** How a topic went, by the share of correct answers: `low` < 50 %, `mid` from 50 to < 80 %, `high` ≥ 80 %. */
export type TopicBand = 'low' | 'mid' | 'high';

/** Compared in integers, so 4 of 5 is exactly 80 % and 79 of 100 stays below it. */
export function topicBand(correct: number, total: number): TopicBand {
  if (total <= 0 || correct * 100 < total * WEAK_BELOW_PERCENT) {
    return 'low';
  }
  return correct * 100 < total * STRONG_FROM_PERCENT ? 'mid' : 'high';
}

/** One row of the topic breakdown, with the catalog title of the topic. */
export interface TopicResultView {
  topicId: string;
  title: string;
  correct: number;
  total: number;
}

/** A question of the review with the user's answer. */
export interface ReviewItemView {
  question: Question;
  topicTitle: string;
  levelTitle: string;
  /** Option keys the user selected; empty without an answer. */
  selectedKeys: readonly number[];
  correct: boolean;
}

/** Everything the result shows, already graded: the view reads no services, so `/history/:id` can reuse it. */
export interface ResultViewModel {
  score: Score;
  elapsedMs: number;
  /** Weakest topic first, as `breakdownByTopic` orders them. */
  topics: TopicResultView[];
  /** In the order of the test; `null` hides the review (history keeps no question texts). */
  review: ReviewItemView[] | null;
}

/**
 * A finished test (spec 3.4): score, time, topics from the weakest, and the review with a "mistakes only" filter.
 * Content between the topics and the review (the page's buttons) is projected, so it stays above a long review.
 */
@Component({
  imports: [ContentTextPipe, TPipe],
  selector: 'app-result-view',
  styleUrl: './result-view.scss',
  templateUrl: './result-view.html',
})
export class ResultView {
  readonly result = input.required<ResultViewModel>();

  protected readonly onlyMistakes = signal(false);

  /** Only whole seconds count, like on a stopwatch. */
  protected readonly elapsed = computed(() =>
    formatDuration(Math.floor(this.result().elapsedMs / 1000)),
  );

  /** Numbers stay those of the test, so a filtered list still says which question it was. */
  private readonly numbered = computed(() =>
    (this.result().review ?? []).map((item, index) => ({
      item,
      number: index + 1,
      selected: new Set(item.selectedKeys),
    })),
  );
  /** A wrong answer and no answer are both mistakes: both count as wrong (spec 3.3). */
  protected readonly mistakes = computed(
    () => this.numbered().filter((entry) => !entry.item.correct).length,
  );
  protected readonly shown = computed(() =>
    this.onlyMistakes() ? this.numbered().filter((entry) => !entry.item.correct) : this.numbered(),
  );

  /** Width of the topic bar, in percent. */
  protected share(topic: TopicResultView): number {
    return topic.total === 0 ? 0 : Math.round((topic.correct * 100) / topic.total);
  }

  /** Colour band of the topic bar: weak topics show at a glance. */
  protected band(topic: TopicResultView): TopicBand {
    return topicBand(topic.correct, topic.total);
  }
}

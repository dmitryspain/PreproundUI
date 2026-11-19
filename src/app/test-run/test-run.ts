import { ViewportScroller } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CLOCK } from '../core/clock';
import { formatDuration } from '../core/format';
import { grade } from '../core/grading';
import { Answers, Question } from '../core/models';
import { TestSessionService } from '../core/test-session.service';
import { ContentTextPipe } from '../shared/content-text.pipe';

/** State of a question in the number grid (spec 3.2). */
type QuestionState = 'unanswered' | 'answered' | 'correct' | 'incorrect';

const STATE_LABELS: Readonly<Record<QuestionState, string>> = {
  unanswered: 'без відповіді',
  answered: 'з відповіддю',
  correct: 'перевірено, правильно',
  incorrect: 'перевірено, неправильно',
};

/** The test itself (spec 3.2): one question at a time, "Перевірити" locks the answer, one timer for the whole test. */
@Component({
  imports: [ContentTextPipe],
  selector: 'app-test-run',
  styleUrl: './test-run.scss',
  templateUrl: './test-run.html',
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
})
export class TestRun {
  private readonly sessions = inject(TestSessionService);
  private readonly clock = inject(CLOCK);
  private readonly viewport = inject(ViewportScroller);
  private readonly injector = inject(Injector);

  protected readonly stateLabels = STATE_LABELS;
  protected readonly formatDuration = formatDuration;

  protected readonly session = this.sessions.session;
  protected readonly questions = computed(() => this.session()?.test.questions ?? []);
  protected readonly index = signal(0);
  protected readonly question = computed(() => this.questions()[this.index()] ?? null);
  /**
   * The current question as a one-item list, so every question gets fresh inputs:
   * reused radios would keep their checked state while moving to another group.
   */
  protected readonly shown = computed(() => {
    const question = this.question();
    return question ? [question] : [];
  });

  /** Selected keys by question id, in the order the options are shown. */
  protected readonly answers = signal<Answers>({});
  /** Ids of the questions whose answer was checked and is locked now. */
  protected readonly checked = signal<ReadonlySet<string>>(new Set());
  protected readonly confirming = signal(false);

  protected readonly selected = computed(
    () => new Set(this.answers()[this.question()?.id ?? ''] ?? []),
  );
  protected readonly locked = computed(() => this.checked().has(this.question()?.id ?? ''));
  protected readonly correct = computed(() => {
    const question = this.question();
    return question !== null && grade(question, this.answers()[question.id]);
  });

  protected readonly states = computed(() =>
    this.questions().map((question): QuestionState => {
      const selected = this.answers()[question.id] ?? [];
      if (this.checked().has(question.id)) {
        return grade(question, selected) ? 'correct' : 'incorrect';
      }
      return selected.length > 0 ? 'answered' : 'unanswered';
    }),
  );
  protected readonly unanswered = computed(
    () => this.states().filter((state) => state === 'unanswered').length,
  );
  /** Width of the progress bar: the share of questions with an answer, in percent. */
  protected readonly answeredShare = computed(() => {
    const count = this.questions().length;
    return count === 0 ? 0 : ((count - this.unanswered()) * 100) / count;
  });

  private readonly confirmPanel = viewChild<ElementRef<HTMLElement>>('confirmPanel');

  private readonly topicTitles = computed(
    () => new Map(this.session()?.field.topics.map((topic) => [topic.id, topic.title]) ?? []),
  );
  private readonly levelTitles = computed(
    () => new Map(this.session()?.field.levels.map((level) => [level.id, level.title]) ?? []),
  );

  private readonly now = signal(this.clock.now());
  /** Whole seconds left; `null` with the timer off. */
  protected readonly remaining = computed(() => {
    const deadline = this.sessions.deadline();
    return deadline === null ? null : Math.max(0, Math.ceil((deadline - this.now()) / 1000));
  });

  constructor() {
    // With the timer off there is nothing to count down and nothing to finish by time.
    if (this.sessions.deadline() !== null) {
      this.clock.ticks.pipe(takeUntilDestroyed()).subscribe(() => {
        this.now.set(this.clock.now());
        if (this.remaining() === 0) {
          this.finish();
        }
      });
    }
  }

  protected topicTitle(topicId: string): string {
    return this.topicTitles().get(topicId) ?? topicId;
  }

  protected levelTitle(levelId: string): string {
    return this.levelTitles().get(levelId) ?? levelId;
  }

  protected go(index: number): void {
    if (index >= 0 && index < this.questions().length) {
      this.index.set(index);
      this.scrollToTop();
    }
  }

  protected select(question: Question, key: number, box: HTMLInputElement): void {
    const keys = new Set(this.answers()[question.id] ?? []);
    // Inputs of a checked answer are disabled; this guard also catches events that get through anyway.
    if (this.checked().has(question.id) || !this.sessions.inProgress()) {
      restore(box, keys);
      return;
    }

    if (question.type === 'single') {
      keys.clear();
    }
    if (box.checked) {
      keys.add(key);
    } else {
      keys.delete(key);
    }
    const ordered = question.options.map((option) => option.key).filter((item) => keys.has(item));
    this.answers.update((answers) => ({ ...answers, [question.id]: ordered }));
  }

  protected check(): void {
    const question = this.question();
    if (question && this.selected().size > 0 && this.sessions.inProgress()) {
      this.checked.update((checked) => new Set(checked).add(question.id));
    }
  }

  /** Unanswered questions count as wrong, so the user confirms that first (spec 3.2). */
  protected requestFinish(): void {
    if (this.unanswered() > 0) {
      this.confirming.set(true);
      afterNextRender(() => this.revealConfirm(), { injector: this.injector });
    } else {
      this.finish();
    }
  }

  protected finish(): void {
    this.confirming.set(false);
    void this.sessions.finish(this.answers());
  }

  /**
   * The panel is taller than the button it replaces, so on a phone its buttons would open below the fold:
   * the page scrolls just enough to show all of it.
   */
  private revealConfirm(): void {
    const panel = this.confirmPanel()?.nativeElement;
    // jsdom has no scrollIntoView.
    if (panel && typeof panel.scrollIntoView === 'function') {
      panel.scrollIntoView({ block: 'nearest' });
    }
  }

  /** On a phone the next question would otherwise open halfway down, where the previous one was left. */
  private scrollToTop(): void {
    // At the top there is nothing to move; this also keeps `scrollTo` away from jsdom, which cannot scroll.
    if (this.viewport.getScrollPosition()[1] > 0) {
      this.viewport.scrollToPosition([0, 0]);
    }
  }

  /** Progress lives only in memory (spec 3.2), so the browser asks before a reload or close drops it. */
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.sessions.inProgress()) {
      event.preventDefault();
      // Older browsers show the prompt only when returnValue is set.
      event.returnValue = true;
    }
  }
}

/** Puts every box of the question back to the answer: checking one radio unchecks the others in its group. */
function restore(box: HTMLInputElement, selected: ReadonlySet<number>): void {
  const boxes = box.closest('fieldset')?.querySelectorAll('input') ?? [box];
  for (const input of boxes) {
    input.checked = selected.has(Number(input.value));
  }
}

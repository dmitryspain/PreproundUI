import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { timer } from 'rxjs';
import { ApiService, errorText } from '../core/api.service';
import { SECONDS_PER_QUESTION, SLOW_CATALOG_HINT_MS } from '../core/config';
import {
  DEFAULT_QUESTIONS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  availableCount,
  distribute,
  distributedCount,
  isActive,
  maxFor,
  validate,
} from '../core/distribution';
import { Catalog, Level, TestSetup, Topic } from '../core/models';
import { TestSessionService } from '../core/test-session.service';

/** A topic picked for the test; `max` follows the selected levels, 0 makes the topic inactive. */
interface TopicRow {
  topic: Topic;
  max: number;
  count: number;
}

/** Start page: the user builds a test from the catalog (spec 3.1). */
@Component({
  imports: [],
  selector: 'app-setup',
  styleUrl: './setup.scss',
  templateUrl: './setup.html',
})
export class Setup {
  private readonly api = inject(ApiService);
  private readonly session = inject(TestSessionService);
  private readonly router = inject(Router);

  protected readonly minQuestions = MIN_QUESTIONS;
  protected readonly maxQuestions = MAX_QUESTIONS;

  /** `null` while loading and after a failed load (then `loadError` is set). */
  protected readonly catalog = signal<Catalog | null>(null);
  protected readonly loadError = signal<string | null>(null);
  /** The catalog takes longer than `SLOW_CATALOG_HINT_MS`; shown only while it still loads. */
  protected readonly slowCatalog = signal(false);

  protected readonly fieldId = signal<string | null>(null);
  protected readonly directionId = signal<string | null>(null);
  protected readonly stackId = signal<string | null>(null);
  /** In scale order, never empty once a field is selected. */
  protected readonly levelIds = signal<string[]>([]);
  protected readonly total = signal(DEFAULT_QUESTIONS);
  protected readonly rows = signal<TopicRow[]>([]);
  protected readonly timerEnabled = signal(true);

  protected readonly addingTopic = signal(false);
  protected readonly query = signal('');

  protected readonly starting = signal(false);
  protected readonly startError = signal<string | null>(null);

  protected readonly field = computed(
    () => this.catalog()?.fields.find((field) => field.id === this.fieldId()) ?? null,
  );
  protected readonly levels = computed(() => byRank(this.field()?.levels ?? []));
  protected readonly selectedLevels = computed(() => new Set(this.levelIds()));
  protected readonly direction = computed(
    () => this.field()?.directions.find((direction) => direction.id === this.directionId()) ?? null,
  );

  /** Field topics not picked yet, in the server's order: the search only filters them, never re-sorts. */
  protected readonly candidates = computed(() => {
    const picked = new Set(this.rows().map((row) => row.topic.id));
    const query = this.query().trim().toLocaleLowerCase();
    return (this.field()?.topics ?? []).filter(
      (topic) => !picked.has(topic.id) && topic.title.toLocaleLowerCase().includes(query),
    );
  });

  protected readonly distributed = computed(() => distributedCount(this.rows()));
  /** Width of the "Розподілено X з Y" bar, in percent; never past the end. */
  protected readonly distributedShare = computed(() => {
    const total = this.total();
    return total > 0 ? Math.min(100, (this.distributed() * 100) / total) : 0;
  });
  /** Colour of that bar: the split still short of the total, equal to it, or past it. */
  protected readonly distribution = computed(() => {
    const distributed = this.distributed();
    const total = this.total();
    return distributed === total ? 'full' : distributed > total ? 'over' : 'under';
  });
  protected readonly available = computed(() => availableCount(this.rows()));
  protected readonly totalInRange = computed(() => {
    const total = this.total();
    return Number.isInteger(total) && total >= MIN_QUESTIONS && total <= MAX_QUESTIONS;
  });
  protected readonly timerMinutes = computed(() =>
    Math.ceil((this.total() * SECONDS_PER_QUESTION) / 60),
  );

  protected readonly setup = computed((): TestSetup | null => {
    const field = this.field();
    if (!field) {
      return null;
    }
    return {
      fieldId: field.id,
      levelIds: this.levelIds(),
      total: this.total(),
      topics: this.rows().map((row) => ({ topicId: row.topic.id, max: row.max, count: row.count })),
      timerEnabled: this.timerEnabled(),
    };
  });

  protected readonly canStart = computed(() => {
    const setup = this.setup();
    return setup !== null && validate(setup) && !this.starting();
  });

  constructor() {
    const slow = timer(SLOW_CATALOG_HINT_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.slowCatalog.set(true));
    this.api
      .getCatalog()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (catalog) => {
          slow.unsubscribe();
          this.catalog.set(catalog);
          // With a single field its step is hidden, so it has to be selected for the user.
          const first = catalog.fields[0];
          if (first) {
            this.selectField(first.id);
          }
        },
        error: (error: unknown) => {
          slow.unsubscribe();
          this.loadError.set(errorText(error));
        },
      });
  }

  /** Levels, topics and stack belong to the field, so switching it starts the setup over. */
  protected selectField(fieldId: string): void {
    const field = this.catalog()?.fields.find((candidate) => candidate.id === fieldId);
    if (!field) {
      return;
    }
    this.fieldId.set(field.id);
    this.directionId.set(null);
    this.stackId.set(null);
    this.levelIds.set(byRank(field.levels).map((level) => level.id));
    this.rows.set([]);
    this.query.set('');
  }

  protected selectDirection(directionId: string): void {
    this.directionId.set(directionId || null);
    this.stackId.set(null);
  }

  /** A stack only suggests topics: picking it replaces the list with its topics, in the stack's order. */
  protected selectStack(stackId: string): void {
    const stack = this.direction()?.stacks.find((candidate) => candidate.id === stackId);
    this.stackId.set(stack?.id ?? null);
    if (!stack) {
      return;
    }
    const topics = new Map((this.field()?.topics ?? []).map((topic) => [topic.id, topic]));
    this.setTopics(
      stack.topicIds.map((id) => topics.get(id)).filter((topic): topic is Topic => !!topic),
    );
  }

  protected addTopic(topic: Topic): void {
    this.setTopics([...this.rows().map((row) => row.topic), topic]);
  }

  protected removeTopic(topicId: string): void {
    this.setTopics(
      this.rows()
        .filter((row) => row.topic.id !== topicId)
        .map((row) => row.topic),
    );
  }

  /** At least one level stays selected: the last checked box is disabled, and this guard backs it up. */
  protected toggleLevel(levelId: string, box: HTMLInputElement): void {
    const selected = new Set(this.levelIds());
    if (box.checked) {
      selected.add(levelId);
    } else {
      selected.delete(levelId);
    }
    if (selected.size === 0) {
      box.checked = true;
      return;
    }

    const levelIds = this.levels()
      .filter((level) => selected.has(level.id))
      .map((level) => level.id);
    this.levelIds.set(levelIds);

    // Values above the new maximum drop to it (spec 3.1, item 5), so a topic left without questions gets 0.
    const before = this.rows();
    const after = before.map((row) => {
      const max = maxFor(row.topic, levelIds);
      return { ...row, max, count: Math.min(row.count, max) };
    });
    this.rows.set(after);

    // A topic that just got questions joins the distribution, as if it had been added.
    if (after.some((row, index) => isActive(row) && !isActive(before[index]))) {
      this.redistribute();
    }
  }

  protected setTotal(value: number): void {
    this.total.set(Number.isFinite(value) ? value : 0);
    this.redistribute();
  }

  protected setCount(topicId: string, value: number): void {
    const count = Number.isFinite(value) ? value : 0;
    this.rows.update((rows) =>
      rows.map((row) => (row.topic.id === topicId ? { ...row, count } : row)),
    );
  }

  protected toggleAddingTopic(): void {
    this.addingTopic.update((open) => !open);
    this.query.set('');
  }

  protected async start(): Promise<void> {
    const setup = this.setup();
    const field = this.field();
    // Checked before anything is awaited, so a double click sends a single request.
    if (this.starting() || !setup || !field || !validate(setup)) {
      return;
    }

    this.starting.set(true);
    this.startError.set(null);
    try {
      await this.session.start(setup, field);
      await this.router.navigate(['/test']);
    } catch (error) {
      this.startError.set(errorText(error));
    } finally {
      this.starting.set(false);
    }
  }

  /** The set of topics changed: they are split evenly again (spec 3.1, item 5). */
  private setTopics(topics: Topic[]): void {
    const levelIds = this.levelIds();
    this.rows.set(topics.map((topic) => ({ topic, max: maxFor(topic, levelIds), count: 0 })));
    this.redistribute();
  }

  private redistribute(): void {
    this.rows.update((rows) => {
      const counts = distribute(this.total(), rows);
      return rows.map((row, index) => ({ ...row, count: counts[index] }));
    });
  }
}

function byRank(levels: readonly Level[]): Level[] {
  return [...levels].sort((a, b) => a.rank - b.rank);
}

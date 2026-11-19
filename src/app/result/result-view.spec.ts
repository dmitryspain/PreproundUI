import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Question } from '../core/models';
import {
  ResultView,
  ResultViewModel,
  ReviewItemView,
  STRONG_FROM_PERCENT,
  TopicBand,
  WEAK_BELOW_PERCENT,
  topicBand,
} from './result-view';

const option = (key: number, isCorrect: boolean, text = `o${key}`) => ({ key, text, isCorrect });

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    topicId: 'topic-a',
    levelId: 'level-a',
    type: 'single',
    text: `Текст ${id}`,
    code: null,
    options: [option(2, false), option(0, true), option(1, false)],
    explanation: `Пояснення ${id}`,
    ...overrides,
  };
}

function item(q: Question, selectedKeys: number[], correct: boolean): ReviewItemView {
  return { question: q, topicTitle: 'Тема А', levelTitle: 'Рівень А', selectedKeys, correct };
}

/** q1 right, q2 wrong, q3 without an answer, q4 right. */
function model(overrides: Partial<ResultViewModel> = {}): ResultViewModel {
  return {
    score: { correct: 2, total: 4, percent: 50 },
    elapsedMs: 125_000,
    topics: [
      { topicId: 'topic-b', title: 'Тема Б', correct: 0, total: 1 },
      { topicId: 'topic-a', title: 'Тема А', correct: 2, total: 3 },
    ],
    review: [
      item(question('q1'), [0], true),
      item(
        question('q2', {
          text: 'Питання <script>alert(1)</script> про `Task`',
          code: { lang: 'csharp', source: 'var xs = new List<int>();\n<b>bold</b>' },
          explanation: 'Бо <img src=x onerror=alert(1)> і `await`',
          options: [option(2, false), option(0, true, '<b>жирний</b>'), option(1, false)],
        }),
        [2],
        false,
      ),
      item(question('q3'), [], false),
      item(question('q4'), [0], true),
    ],
    ...overrides,
  };
}

describe('ResultView', () => {
  let fixture: ComponentFixture<ResultView>;

  async function render(value: ResultViewModel): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ResultView);
    fixture.componentRef.setInput('result', value);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (root: HTMLElement, selector: string) =>
    root.querySelector(selector)?.textContent?.trim();
  const reviewIds = (root: HTMLElement) =>
    [...root.querySelectorAll('.review .meta')].map((el) => el.textContent?.trim());
  const verdicts = (root: HTMLElement) =>
    [...root.querySelectorAll('.review .verdict')].map((el) => el.textContent?.trim());

  async function toggleMistakes(root: HTMLElement): Promise<void> {
    const box = root.querySelector<HTMLInputElement>('input[type=checkbox][role=switch]')!;
    box.click();
    await fixture.whenStable();
  }

  it('shows the percent, "X з Y" and the elapsed time', async () => {
    const root = await render(model());

    expect(text(root, '.percent')).toBe('50%');
    expect(text(root, '.count')).toBe('2 з 4');
    expect(text(root, '.elapsed')).toBe('Витрачений час: 2:05');
  });

  it('formats the time as M:SS and from an hour on as H:MM:SS, by whole seconds', async () => {
    const cases: [number, string][] = [
      [0, '0:00'],
      [59_999, '0:59'],
      [600_000, '10:00'],
      [3_599_000, '59:59'],
      [3_600_000, '1:00:00'],
      [3_725_000, '1:02:05'],
      [6_000_000, '1:40:00'],
    ];
    for (const [elapsedMs, expected] of cases) {
      const root = await render(model({ elapsedMs }));
      expect(text(root, '.elapsed')).toBe(`Витрачений час: ${expected}`);
    }
  });

  it('lists the topics in the given order as "title: correct / total"', async () => {
    const root = await render(model());

    const rows = [...root.querySelectorAll('.topic')].map((row) => [
      row.querySelector('.topic-title')?.textContent?.trim(),
      row.querySelector('.topic-score')?.textContent?.trim(),
    ]);
    expect(rows).toEqual([
      ['Тема Б', '0 / 1'],
      ['Тема А', '2 / 3'],
    ]);
  });

  it('the review shows every question with its number, verdict, the user answer, the correct options and the explanation', async () => {
    const root = await render(model());

    expect(reviewIds(root)).toEqual([
      'Питання 1 · Тема А · Рівень А',
      'Питання 2 · Тема А · Рівень А',
      'Питання 3 · Тема А · Рівень А',
      'Питання 4 · Тема А · Рівень А',
    ]);
    expect(verdicts(root)).toEqual(['Правильно', 'Неправильно', 'Без відповіді', 'Правильно']);

    const wrong = root.querySelectorAll('.review')[1];
    expect(wrong.querySelector('.option.selected.wrong .option-text')?.textContent).toBe('o2');
    expect(wrong.querySelector('.option.selected')?.textContent).toContain('ваша відповідь');
    expect(wrong.querySelector('.option.correct .option-text')?.textContent).toBe('<b>жирний</b>');
    expect(wrong.querySelector('.option.correct')?.textContent).toContain('правильна');
    expect(wrong.querySelector('.explanation')?.textContent).toContain('Бо');

    const unanswered = root.querySelectorAll('.review')[2];
    expect(unanswered.querySelectorAll('.option.selected')).toHaveLength(0);
    expect(unanswered.textContent).not.toContain('ваша відповідь');
    expect(unanswered.querySelector('.option.correct .option-text')?.textContent).toBe('o0');
    expect(unanswered.querySelector('.explanation')?.textContent).toBe('Пояснення q3');
  });

  it('"Лише помилки" keeps only the wrong and the unanswered questions, with their test numbers; off brings all back', async () => {
    const root = await render(model());
    expect(root.querySelector('label.check')?.textContent?.trim()).toBe('Лише помилки (2)');

    await toggleMistakes(root);

    expect(reviewIds(root)).toEqual([
      'Питання 2 · Тема А · Рівень А',
      'Питання 3 · Тема А · Рівень А',
    ]);
    expect(verdicts(root)).toEqual(['Неправильно', 'Без відповіді']);

    await toggleMistakes(root);
    expect(reviewIds(root)).toHaveLength(4);
  });

  it('"Лише помилки" without mistakes says "Помилок немає."', async () => {
    const root = await render(
      model({
        score: { correct: 1, total: 1, percent: 100 },
        review: [item(question('q1'), [0], true)],
      }),
    );
    expect(root.textContent).not.toContain('Помилок немає.');

    await toggleMistakes(root);

    expect(root.querySelectorAll('.review')).toHaveLength(0);
    expect(text(root, '.muted')).toBe('Помилок немає.');
  });

  it('markup from the content shows as text in the question, options and explanation; the code block is <pre><code> text', async () => {
    const root = await render(model());
    const wrong = root.querySelectorAll('.review')[1];

    expect(root.querySelector('script, img, b')).toBeNull();
    expect(wrong.querySelector('.text')?.textContent).toBe(
      'Питання <script>alert(1)</script> про Task',
    );
    expect(wrong.querySelector('.text code')?.textContent).toBe('Task');
    expect(wrong.querySelector('.explanation')?.textContent).toBe(
      'Бо <img src=x onerror=alert(1)> і await',
    );

    const block = wrong.querySelector('pre.code > code')!;
    expect(block.textContent).toBe('var xs = new List<int>();\n<b>bold</b>');
    expect(block.children).toHaveLength(0);
    expect(root.querySelectorAll('pre')).toHaveLength(1);
  });

  it('review: null hides the review and its filter, the summary and topics stay', async () => {
    const root = await render(model({ review: null }));

    expect(text(root, '.percent')).toBe('50%');
    expect(root.querySelectorAll('.topic')).toHaveLength(2);
    expect(root.textContent).not.toContain('Розбір');
    expect(root.querySelector('input[role=switch]')).toBeNull();
    expect(root.querySelectorAll('.review')).toHaveLength(0);
  });

  it('marks topics with 1/3, 2/3 and 5/5 correct as data-band low, mid and high, with bars as wide as the share', async () => {
    const root = await render(
      model({
        topics: [
          { topicId: 'weak', title: 'Слабка', correct: 1, total: 3 },
          { topicId: 'middling', title: 'Середня', correct: 2, total: 3 },
          { topicId: 'strong', title: 'Сильна', correct: 5, total: 5 },
        ],
      }),
    );

    const rows = [...root.querySelectorAll<HTMLElement>('.topic')].map((row) => [
      row.querySelector('.topic-title')?.textContent?.trim(),
      row.dataset['band'],
      row.querySelector<HTMLElement>('.progress-fill')?.style.width,
    ]);
    expect(rows).toEqual([
      ['Слабка', 'low', '33%'],
      ['Середня', 'mid', '67%'],
      ['Сильна', 'high', '100%'],
    ]);
  });
});

describe('topicBand', () => {
  it('puts the bounds at exactly 50 % and 80 %: 1/2 is mid, 4/5 is high, 79/100 is mid, 0/1 is low', () => {
    expect(WEAK_BELOW_PERCENT).toBe(50);
    expect(STRONG_FROM_PERCENT).toBe(80);
    const cases: [number, number, TopicBand][] = [
      [0, 1, 'low'],
      [49, 100, 'low'],
      [1, 3, 'low'],
      [1, 2, 'mid'],
      [50, 100, 'mid'],
      [2, 3, 'mid'],
      [79, 100, 'mid'],
      // 79.5 % rounds to 80 %, but the band follows the exact share.
      [35, 44, 'mid'],
      [4, 5, 'high'],
      [80, 100, 'high'],
      [5, 5, 'high'],
    ];
    for (const [correct, total, band] of cases) {
      expect(topicBand(correct, total), `${correct}/${total}`).toBe(band);
    }
  });
});

import { breakdownByTopic, grade, score } from './grading';
import { Question, Test } from './models';

/** Options come in the shuffled order, so the correct keys are not the first ones. */
function question(
  id: string,
  type: Question['type'],
  correctKeys: number[],
  optionKeys = [2, 0, 3, 1],
): Question {
  return {
    id,
    topicId: 't',
    levelId: 'l',
    type,
    text: id,
    code: null,
    options: optionKeys.map((key) => ({
      key,
      text: `o${key}`,
      isCorrect: correctKeys.includes(key),
    })),
    explanation: '',
  };
}

describe('grade', () => {
  const single = question('s', 'single', [3]);
  const multiple = question('m', 'multiple', [0, 3]);

  it('single: the correct option is right, any other option is wrong', () => {
    expect(grade(single, [3])).toBe(true);
    expect(grade(single, [0])).toBe(false);
    expect(grade(single, [2])).toBe(false);
  });

  it('multiple: only the exact set of correct options is right, whatever the order', () => {
    expect(grade(multiple, [0, 3])).toBe(true);
    expect(grade(multiple, [3, 0])).toBe(true);
  });

  it('multiple: a subset of the correct options is wrong', () => {
    expect(grade(multiple, [0])).toBe(false);
    expect(grade(multiple, [3])).toBe(false);
  });

  it('multiple: a superset of the correct options is wrong', () => {
    expect(grade(multiple, [0, 3, 1])).toBe(false);
    expect(grade(multiple, [2, 0, 3, 1])).toBe(false);
  });

  it('multiple: the same number of options but a different set is wrong', () => {
    expect(grade(multiple, [0, 1])).toBe(false);
  });

  it('no answer (undefined or no keys) is wrong for both types', () => {
    expect(grade(single, undefined)).toBe(false);
    expect(grade(single, [])).toBe(false);
    expect(grade(multiple, undefined)).toBe(false);
    expect(grade(multiple, [])).toBe(false);
  });
});

describe('score', () => {
  const qs = (count: number) =>
    Array.from({ length: count }, (_, i) => question(`q${i}`, 'single', [1]));

  it('2 of 3 correct gives 67 percent (rounded), an unanswered question counts as wrong', () => {
    const test: Test = { questions: qs(3) };

    expect(score(test, { q0: [1], q1: [1] })).toEqual({ correct: 2, total: 3, percent: 67 });
  });

  it('a wrong answer and no answer both count as wrong: 1 of 3 gives 33', () => {
    const test: Test = { questions: qs(3) };

    expect(score(test, { q0: [1], q1: [2] })).toEqual({ correct: 1, total: 3, percent: 33 });
  });

  it('0 of 10 gives 0 percent', () => {
    const test: Test = { questions: qs(10) };

    expect(score(test, { q0: [2], q5: [0] })).toEqual({ correct: 0, total: 10, percent: 0 });
  });

  it('all correct gives 100; answers to questions outside the test are ignored', () => {
    const test: Test = { questions: qs(2) };

    expect(score(test, { q0: [1], q1: [1], other: [1] })).toEqual({
      correct: 2,
      total: 2,
      percent: 100,
    });
  });

  it('an empty test gives 0 percent instead of NaN', () => {
    expect(score({ questions: [] }, {})).toEqual({ correct: 0, total: 0, percent: 0 });
  });

  it('rounds half up: 1 of 8 gives 13 (12.5)', () => {
    const test: Test = { questions: qs(8) };

    expect(score(test, { q0: [1] }).percent).toBe(13);
  });
});

describe('breakdownByTopic', () => {
  /** A single question of `topicId` whose correct key is 1. */
  const q = (id: string, topicId: string, type: Question['type'] = 'single'): Question => ({
    ...question(id, type, type === 'single' ? [1] : [0, 1]),
    topicId,
  });
  const right = [1];
  const wrong = [2];

  it('counts correct / all per topic: a wrong answer and no answer are both wrong', () => {
    // Topics are mixed in the test, as the server shuffles them.
    const test: Test = {
      questions: [q('a1', 'a'), q('b1', 'b'), q('a2', 'a'), q('a3', 'a'), q('b2', 'b')],
    };

    const result = breakdownByTopic(test, { a1: right, a2: wrong, b1: right, b2: right }, [
      'a',
      'b',
    ]);

    expect(result).toEqual([
      { topicId: 'a', correct: 1, total: 3 },
      { topicId: 'b', correct: 2, total: 2 },
    ]);
  });

  it('orders topics from the weakest to the strongest, whatever the setup order', () => {
    const test: Test = {
      questions: [
        q('a1', 'a'),
        q('a2', 'a'),
        q('b1', 'b'),
        q('b2', 'b'),
        q('c1', 'c'),
        q('c2', 'c'),
      ],
    };
    // a: 2/2, b: 0/2, c: 1/2
    const answers = { a1: right, a2: right, b1: wrong, c1: right };

    expect(breakdownByTopic(test, answers, ['a', 'b', 'c']).map((t) => t.topicId)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('equal shares keep the order of the setup, not the order of the questions or the ids', () => {
    // Questions of "z" come first and "z" > "m" > "a" by id, but the setup lists m, a, z.
    const test: Test = {
      questions: [
        q('z1', 'z'),
        q('z2', 'z'),
        q('a1', 'a'),
        q('a2', 'a'),
        q('m1', 'm'),
        q('m2', 'm'),
      ],
    };
    const answers = { z1: right, a2: right, m1: right };

    expect(breakdownByTopic(test, answers, ['m', 'a', 'z']).map((t) => t.topicId)).toEqual([
      'm',
      'a',
      'z',
    ]);
    // 1 of 2 and 2 of 4 are the same share, so the setup order still decides.
    const unequalSizes: Test = {
      questions: [
        q('x1', 'x'),
        q('x2', 'x'),
        q('x3', 'x'),
        q('x4', 'x'),
        q('y1', 'y'),
        q('y2', 'y'),
      ],
    };
    expect(
      breakdownByTopic(unequalSizes, { x1: right, x2: right, y1: right }, ['y', 'x']).map(
        (t) => t.topicId,
      ),
    ).toEqual(['y', 'x']);
  });

  it('a multiple question counts only when the whole set is right', () => {
    const test: Test = { questions: [q('m1', 'a', 'multiple'), q('m2', 'a', 'multiple')] };

    expect(breakdownByTopic(test, { m1: [1, 0], m2: [1] }, ['a'])).toEqual([
      { topicId: 'a', correct: 1, total: 2 },
    ]);
  });

  it('a topic of the setup without questions in the test is not listed; no answers at all gives 0 of N', () => {
    const test: Test = { questions: [q('a1', 'a'), q('a2', 'a')] };

    expect(breakdownByTopic(test, {}, ['inactive', 'a'])).toEqual([
      { topicId: 'a', correct: 0, total: 2 },
    ]);
  });

  it('totals add up to the test and correct answers add up to score()', () => {
    const test: Test = {
      questions: [q('a1', 'a'), q('b1', 'b'), q('c1', 'c'), q('a2', 'a'), q('c2', 'c')],
    };
    const answers = { a1: right, b1: wrong, c2: right };

    const topics = breakdownByTopic(test, answers, ['a', 'b', 'c']);

    expect(topics.reduce((sum, t) => sum + t.total, 0)).toBe(5);
    expect(topics.reduce((sum, t) => sum + t.correct, 0)).toBe(score(test, answers).correct);
  });
});

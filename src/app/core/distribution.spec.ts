import { distribute, distributedCount, maxFor, validate } from './distribution';
import { Topic, TopicShare } from './models';

const maxima = (...max: number[]) => max.map((value) => ({ max: value }));

function topic(questionCounts: Record<string, number>): Topic {
  return { id: 't', title: 'T', description: '', questionCounts };
}

describe('maxFor', () => {
  it('sums the question counts of the selected levels only', () => {
    const counts = topic({ junior: 4, middle: 5, senior: 6 });

    expect(maxFor(counts, ['junior', 'middle', 'senior'])).toBe(15);
    expect(maxFor(counts, ['middle'])).toBe(5);
  });

  it('gives 0 for a topic without questions on the selected levels', () => {
    expect(maxFor(topic({ senior: 6 }), ['junior'])).toBe(0);
    expect(maxFor(topic({}), ['junior', 'senior'])).toBe(0);
  });

  it('counts a level that exists only in the data, without code changes', () => {
    expect(maxFor(topic({ architect: 3, senior: 2 }), ['architect'])).toBe(3);
  });
});

describe('distribute', () => {
  it('splits 30 on 4 topics evenly, the remainder going to the first ones', () => {
    expect(distribute(30, maxima(50, 50, 50, 50))).toEqual([8, 8, 7, 7]);
  });

  it('gives the topic with max 3 its 3 and the rest to the other topic', () => {
    expect(distribute(20, maxima(3, 17))).toEqual([3, 17]);
    expect(distribute(20, maxima(3, 40))).toEqual([3, 17]);
  });

  it('passes what does not fit into a capped topic on to the topics with room left', () => {
    expect(distribute(20, maxima(2, 12, 12))).toEqual([2, 9, 9]);
  });

  it('gives at least 1 to every active topic when the total allows it', () => {
    const counts = distribute(10, maxima(1, 1, 1, 1, 1, 1, 1, 1, 1, 40));

    expect(counts.every((count) => count >= 1)).toBe(true);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(10);
  });

  it('skips inactive topics: 20 on maxima [12,0,12,12] gives [7,0,7,6]', () => {
    expect(distribute(20, maxima(12, 0, 12, 12))).toEqual([7, 0, 7, 6]);
  });

  it('gives every topic its max when all maxima together are below the total', () => {
    expect(distribute(20, maxima(4, 0, 4, 4))).toEqual([4, 0, 4, 4]);
  });

  it('gives 0 to every topic when none is active', () => {
    expect(distribute(20, maxima(0, 0))).toEqual([0, 0]);
    expect(distribute(20, [])).toEqual([]);
  });
});

describe('validate', () => {
  const shares = (...pairs: [max: number, count: number][]): TopicShare[] =>
    pairs.map(([max, count]) => ({ max, count }));

  it('accepts a full and correct distribution, including the limits 10 and 100', () => {
    expect(validate({ total: 20, topics: shares([12, 7], [12, 7], [12, 6]) })).toBe(true);
    expect(validate({ total: 10, topics: shares([12, 10]) })).toBe(true);
    expect(validate({ total: 100, topics: shares([60, 50], [60, 50]) })).toBe(true);
  });

  it('rejects a total of 9 and of 101', () => {
    expect(validate({ total: 9, topics: shares([12, 9]) })).toBe(false);
    expect(validate({ total: 101, topics: shares([60, 51], [60, 50]) })).toBe(false);
  });

  it('rejects a distribution whose sum differs from the total', () => {
    expect(validate({ total: 20, topics: shares([12, 7], [12, 7], [12, 5]) })).toBe(false);
    expect(validate({ total: 20, topics: shares([12, 7], [12, 7], [12, 7]) })).toBe(false);
  });

  it('rejects a topic above its max even when the sum matches', () => {
    expect(validate({ total: 20, topics: shares([12, 13], [12, 1], [12, 6]) })).toBe(false);
  });

  it('rejects an active topic with 0 questions', () => {
    expect(validate({ total: 20, topics: shares([12, 10], [12, 10], [12, 0]) })).toBe(false);
  });

  it('ignores an inactive topic with 0 questions', () => {
    expect(validate({ total: 20, topics: shares([12, 10], [0, 0], [12, 10]) })).toBe(true);
  });

  it('rejects a setup without any active topic', () => {
    expect(validate({ total: 20, topics: shares([0, 0], [0, 0]) })).toBe(false);
    expect(validate({ total: 20, topics: [] })).toBe(false);
  });

  it('counts only active topics in "Розподілено X"', () => {
    expect(distributedCount(shares([4, 4], [0, 0], [4, 3]))).toBe(7);
  });
});

import { Topic, TopicShare } from './models';

/** Limits of the total number of questions (spec 3.1, item 4); the API checks the same range. */
export const MIN_QUESTIONS = 10;
export const MAX_QUESTIONS = 100;
export const DEFAULT_QUESTIONS = 20;

/** Active questions of the topic on the selected levels: the most it can get in the test. */
export function maxFor(topic: Topic, levelIds: readonly string[]): number {
  let max = 0;
  for (const levelId of new Set(levelIds)) {
    max += topic.questionCounts[levelId] ?? 0;
  }
  return max;
}

/** A topic without questions on the selected levels takes no part in the distribution, the request or validation. */
export function isActive(topic: { max: number }): boolean {
  return topic.max > 0;
}

/**
 * Splits `total` evenly between the active topics, the remainder going to the first ones (30 on 4 → 8/8/7/7).
 * A topic never gets more than its `max`: whatever does not fit goes to the topics with room left.
 * Inactive topics get 0. When all maxima together are below `total`, every active topic gets its `max`.
 */
export function distribute(total: number, topics: readonly { max: number }[]): number[] {
  const counts = topics.map(() => 0);
  let open = topics.map((_, index) => index).filter((index) => isActive(topics[index]));
  let remaining = Math.max(0, Math.floor(total));

  while (open.length > 0 && remaining > 0) {
    const base = Math.floor(remaining / open.length);
    const extra = remaining % open.length;
    const fair = (position: number) => base + (position < extra ? 1 : 0);

    // Topics too small for their fair share are filled up and leave; the rest is shared again among the others.
    const capped = open.filter((index, position) => topics[index].max < fair(position));
    if (capped.length === 0) {
      open.forEach((index, position) => (counts[index] = fair(position)));
      break;
    }
    for (const index of capped) {
      counts[index] = topics[index].max;
      remaining -= topics[index].max;
    }
    open = open.filter((index) => !capped.includes(index));
  }

  return counts;
}

/** Questions given to the active topics: X in "Розподілено X з Y". */
export function distributedCount(topics: readonly TopicShare[]): number {
  return topics.filter(isActive).reduce((sum, topic) => sum + topic.count, 0);
}

/** All the questions the active topics have on the selected levels. */
export function availableCount(topics: readonly { max: number }[]): number {
  return topics.filter(isActive).reduce((sum, topic) => sum + topic.max, 0);
}

/**
 * Whether the test can start (spec 3.1, item 5): the total is within limits, at least one topic is active,
 * every active topic has from 1 to its `max` questions, and they add up to the total. Inactive topics are ignored.
 */
export function validate(setup: { total: number; topics: readonly TopicShare[] }): boolean {
  const { total, topics } = setup;
  if (!Number.isInteger(total) || total < MIN_QUESTIONS || total > MAX_QUESTIONS) {
    return false;
  }

  const active = topics.filter(isActive);
  return (
    active.length > 0 &&
    active.every(
      (topic) => Number.isInteger(topic.count) && topic.count >= 1 && topic.count <= topic.max,
    ) &&
    distributedCount(active) === total
  );
}

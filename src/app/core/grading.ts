import { Answers, Question, Score, Test, TopicScore } from './models';

/**
 * Whether the answer is correct (spec 3.3): the selected keys must match the correct ones exactly.
 * For `single` that is the one correct option; for `multiple` there is no partial credit,
 * so a subset or a superset of the correct options is wrong. No answer is wrong.
 */
export function grade(question: Question, selectedKeys: readonly number[] | undefined): boolean {
  const selected = new Set(selectedKeys ?? []);
  const correct = question.options.filter((option) => option.isCorrect).map((option) => option.key);
  return (
    selected.size > 0 &&
    selected.size === correct.length &&
    correct.every((key) => selected.has(key))
  );
}

/** Correct answers out of all the questions of the test; an unanswered question counts as wrong. */
export function score(test: Test, answers: Answers): Score {
  const total = test.questions.length;
  const correct = test.questions.filter((question) => grade(question, answers[question.id])).length;
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct * 100) / total) };
}

/**
 * Correct answers by topic, weakest first (spec 3.4): ordered by the exact share of correct answers,
 * ties keep the order of `topicOrder` (the topics of the setup). Only topics with questions in the test
 * are listed; a topic missing from `topicOrder` goes after the others, in the order it first appears.
 */
export function breakdownByTopic(
  test: Test,
  answers: Answers,
  topicOrder: readonly string[],
): TopicScore[] {
  const byTopic = new Map<string, TopicScore>();
  for (const topicId of topicOrder) {
    byTopic.set(topicId, { topicId, correct: 0, total: 0 });
  }
  for (const question of test.questions) {
    let topic = byTopic.get(question.topicId);
    if (!topic) {
      topic = { topicId: question.topicId, correct: 0, total: 0 };
      byTopic.set(question.topicId, topic);
    }
    topic.total++;
    if (grade(question, answers[question.id])) {
      topic.correct++;
    }
  }

  // Cross-multiplied, so 33 of 100 sorts before 1 of 3; the sort is stable, so ties keep the map order.
  return [...byTopic.values()]
    .filter((topic) => topic.total > 0)
    .sort((a, b) => a.correct * b.total - b.correct * a.total);
}

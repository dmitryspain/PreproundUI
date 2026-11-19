/** Result of the API health check: any failure (no answer, error status, unexpected body) is `unavailable`. */
export type ApiStatus = 'available' | 'unavailable';

/** A failed API call; `message` is already the text to show to the user. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Active catalog (spec 5.1). All of it comes from content: the app knows no field, level or topic by name. */
export interface Catalog {
  fields: Field[];
}

export interface Field {
  id: string;
  title: string;
  /** The field's scale, from the lowest level to the highest. */
  levels: Level[];
  directions: Direction[];
  /** Every active topic of the field in the server's order (by title); the client does not re-sort them. */
  topics: Topic[];
}

export interface Level {
  id: string;
  title: string;
  /** 1-based position in the scale. */
  rank: number;
}

export interface Direction {
  id: string;
  title: string;
  stacks: Stack[];
}

export interface Stack {
  id: string;
  title: string;
  /** Default topics of the stack, in file order. */
  topicIds: string[];
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  /** Active questions by level id; a level without questions is absent. */
  questionCounts: Record<string, number>;
}

/** Body of `POST /api/tests` (spec 5.2). */
export interface TestRequest {
  fieldId: string;
  levelIds: string[];
  topics: TestTopicRequest[];
  excludeQuestionIds: string[];
}

export interface TestTopicRequest {
  topicId: string;
  count: number;
}

/** A generated test with correct answers and explanations: the client grades it itself (ADR 001). */
export interface Test {
  /** Already shuffled across topics. */
  questions: Question[];
}

export type QuestionType = 'single' | 'multiple';

export interface Question {
  id: string;
  topicId: string;
  levelId: string;
  type: QuestionType;
  text: string;
  code: QuestionCode | null;
  /** Shuffled by the server and shown in this order. */
  options: QuestionOption[];
  explanation: string;
}

export interface QuestionCode {
  lang: string;
  source: string;
}

export interface QuestionOption {
  /** 0-based index of the option in the content file; it survives the shuffle. */
  key: number;
  text: string;
  isCorrect: boolean;
}

/** Share of one topic in the distribution; `max` is 0 for a topic without questions on the selected levels. */
export interface TopicShare {
  max: number;
  count: number;
}

export interface SetupTopic extends TopicShare {
  topicId: string;
}

/** What the user chose on the setup page (spec 3.1). */
export interface TestSetup {
  fieldId: string;
  /** In scale order. */
  levelIds: string[];
  /** Total number of questions in the test. */
  total: number;
  /** In the order shown on the page, inactive topics included. */
  topics: SetupTopic[];
  timerEnabled: boolean;
}

/**
 * Selected option keys by question id. A question that is missing or has no keys has no answer;
 * the keys are compared as a set, so their order does not matter.
 */
export type Answers = Readonly<Record<string, readonly number[]>>;

/** Overall result of a test (spec 3.3). */
export interface Score {
  correct: number;
  total: number;
  /** `correct / total` in percent, rounded to an integer; 0 for an empty test. */
  percent: number;
}

/** Result of one topic of a test (spec 3.4). */
export interface TopicScore {
  topicId: string;
  correct: number;
  total: number;
}

/** A finished test: what `/result` shows. */
export interface TestResult {
  answers: Answers;
  /** Whether each question of the test was answered correctly, by question id. */
  grades: Readonly<Record<string, boolean>>;
  score: Score;
  /** From the start of the test to its end; never more than the timer allows. */
  elapsedMs: number;
}

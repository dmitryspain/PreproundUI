import type { Message } from './types';
import type { MessageKey } from './uk';

/** English. Typed against the Ukrainian keys: a missing or an extra key fails the build. */
export const en: Record<MessageKey, Message> = {
  /* ---- shell ---- */
  'common.loading': 'Loading…',
  'nav.settings': 'Settings',

  /* ---- languages: each in its own language, the same in every dictionary ---- */
  'language.uk': 'Українська',
  'language.en': 'English',

  /* ---- setup (/) ---- */
  'setup.eyebrow': 'Interview preparation',
  'setup.title': 'Test setup',
  'setup.stackStep.title': 'Track and stack',
  'setup.stackStep.sub': 'A stack fills in its own topics, and you can add any other topic.',
  'setup.field': 'Field',
  'setup.direction': 'Track',
  'setup.directionPlaceholder': 'Choose a track',
  'setup.stack': 'Stack',
  'setup.stackPlaceholder': 'Choose a stack',
  'setup.levelsStep.title': 'Levels',
  'setup.levelsStep.sub': 'One or more.',
  'setup.topicsStep.title': 'Questions and topics',
  'setup.topicsStep.sub': 'Split evenly between topics; you can change any of them by hand.',
  'setup.total': 'Number of questions',
  'setup.totalRange': {
    one: 'Between {min} and {n} question.',
    other: 'Between {min} and {n} questions.',
  },
  'setup.topicMax': 'max {max}',
  'setup.topicNone': '0 questions',
  'setup.topicCount': 'Questions from {topic}',
  'setup.removeTopic': 'Remove topic {topic}',
  'setup.noTopics': 'Choose a stack or add a topic.',
  'setup.addTopic': 'Add topic',
  'setup.searchPlaceholder': 'Search by name',
  'setup.searchLabel': 'Search topics by name',
  'setup.nothingFound': 'Nothing found.',
  'setup.distributed': 'Distributed **{distributed}** of {total}',
  'setup.notEnough': {
    one: 'Add more topics or levels ({n} question available).',
    other: 'Add more topics or levels ({n} questions available).',
  },
  'setup.timerOn': 'Timer: {minutes} min',
  'setup.timerOff': 'Timer: off',
  'setup.timerSub':
    'One timer for the whole test. When time runs out, unanswered questions count as wrong.',
  'setup.start': 'Start',
  'setup.emptyCatalog': 'The catalog is empty.',
  'setup.slowCatalog': 'The server is waking up after being idle, which can take up to a minute.',

  /* ---- test (/test) ---- */
  'test.timeLeft': '{time} left',
  'test.options': 'Answer options',
  'test.multiple': 'Select all that apply',
  'test.check': 'Check',
  'test.previous': 'Previous',
  'test.next': 'Next',
  'test.grid': 'Test questions',
  'test.cell': 'Question {number}: {state}',
  'test.state.unanswered': 'not answered',
  'test.state.answered': 'answered',
  'test.state.correct': 'checked, correct',
  'test.state.incorrect': 'checked, incorrect',
  'test.confirm': {
    one: '{n} question has no answer and will count as wrong. Finish the test?',
    other: '{n} questions have no answer and will count as wrong. Finish the test?',
  },
  'test.confirmFinish': 'Finish',
  'test.continue': 'Continue test',
  'test.finish': 'Finish test',

  /* ---- answers and verdicts (/test and /result) ---- */
  'answer.correct': 'correct',
  'answer.yours': 'your answer',
  'verdict.correct': 'Correct',
  'verdict.incorrect': 'Incorrect',
  'verdict.unanswered': 'Not answered',

  /* ---- result (/result) ---- */
  'result.eyebrow': 'Test complete',
  'result.title': 'Result',
  'result.retry': 'Retake with the same settings',
  'result.newSetup': 'Set up a new test',
  'result.score': '{correct} of {total}',
  'result.elapsed': 'Time spent: {time}',
  'result.topics.title': 'Topics',
  'result.topics.sub': 'From the weakest to the strongest.',
  'result.review': 'Review',
  'result.onlyMistakes': 'Only mistakes ({n})',
  'result.questionMeta': 'Question {number} · {topic} · {level}',
  'result.noMistakes': 'No mistakes.',

  /* ---- settings (/settings) ---- */
  'settings.eyebrow': 'Personalization',
  'settings.title': 'Settings',
  'settings.savedOnDevice': 'Saved on this device only.',
  'settings.language.title': 'Language',
  'settings.theme.title': 'Theme',
  'settings.accent.title': 'Accent color',
  'settings.accent.sub':
    'The color of buttons and highlights. The theme sets its brightness, so text stays readable.',
  'settings.accent.reset': 'Theme color',
  'settings.accent.hue': 'Accent hue',

  /* ---- themes (names Aurora, Daylight, Terminal are brand names in core/themes.ts) ---- */
  'theme.aurora.description': 'Dark glass with a living gradient glow',
  'theme.daylight.description': 'Light, clean and precise',
  'theme.terminal.description': 'A monospace terminal with a phosphor glow',
  'theme.auto.name': 'Auto',
  'theme.auto.description': 'Follows the system: Aurora when dark, Daylight when light',

  /* ---- accent presets, by ACCENT_PRESETS id ---- */
  'accent.violet': 'Violet',
  'accent.indigo': 'Indigo',
  'accent.sky': 'Sky blue',
  'accent.emerald': 'Emerald',
  'accent.lime': 'Lime',
  'accent.amber': 'Amber',
  'accent.coral': 'Coral',
  'accent.raspberry': 'Raspberry',

  /* ---- API errors, by status and code (i18n/errors.ts) ---- */
  'errors.catalogChanged':
    'The catalog has been updated. Reload the page and check the distribution.',
  'errors.rejected': 'The server rejected the test settings.',
  'errors.tooManyRequests': 'Too many requests. Try again in a minute.',
  'errors.network': 'Could not reach the server.',
  'errors.server': 'The server could not process the request. Try again later.',
};

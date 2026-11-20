import type { Message } from './types';

/**
 * Ukrainian: the source dictionary. Its keys define `MessageKey`, and `en.ts` must have exactly the same keys
 * (a missing or an extra one fails the build). `{name}` marks a parameter, `**text**` marks bold (`richParts`),
 * and a message with plural forms is read through `translatePlural`, which fills `{n}`.
 */
export const uk = {
  /* ---- shell ---- */
  'common.loading': 'Завантаження…',
  'nav.settings': 'Налаштування',

  /* ---- languages: each in its own language, the same in every dictionary ---- */
  'language.uk': 'Українська',
  'language.en': 'English',

  /* ---- setup (/) ---- */
  'setup.eyebrow': 'Підготовка до співбесіди',
  'setup.title': 'Налаштування тесту',
  'setup.stackStep.title': 'Напрям і стек',
  'setup.stackStep.sub': 'Стек підставить свої теми, а додати можна будь-яку.',
  'setup.field': 'Галузь',
  'setup.direction': 'Напрям',
  'setup.directionPlaceholder': 'Виберіть напрям',
  'setup.stack': 'Стек',
  'setup.stackPlaceholder': 'Виберіть стек',
  'setup.levelsStep.title': 'Рівні',
  'setup.levelsStep.sub': 'Один або кілька.',
  'setup.topicsStep.title': 'Питання й теми',
  'setup.topicsStep.sub': 'Порівну між темами, кожну можна змінити вручну.',
  'setup.total': 'Кількість питань',
  'setup.totalRange': {
    one: 'Від {min} до {n} питання.',
    few: 'Від {min} до {n} питань.',
    many: 'Від {min} до {n} питань.',
    other: 'Від {min} до {n} питання.',
  },
  'setup.topicMax': 'макс. {max}',
  'setup.topicNone': '0 питань',
  'setup.topicCount': 'Питань з теми {topic}',
  'setup.removeTopic': 'Прибрати тему {topic}',
  'setup.noTopics': 'Виберіть стек або додайте тему.',
  'setup.addTopic': 'Додати тему',
  'setup.searchPlaceholder': 'Пошук за назвою',
  'setup.searchLabel': 'Пошук теми за назвою',
  'setup.nothingFound': 'Нічого не знайдено.',
  'setup.distributed': 'Розподілено **{distributed}** з {total}',
  'setup.notEnough': 'Додайте тем або рівнів (доступно питань: {n}).',
  'setup.timerOn': 'Таймер: {minutes} хв',
  'setup.timerOff': 'Таймер: вимкнено',
  'setup.timerSub':
    'Один на весь тест. Коли час вийде, питання без відповіді стануть неправильними.',
  'setup.start': 'Почати',
  'setup.emptyCatalog': 'Каталог порожній.',
  'setup.slowCatalog': 'Сервер прокидається після простою — це може тривати до хвилини.',

  /* ---- test (/test) ---- */
  'test.timeLeft': 'Залишилось {time}',
  'test.options': 'Варіанти відповіді',
  'test.multiple': 'Кілька правильних відповідей',
  'test.check': 'Перевірити',
  'test.previous': 'Назад',
  'test.next': 'Далі',
  'test.grid': 'Питання тесту',
  'test.cell': 'Питання {number}: {state}',
  'test.state.unanswered': 'без відповіді',
  'test.state.answered': 'з відповіддю',
  'test.state.correct': 'перевірено, правильно',
  'test.state.incorrect': 'перевірено, неправильно',
  'test.confirm': 'Питань без відповіді: {n}. Вони зарахуються як неправильні. Завершити тест?',
  'test.confirmFinish': 'Завершити',
  'test.continue': 'Продовжити тест',
  'test.finish': 'Завершити тест',

  /* ---- answers and verdicts (/test and /result) ---- */
  'answer.correct': 'правильна',
  'answer.yours': 'ваша відповідь',
  'verdict.correct': 'Правильно',
  'verdict.incorrect': 'Неправильно',
  'verdict.unanswered': 'Без відповіді',

  /* ---- result (/result) ---- */
  'result.eyebrow': 'Тест завершено',
  'result.title': 'Результат',
  'result.retry': 'Пройти ще раз з тими самими налаштуваннями',
  'result.newSetup': 'Нові налаштування',
  'result.score': '{correct} з {total}',
  'result.elapsed': 'Витрачений час: {time}',
  'result.topics.title': 'Теми',
  'result.topics.sub': 'Від найслабшої до найсильнішої.',
  'result.review': 'Розбір',
  'result.onlyMistakes': 'Лише помилки ({n})',
  'result.questionMeta': 'Питання {number} · {topic} · {level}',
  'result.noMistakes': 'Помилок немає.',

  /* ---- settings (/settings) ---- */
  'settings.eyebrow': 'Персоналізація',
  'settings.title': 'Налаштування',
  'settings.savedOnDevice': 'Зберігається лише на цьому пристрої.',
  'settings.language.title': 'Мова',
  'settings.theme.title': 'Тема оформлення',
  'settings.accent.title': 'Акцентний колір',
  'settings.accent.sub':
    'Колір кнопок і виділень. Яскравість підбирає тема, тож текст лишається читабельним.',
  'settings.accent.reset': 'Колір теми',
  'settings.accent.hue': 'Відтінок акценту',

  /* ---- themes (names Aurora, Daylight, Terminal are brand names in core/themes.ts) ---- */
  'theme.aurora.description': 'Темна скляна, з живим градієнтним сяйвом',
  'theme.daylight.description': 'Світла, чиста й точна',
  'theme.terminal.description': 'Моноширинний термінал із фосфорним сяйвом',
  'theme.auto.name': 'Авто',
  'theme.auto.description': 'Як у системі: темна — Aurora, світла — Daylight',

  /* ---- accent presets, by ACCENT_PRESETS id ---- */
  'accent.violet': 'Фіалковий',
  'accent.indigo': 'Індиго',
  'accent.sky': 'Блакитний',
  'accent.emerald': 'Смарагд',
  'accent.lime': 'Лайм',
  'accent.amber': 'Бурштин',
  'accent.coral': 'Кораловий',
  'accent.raspberry': 'Малиновий',

  /* ---- API errors, by status and code (i18n/errors.ts) ---- */
  'errors.catalogChanged': 'Каталог оновився. Оновіть сторінку й перевірте розподіл.',
  'errors.rejected': 'Сервер відхилив налаштування тесту.',
  'errors.tooManyRequests': 'Забагато запитів. Спробуйте за хвилину.',
  'errors.network': "Не вдалося зв'язатися із сервером.",
  'errors.server': 'Сервер не зміг обробити запит. Спробуйте пізніше.',
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof uk;

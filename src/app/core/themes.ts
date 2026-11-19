/** A theme of the interface: a set of tokens under `[data-theme="…"]` in `src/styles/_themes.scss`. */
export type ThemeId = 'aurora' | 'daylight' | 'terminal';

/** What the user picks: a theme, or `auto` to follow the dark or light setting of the system. */
export type ThemeChoice = ThemeId | 'auto';

export interface ThemeInfo {
  id: ThemeId;
  /** In Latin letters, as a brand name. */
  name: string;
  description: string;
  scheme: 'dark' | 'light';
}

export const THEMES: readonly ThemeInfo[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Темна скляна, з живим градієнтним сяйвом',
    scheme: 'dark',
  },
  { id: 'daylight', name: 'Daylight', description: 'Світла, чиста й точна', scheme: 'light' },
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Моноширинний термінал із фосфорним сяйвом',
    scheme: 'dark',
  },
];

/** What `auto` resolves to for a dark / light system (`public/theme-init.js` repeats this). */
export const AUTO_DARK: ThemeId = 'aurora';
export const AUTO_LIGHT: ThemeId = 'daylight';

/** `auto` as an option of the theme picker, next to {@link THEMES}. */
export const AUTO_THEME = {
  id: 'auto',
  name: 'Авто',
  description: 'Як у системі: темна — Aurora, світла — Daylight',
} as const satisfies { id: ThemeChoice; name: string; description: string };

/** Accent hues (OKLCH hue angle). Lightness and chroma come from the active theme. */
export const ACCENT_PRESETS: readonly { name: string; hue: number }[] = [
  { name: 'Фіалковий', hue: 285 },
  { name: 'Індиго', hue: 265 },
  { name: 'Блакитний', hue: 225 },
  { name: 'Смарагд', hue: 160 },
  { name: 'Лайм', hue: 120 },
  { name: 'Бурштин', hue: 75 },
  { name: 'Кораловий', hue: 28 },
  { name: 'Малиновий', hue: 350 },
];

/**
 * The theme's own accent hue, used to position the hue slider when the user has not picked one.
 * Mirrors `--accent-h-default` of each theme in `src/styles/_themes.scss`: keep the two in sync.
 */
export const DEFAULT_HUES: Readonly<Record<ThemeId, number>> = {
  aurora: 285,
  daylight: 265,
  terminal: 148,
};

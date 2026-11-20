import type { MessageKey } from './i18n/messages/uk';

/** A theme of the interface: a set of tokens under `[data-theme="…"]` in `src/styles/_themes.scss`. */
export type ThemeId = 'aurora' | 'daylight' | 'terminal';

/** What the user picks: a theme, or `auto` to follow the dark or light setting of the system. */
export type ThemeChoice = ThemeId | 'auto';

export interface ThemeInfo {
  id: ThemeId;
  /** In Latin letters, as a brand name: the same in every language. */
  name: string;
  descriptionKey: MessageKey;
  scheme: 'dark' | 'light';
}

export const THEMES: readonly ThemeInfo[] = [
  { id: 'aurora', name: 'Aurora', descriptionKey: 'theme.aurora.description', scheme: 'dark' },
  {
    id: 'daylight',
    name: 'Daylight',
    descriptionKey: 'theme.daylight.description',
    scheme: 'light',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    descriptionKey: 'theme.terminal.description',
    scheme: 'dark',
  },
];

/** What `auto` resolves to for a dark / light system (`public/theme-init.js` repeats this). */
export const AUTO_DARK: ThemeId = 'aurora';
export const AUTO_LIGHT: ThemeId = 'daylight';

/** `auto` as an option of the theme picker, next to {@link THEMES}; unlike a theme, its name is translated. */
export const AUTO_THEME = {
  id: 'auto',
  nameKey: 'theme.auto.name',
  descriptionKey: 'theme.auto.description',
} as const satisfies { id: ThemeChoice; nameKey: MessageKey; descriptionKey: MessageKey };

/** Stable id of an accent preset; its name in each language is `accent.<id>` in the dictionaries. */
export type AccentId =
  'violet' | 'indigo' | 'sky' | 'emerald' | 'lime' | 'amber' | 'coral' | 'raspberry';

/** Accent hues (OKLCH hue angle). Lightness and chroma come from the active theme. */
export const ACCENT_PRESETS: readonly { id: AccentId; hue: number }[] = [
  { id: 'violet', hue: 285 },
  { id: 'indigo', hue: 265 },
  { id: 'sky', hue: 225 },
  { id: 'emerald', hue: 160 },
  { id: 'lime', hue: 120 },
  { id: 'amber', hue: 75 },
  { id: 'coral', hue: 28 },
  { id: 'raspberry', hue: 350 },
];

/** Dictionary key of the accent's name. */
export function accentNameKey(id: AccentId): `accent.${AccentId}` {
  return `accent.${id}`;
}

/**
 * The theme's own accent hue, used to position the hue slider when the user has not picked one.
 * Mirrors `--accent-h-default` of each theme in `src/styles/_themes.scss`: keep the two in sync.
 */
export const DEFAULT_HUES: Readonly<Record<ThemeId, number>> = {
  aurora: 285,
  daylight: 265,
  terminal: 148,
};

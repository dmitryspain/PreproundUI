import { LanguageId, currentLanguage } from './languages';
import { en } from './messages/en';
import type { Message, PluralMessage } from './messages/types';
import { uk } from './messages/uk';
import type { MessageKey } from './messages/uk';

export type { MessageKey };
export type Params = Readonly<Record<string, string | number>>;

const DICTIONARIES: Readonly<Record<LanguageId, Readonly<Record<MessageKey, Message>>>> = {
  uk,
  en,
};

function fill(text: string, params?: Params): string {
  return params
    ? text.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in params ? String(params[name]) : whole,
      )
    : text;
}

/** The message in the language on screen. Reads the language signal, so it is reactive wherever it is called. */
export function translate(key: MessageKey, params?: Params): string {
  const message = DICTIONARIES[currentLanguage()][key] as Message | undefined;
  if (message === undefined) {
    // An unknown key shows itself, which is easy to spot.
    return key;
  }
  return fill(typeof message === 'string' ? message : message.other, params);
}

const pluralRules = new Map<LanguageId, Intl.PluralRules>();

/** Picks the plural form for `n` (Ukrainian has one/few/many, English one/other) and fills `{n}`. */
export function translatePlural(key: MessageKey, n: number, params?: Params): string {
  const language = currentLanguage();
  const message = DICTIONARIES[language][key] as Message | undefined;
  if (message === undefined) {
    return key;
  }
  let rules = pluralRules.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(language);
    pluralRules.set(language, rules);
  }
  const form =
    typeof message === 'string'
      ? message
      : ((message as PluralMessage & Partial<Record<Intl.LDMLPluralRule, string>>)[
          rules.select(n)
        ] ?? message.other);
  return fill(form, { ...params, n });
}

export interface RichPart {
  text: string;
  bold: boolean;
}

/** Splits `**bold**` markup into parts, so a template can wrap them in `<strong>` without `innerHTML`. */
export function richParts(key: MessageKey, params?: Params): RichPart[] {
  return translate(key, params)
    .split('**')
    .map((text, index) => ({ text, bold: index % 2 === 1 }))
    .filter((part) => part.text !== '');
}

/** A message with plural forms (`Intl.PluralRules` categories); `{n}` is replaced by the number. */
export interface PluralMessage {
  one: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralMessage;

import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18n } from './i18n.service';
import { MessageKey, Params, RichPart, richParts, translate, translatePlural } from './translate';

/*
 * These pipes are deliberately impure: they read the language signal while the template runs, which is what
 * makes the whole interface follow a switch (a pure pipe would keep the old text until its inputs change).
 * Each one injects I18n, so the saved or browser language is resolved before the first text is read,
 * even on a page rendered without the shell (a component test).
 */

/** `{{ 'setup.title' | t }}` · `{{ 'result.score' | t: { correct: 7, total: 10 } }}` */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  constructor() {
    inject(I18n);
  }

  transform(key: MessageKey, params?: Params): string {
    return translate(key, params);
  }
}

/** `{{ count | tp: 'setup.notEnough' }}`: the plural form for `count`, which fills `{n}`. */
@Pipe({ name: 'tp', pure: false })
export class TpPipe implements PipeTransform {
  constructor() {
    inject(I18n);
  }

  transform(n: number, key: MessageKey, params?: Params): string {
    return translatePlural(key, n, params);
  }
}

/** `@for (part of 'setup.distributed' | rich: params; track $index) { … }`: a text with `**bold**` parts. */
@Pipe({ name: 'rich', pure: false })
export class RichPipe implements PipeTransform {
  constructor() {
    inject(I18n);
  }

  transform(key: MessageKey, params?: Params): RichPart[] {
    return richParts(key, params);
  }
}

export const I18N_PIPES = [TPipe, TpPipe, RichPipe] as const;

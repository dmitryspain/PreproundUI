import { Injectable, inject } from '@angular/core';
import { PrefsService } from '../prefs.service';
import { LANGUAGES, LanguageId } from './languages';

/**
 * The language of the interface for components: which one is on screen, which ones this build offers,
 * and the switch. Texts themselves are read through the `t` pipe or `translate()`, which follow it.
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly prefs = inject(PrefsService);

  readonly language = this.prefs.language;
  /** In the order of the switch; with a single language there is no switch. */
  readonly languages = inject(LANGUAGES);

  /** A language this build does not offer is ignored. */
  setLanguage(id: LanguageId): void {
    this.prefs.setLanguage(id);
  }
}

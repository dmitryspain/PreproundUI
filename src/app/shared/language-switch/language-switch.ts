import { Component, computed, inject } from '@angular/core';
import { I18n } from '../../core/i18n/i18n.service';
import { languageNameKey } from '../../core/i18n/languages';
import { TPipe } from '../../core/i18n/pipes';

/**
 * The language switch of the header: one button named, in its own language, after the language it switches to
 * (ADR 006: no "UK" / "UA" marks, they read as countries). With two languages that is the other one;
 * with more it is the next in the order of `LANGUAGES`. A single-language build shows nothing.
 */
@Component({
  imports: [TPipe],
  selector: 'app-language-switch',
  styleUrl: './language-switch.scss',
  templateUrl: './language-switch.html',
})
export class LanguageSwitch {
  private readonly i18n = inject(I18n);

  protected readonly next = computed(() => {
    const languages = this.i18n.languages;
    if (languages.length < 2) {
      return null;
    }
    const id = languages[(languages.indexOf(this.i18n.language()) + 1) % languages.length];
    return { id, name: languageNameKey(id) };
  });

  protected toggle(): void {
    const next = this.next();
    if (next) {
      this.i18n.setLanguage(next.id);
    }
  }
}

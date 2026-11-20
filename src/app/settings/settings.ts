import { Component, computed, inject } from '@angular/core';
import { I18n } from '../core/i18n/i18n.service';
import { languageNameKey } from '../core/i18n/languages';
import { TPipe } from '../core/i18n/pipes';
import { translate } from '../core/i18n/translate';
import { PrefsService } from '../core/prefs.service';
import {
  ACCENT_PRESETS,
  AUTO_THEME,
  DEFAULT_HUES,
  THEMES,
  ThemeChoice,
  accentNameKey,
} from '../core/themes';
import { ThemePreview } from '../shared/theme-preview/theme-preview';

/** An option of the theme picker: one of the themes or `auto`. */
interface ThemeOption {
  id: ThemeChoice;
  name: string;
  description: string;
}

/** `/settings`: the language, the theme and the accent of the interface, kept on this device. */
@Component({
  imports: [ThemePreview, TPipe],
  selector: 'app-settings',
  styleUrl: './settings.scss',
  templateUrl: './settings.html',
})
export class Settings {
  protected readonly prefs = inject(PrefsService);
  protected readonly i18n = inject(I18n);

  /** Every language of the build, each named in its own language; empty with a single one (no switch then). */
  protected readonly languages =
    this.i18n.languages.length > 1
      ? this.i18n.languages.map((id) => ({ id, name: languageNameKey(id) }))
      : [];

  /** `translate()` reads the language signal, so the lists are rebuilt after a switch. */
  protected readonly themes = computed((): readonly ThemeOption[] => [
    ...THEMES.map((theme) => ({
      id: theme.id,
      name: theme.name,
      description: translate(theme.descriptionKey),
    })),
    {
      id: AUTO_THEME.id,
      name: translate(AUTO_THEME.nameKey),
      description: translate(AUTO_THEME.descriptionKey),
    },
  ]);
  protected readonly accents = computed(() =>
    ACCENT_PRESETS.map((preset) => ({ ...preset, name: translate(accentNameKey(preset.id)) })),
  );

  /** Without a picked accent the slider stands at the hue of the theme on screen. */
  protected readonly hue = computed(
    () => this.prefs.accent() ?? DEFAULT_HUES[this.prefs.resolvedTheme()],
  );

  /** The new theme grows out of the clicked card. */
  protected pickTheme(choice: ThemeChoice, event: MouseEvent): void {
    this.prefs.setTheme(choice, { x: event.clientX, y: event.clientY });
  }

  protected setHue(value: number): void {
    this.prefs.setAccent(value);
  }
}

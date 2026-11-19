import { Component, computed, inject } from '@angular/core';
import { PrefsService } from '../core/prefs.service';
import { ACCENT_PRESETS, AUTO_THEME, DEFAULT_HUES, THEMES, ThemeChoice } from '../core/themes';
import { ThemePreview } from '../shared/theme-preview/theme-preview';

/** An option of the theme picker: one of the themes or `auto`. */
interface ThemeOption {
  id: ThemeChoice;
  name: string;
  description: string;
}

/** `/settings`: the theme and the accent of the interface, kept on this device. */
@Component({
  imports: [ThemePreview],
  selector: 'app-settings',
  styleUrl: './settings.scss',
  templateUrl: './settings.html',
})
export class Settings {
  protected readonly prefs = inject(PrefsService);

  protected readonly themes: readonly ThemeOption[] = [...THEMES, AUTO_THEME];
  protected readonly accents = ACCENT_PRESETS;

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

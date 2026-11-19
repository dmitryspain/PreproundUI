import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { AUTO_DARK, AUTO_LIGHT, ThemeChoice } from '../../core/themes';

/**
 * A miniature test screen drawn with a theme's *real* tokens: they are scoped to `[data-theme]`,
 * so the preview can carry another theme than the page. `auto` shows its dark and light themes
 * split diagonally. Decorative only: the control around it names the theme.
 */
@Component({
  imports: [NgTemplateOutlet],
  selector: 'app-theme-preview',
  styleUrl: './theme-preview.scss',
  templateUrl: './theme-preview.html',
  host: { 'aria-hidden': 'true' },
})
export class ThemePreview {
  readonly theme = input.required<ThemeChoice>();

  protected readonly autoDark = AUTO_DARK;
  protected readonly autoLight = AUTO_LIGHT;
}

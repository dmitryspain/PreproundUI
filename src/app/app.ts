import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TPipe } from './core/i18n/pipes';
import { PrefsService } from './core/prefs.service';
import { TestSessionService } from './core/test-session.service';
import { LanguageSwitch } from './shared/language-switch/language-switch';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe, LanguageSwitch],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly sessions = inject(TestSessionService);

  constructor() {
    // Created with the shell, so the chosen theme, accent and language apply on every route, not only on /settings.
    inject(PrefsService);
  }
}

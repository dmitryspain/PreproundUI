import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PrefsService } from './core/prefs.service';
import { TestSessionService } from './core/test-session.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly sessions = inject(TestSessionService);

  constructor() {
    // Created with the shell, so the chosen theme and accent apply on every route, not only on /settings.
    inject(PrefsService);
  }
}

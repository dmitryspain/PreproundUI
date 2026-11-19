import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { TestSessionService } from './core/test-session.service';
import { Result } from './result/result';
import { Settings } from './settings/settings';
import { Setup } from './setup/setup';
import { TestRun } from './test-run/test-run';

/** The test lives only in memory: after a reload, a direct link or the end of the test there is nothing to show. */
const testInProgress: CanActivateFn = () =>
  inject(TestSessionService).inProgress() || inject(Router).createUrlTree(['/']);

/** The result is kept in memory too, so a reload or a direct link to `/result` goes back to the setup. */
const hasResult: CanActivateFn = () =>
  inject(TestSessionService).result() !== null || inject(Router).createUrlTree(['/']);

export const routes: Routes = [
  { path: '', component: Setup },
  { path: 'test', component: TestRun, canActivate: [testInProgress] },
  { path: 'result', component: Result, canActivate: [hasResult] },
  { path: 'settings', component: Settings },
  { path: '**', redirectTo: '' },
];

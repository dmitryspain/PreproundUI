import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { TestSessionService } from './core/test-session.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('Prepround');
  });
});

@Component({ template: '' })
class Blank {}

describe('App header', () => {
  const inProgress = signal(false);

  beforeEach(() => {
    inProgress.set(false);
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'settings', component: Blank },
        ]),
        { provide: TestSessionService, useValue: { inProgress } },
      ],
    });
  });

  const links = (page: HTMLElement) =>
    Array.from(page.querySelectorAll<HTMLAnchorElement>('header a')).map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim(),
    }));

  it('links the logo home and «Налаштування» to /settings', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(links(fixture.nativeElement)).toEqual([
      { href: '/', text: 'Prepround' },
      { href: '/settings', text: 'Налаштування' },
    ]);
  });

  it('marks «Налаштування» as the current page on /settings', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/settings');
    await fixture.whenStable();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a[href="/settings"]');
    expect(link?.getAttribute('aria-current')).toBe('page');
  });

  it('drops every link while a test is in progress and brings them back after it', async () => {
    inProgress.set(true);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelectorAll('header a')).toHaveLength(0);
    expect(page.querySelector('header')?.textContent?.trim()).toBe('Prepround');

    inProgress.set(false);
    await fixture.whenStable();
    expect(page.querySelectorAll('header a')).toHaveLength(2);
  });
});

import { TestBed } from '@angular/core/testing';
import { MEDIA } from './media';

/** A `MediaQueryList` whose `matches` the test flips, notifying the `change` listeners like the browser. */
class FakeQuery extends EventTarget {
  constructor(
    readonly media: string,
    public matches: boolean,
  ) {
    super();
  }

  flip(matches: boolean): void {
    this.matches = matches;
    const event = Object.assign(new Event('change'), { matches, media: this.media });
    this.dispatchEvent(event);
  }
}

describe('MEDIA', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('counts the system as light with full motion when matchMedia is missing', () => {
    expect(typeof globalThis.matchMedia).not.toBe('function');

    const media = TestBed.inject(MEDIA);

    expect(media.prefersDark()).toBe(false);
    expect(media.prefersReducedMotion()).toBe(false);
  });

  it('reads the system settings and follows a change of the colour scheme', () => {
    const queries = new Map<string, FakeQuery>([
      ['(prefers-color-scheme: dark)', new FakeQuery('(prefers-color-scheme: dark)', true)],
      [
        '(prefers-reduced-motion: reduce)',
        new FakeQuery('(prefers-reduced-motion: reduce)', false),
      ],
    ]);
    vi.stubGlobal('matchMedia', (text: string) => queries.get(text));

    const media = TestBed.inject(MEDIA);
    expect(media.prefersDark()).toBe(true);
    expect(media.prefersReducedMotion()).toBe(false);

    queries.get('(prefers-color-scheme: dark)')!.flip(false);
    queries.get('(prefers-reduced-motion: reduce)')!.matches = true;

    expect(media.prefersDark()).toBe(false);
    expect(media.prefersReducedMotion()).toBe(true);
  });
});

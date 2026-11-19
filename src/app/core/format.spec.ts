import { formatDuration } from './format';

describe('formatDuration', () => {
  it('shows M:SS below an hour and H:MM:SS from an hour on', () => {
    const cases: [number, string][] = [
      [0, '0:00'],
      [9, '0:09'],
      [60, '1:00'],
      [125, '2:05'],
      [3599, '59:59'],
      [3600, '1:00:00'],
      [3725, '1:02:05'],
      [6000, '1:40:00'],
      [36_000, '10:00:00'],
    ];
    for (const [seconds, expected] of cases) {
      expect(formatDuration(seconds), `${seconds} s`).toBe(expected);
    }
  });

  it('drops fractions of a second and shows a negative value as 0:00', () => {
    expect(formatDuration(59.999)).toBe('0:59');
    expect(formatDuration(3599.9)).toBe('59:59');
    expect(formatDuration(-1)).toBe('0:00');
    expect(formatDuration(-3600)).toBe('0:00');
  });
});

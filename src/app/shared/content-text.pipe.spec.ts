import { ContentTextPipe } from './content-text.pipe';

describe('ContentTextPipe', () => {
  const pipe = new ContentTextPipe();

  it('escapes markup, so <script>alert(1)</script> stays text', () => {
    expect(pipe.transform('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('turns inline code in backticks into <code>', () => {
    expect(pipe.transform('`AsNoTracking()`')).toBe('<code>AsNoTracking()</code>');
    expect(pipe.transform('Виклик `AsNoTracking()` вимикає `ChangeTracker`.')).toBe(
      'Виклик <code>AsNoTracking()</code> вимикає <code>ChangeTracker</code>.',
    );
  });

  it('escapes first: markup inside backticks shows as text inside <code>', () => {
    expect(pipe.transform('`List<int>` & `<img src=x onerror=alert(1)>`')).toBe(
      '<code>List&lt;int&gt;</code> &amp; <code>&lt;img src=x onerror=alert(1)&gt;</code>',
    );
  });

  it('escapes quotes, so they cannot close an attribute', () => {
    expect(pipe.transform(`"a" 'b'`)).toBe('&quot;a&quot; &#39;b&#39;');
  });

  it('leaves an unpaired backtick as is', () => {
    expect(pipe.transform('a ` b')).toBe('a ` b');
  });

  it('gives an empty string for null and undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});

import { Pipe, PipeTransform } from '@angular/core';

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * HTML for `[innerHTML]` from a text of the content (question, option, explanation): the text is escaped first,
 * so any markup in it shows as is, and only then inline code in backticks becomes `<code>`
 * (ADR 002: no Markdown). The `code` block of a question is not for this pipe: it is shown as text in `<pre><code>`.
 */
@Pipe({ name: 'contentText' })
export class ContentTextPipe implements PipeTransform {
  transform(text: string | null | undefined): string {
    return (text ?? '')
      .replace(/[&<>"']/g, (char) => ESCAPES[char])
      .replace(/`([^`\n]+)`/g, '<code>$1</code>');
  }
}

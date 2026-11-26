import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';
import { CommunityPostBody } from './CommunityPostBody';

function render(html: string) {
  return renderToStaticMarkup(<MemoryRouter><CommunityPostBody html={html} /></MemoryRouter>);
}

it('links valid mentions without linking email addresses or code', () => {
  const output = render('<p>Hi @Moon123, contact moon@Moon123.com. <code>@Moon123</code> @Moon123_extra</p>');
  expect(output.match(/href="\/u\/moon123"/g)).toHaveLength(1);
  expect(output).toContain('<code>@Moon123</code>');
});

it('keeps formatted text and safe links without carrying executable markup', () => {
  const output = render('<p onclick="bad()"><strong>ritual</strong> <a href="jav&#x61;script:bad()">link</a> <a href="/community">Coven</a><script>bad()</script></p>');
  expect(output).toContain('<strong>ritual</strong>');
  expect(output).toContain('href="/community"');
  expect(output).not.toMatch(/onclick|javascript|bad\(/);
});

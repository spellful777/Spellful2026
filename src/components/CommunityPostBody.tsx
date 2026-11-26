import { COMMENT_URLS } from '@/lib/comment-links';
import { createElement, type ReactNode } from 'react';
import { Link } from 'react-router';
import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import { normalizeUsername } from '@/lib/username-rules';
import { allowsMentionsInTag, COMMUNITY_DISCARDED_TAGS, communityMentionsInText } from '@/lib/community-mentions';

const ALLOWED = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'a', 'span', 'div', 'section', 'details', 'summary',
]);
function renderMentions(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let start = 0;
  for (const match of communityMentionsInText(text)) {
    const username = match[1];
    parts.push(text.slice(start, match.index));
    parts.push(<Link key={match.index} to={`/u/${normalizeUsername(username)}`}>{match[0]}</Link>);
    start = match.index + match[0].length;
  }
  return parts.length ? [...parts, text.slice(start)] : text;
}

function safeHref(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value || /[\\\u0000-\u0020\u007f]/.test(value)) return undefined;
  if (value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//'))) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch { /* Invalid destination */ }
  return undefined;
}

function renderCommentText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let start = 0;
  for (const match of text.matchAll(COMMENT_URLS)) {
    const href = match[0].replace(/[.,!?;)]+$/, '');
    parts.push(renderMentions(text.slice(start, match.index)));
    parts.push(<a key={match.index} href={href} target="_blank" rel="noopener noreferrer">{href}</a>);
    start = match.index + href.length;
  }
  return parts.length ? [...parts, renderMentions(text.slice(start))] : renderMentions(text);
}

function renderNode(node: DefaultTreeAdapterTypes.ChildNode, key: number, linkMentions: boolean, autoLink: boolean): ReactNode {
  if ('value' in node && node.nodeName === '#text') {
    return linkMentions ? autoLink ? renderCommentText(node.value) : renderMentions(node.value) : node.value;
  }
  if (!('tagName' in node) || node.namespaceURI !== 'http://www.w3.org/1999/xhtml') return null;
  const tag = node.tagName;
  if (COMMUNITY_DISCARDED_TAGS.has(tag)) return null;
  const children = node.childNodes.map((child, index) =>
    renderNode(child, index, linkMentions && allowsMentionsInTag(tag), autoLink));
  if (!ALLOWED.has(tag)) return children;
  if (tag === 'br' || tag === 'hr') return createElement(tag, { key });

  if (tag === 'a') {
    const href = safeHref(node.attrs.find(attr => attr.name === 'href')?.value);
    return href ? <a key={key} href={href}>{children}</a> : <span key={key}>{children}</span>;
  }

  return createElement(tag, { key }, children);
}

export function CommunityPostBody({ html, autoLink = false }: { html: string; autoLink?: boolean }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none break-words text-foreground/90 leading-relaxed
      prose-headings:font-heading prose-headings:text-foreground
      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
      prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-accent
      prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground">
      {parseFragment(html).childNodes.map((node, key) => renderNode(node, key, true, autoLink))}
    </div>
  );
}

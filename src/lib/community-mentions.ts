import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import { normalizeUsername, validateUsernameFormat } from './username-rules';

export const COMMUNITY_DISCARDED_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'template', 'noscript',
]);

export function allowsMentionsInTag(tag: string) {
  return tag !== 'a' && tag !== 'code' && tag !== 'pre' && !COMMUNITY_DISCARDED_TAGS.has(tag);
}

export function communityMentionsInText(text: string) {
  const pattern = /(?<![\p{L}\p{N}_.@+%/-])@([A-Za-z0-9]{3,12})(?![\p{L}\p{N}_@-])/gu;
  return Array.from(text.matchAll(pattern)).filter(match => !validateUsernameFormat(match[1]));
}

export function communityMentionRecipients(html: string) {
  const recipients = new Set<string>();
  function visit(node: DefaultTreeAdapterTypes.ChildNode) {
    if (recipients.size >= 10) return;
    if ('value' in node && node.nodeName === '#text') {
      for (const match of communityMentionsInText(node.value)) {
        recipients.add(normalizeUsername(match[1]));
        if (recipients.size >= 10) break;
      }
    } else if ('tagName' in node && node.namespaceURI === 'http://www.w3.org/1999/xhtml' && allowsMentionsInTag(node.tagName)) {
      node.childNodes.forEach(visit);
    }
  }
  parseFragment(html).childNodes.forEach(visit);
  return [...recipients];
}

export const COMMENT_URLS = /https?:\/\/[^\s<>"']+/gi;

export function commentUrl(text: string) {
  const found = text.match(COMMENT_URLS)?.[0]?.replace(/[.,!?;)]+$/, '');
  if (!found) return null;
  try {
    const url = new URL(found);
    return !url.username && !url.password ? url : null;
  } catch { return null; }
}

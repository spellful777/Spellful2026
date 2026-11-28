export const SPARK_COMMENT_LIMIT = 280;
export const COMMENT_GIF_SETTING = 'spellful-comment-gifs';

export function sparkReplyPath(postId: number, replyId: number) {
  return `/community/post/${postId}#reply-${replyId}`;
}

export const CANDLELIGHT_GIF = '/assets/media/candlelight-reply.gif';

export function commentGifUrl(value: unknown) {
  if (value === CANDLELIGHT_GIF) return CANDLELIGHT_GIF;
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
        (host === 'media.tenor.com' || /^media\d*\.giphy\.com$/.test(host)) &&
        /\.gif$/i.test(url.pathname)) return url.href;
  } catch { /* Invalid GIF URL */ }
  return null;
}

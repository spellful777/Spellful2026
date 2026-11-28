import type { SparkReading } from '@/lib/spark-reading';
import type { SparkMedia, OriginalSpark } from '@/lib/spark-media';
/**
 * Community post & reply types, plus data hooks for the thread page.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface CommunityPoll {
  id: number;
  postId: number;
  question: string;
  choices: string[];
  closeAt: string | null;
  tallies: number[];
  totalVotes: number;
  myVote: number | null;
}

export interface CommunityReply {
  id: number;
  postId: number;
  parentId: number | null;
  body: string;
  likeCount: number;
  depth: number | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  authorName: string | null;
  authorImage: string | null;
  authorUsername: string | null;
  authorLocation: string | null;
  likedBy?: string[];
  liked: boolean;
  favorited?: boolean;
  suppressLinkPreview?: boolean;
  gifUrl?: string | null;
}

export interface CommunityPostDetail {
  forumPost?: boolean;
  id: number;
  type: 'discussion' | 'question' | 'spark';
  title: string;
  body: string;
  sparkTopic?: string | null;
  sparkReading?: SparkReading | null;
  sparkMedia?: SparkMedia[] | null;
  reshareOf?: number | null;
  reshareCount?: number;
  reshared?: boolean;
  originalSparkId?: number | null;
  originalSpark?: OriginalSpark | null;
  imageUrl: string | null;
  tags: string | null;
  isPinned: boolean;
  isLocked: boolean;
  isHidden: boolean;
  audience: string | null;
  acceptedReplyId: number | null;
  likeCount: number;
  replyCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
  categoryId: number;
  authorName: string | null;
  authorImage: string | null;
  authorUsername: string | null;
  authorLocation: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  poll: CommunityPoll | null;
  likedBy?: string[];
  liked: boolean;
  bookmarked: boolean;
  muted: boolean;
}

export function usePostDetail(postId: number | null, viewerId?: string | null) {
  const key = postId ? `${postId}:${viewerId ?? ''}` : null;
  const [scope, setScope] = useState<string | null>(null);
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(postId));
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    active.current?.abort();
    if (!postId) return;
    const request = new AbortController();
    active.current = request;
    setLoading(true);
    setError(null);
    fetch(`/api/community/posts/${postId}`, { signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error(response.status === 404 ? 'Not found' : 'Could not load the conversation');
        return response.json() as Promise<CommunityPostDetail>;
      })
      .then(data => { if (!request.signal.aborted) setPost(data); })
      .catch((failure: Error) => {
        if (!request.signal.aborted) { setPost(null); setError(failure.message); }
      })
      .finally(() => {
        if (!request.signal.aborted) { setScope(key); setLoading(false); }
      });
  }, [key, postId]);

  useEffect(() => {
    load();
    return () => active.current?.abort();
  }, [load]);
  return {
    post: scope === key ? post : null,
    loading: Boolean(key) && (scope !== key || loading),
    error: scope === key ? error : null,
    reload: load,
    setPost,
  };
}

export function useReplies(postId: number | null, sort: 'chrono' | 'liked' = 'chrono', viewerId?: string | null) {
  const key = postId ? `${postId}:${viewerId ?? ''}:${sort}` : null;
  const [scope, setScope] = useState<string | null>(null);
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [loading, setLoading] = useState(Boolean(postId));
  const [error, setError] = useState(false);
  const active = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    active.current?.abort();
    if (!postId) return;
    const request = new AbortController();
    active.current = request;
    setLoading(true);
    setError(false);
    fetch(`/api/community/posts/${postId}/replies?sort=${sort}`, { signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<CommunityReply[]>;
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error();
        if (!request.signal.aborted) setReplies(data);
      })
      .catch(() => {
        if (!request.signal.aborted) { setReplies([]); setError(true); }
      })
      .finally(() => {
        if (!request.signal.aborted) { setScope(key); setLoading(false); }
      });
  }, [key, postId, sort]);

  useEffect(() => {
    load();
    return () => active.current?.abort();
  }, [load]);
  return {
    replies: scope === key ? replies : [],
    loading: Boolean(key) && (scope !== key || loading),
    error: scope === key && error,
    reload: load,
    setReplies,
  };
}

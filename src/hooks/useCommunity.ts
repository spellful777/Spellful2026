import type { SparkReading } from '@/lib/spark-reading';
import type { SparkMedia, OriginalSpark } from '@/lib/spark-media';
/**
 * useCommunity — shared data hook for community pages.
 * Fetches categories, posts (with filter/page), and notification count.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface CommunityCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  postCount: number;
  isActive: boolean;
}

export interface CommunityPost {
  id: number;
  type: 'discussion' | 'question' | 'spark';
  title: string;
  preview?: string;
  audience?: string | null;
  sparkTopic?: string | null;
  sparkReading?: SparkReading | null;
  sparkMedia?: SparkMedia[] | null;
  reshareOf?: number | null;
  reshareCount?: number;
  reshared?: boolean;
  originalSparkId?: number | null;
  originalSpark?: OriginalSpark | null;
  imageUrl?: string | null;
  tags: string | null;
  isPinned: boolean;
  isLocked: boolean;
  likeCount: number;
  replyCount: number;
  viewCount: number;
  acceptedReplyId: number | null;
  createdAt: string;
  categoryId: number;
  userId: string;
  authorName: string | null;
  authorImage: string | null;
  authorPreset?: string | null;
  authorFrame?: string | null;
  authorUsername: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  likedBy?: string[];
  liked: boolean;
  bookmarked: boolean;
}

export type PostFilter = 'personalized' | 'chronological' | 'all' | 'latest' | 'popular' | 'trending' | 'discover' | 'unanswered' | 'following' | 'mine';

interface PostsResult {
  posts: CommunityPost[];
  total: number;
  page: number;
  pages: number;
  newestId?: number;
}

export function useCommunityCategories() {
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/community/categories')
      .then((r) => r.ok ? r.json() : Promise.resolve([]))
      .then((data: CommunityCategory[]) => { if (Array.isArray(data)) setCategories(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}

export function useCommunityPosts(filter: PostFilter, category?: string, page = 1, order?: 'newest', enabled = true, kind?: 'spark' | 'discussion') {
  const [result, setResult] = useState<PostsResult>({ posts: [], total: 0, page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({ filter, page: String(page), limit: '20' });
    if (category) params.set('category', category);
    if (order) params.set('order', order);
    if (kind) params.set('kind', kind);
    const empty: PostsResult = { posts: [], total: 0, page, pages: 0 };

    fetch(`/api/community/posts?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load Coven posts');
        return response.json();
      })
      .then((data: PostsResult) => {
        if (!Array.isArray(data?.posts)) throw new Error('Invalid Coven response');
        if (!controller.signal.aborted) setResult(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult(empty);
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [filter, category, page, order, kind]);

  useEffect(() => {
    if (!enabled) return;
    load();
    return () => pending.current?.abort();
  }, [enabled, load]);

  return { ...result, loading, error, reload: load };
}

export function useCommunityNotifications() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/community/notifications?limit=1')
      .then((r) => r.ok ? r.json() : null)
      .then((data: { unread?: number } | null) => { if (data?.unread) setUnread(data.unread); })
      .catch(() => {});
  }, []);

  return unread;
}

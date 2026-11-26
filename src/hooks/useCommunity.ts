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
  type: 'discussion' | 'question';
  title: string;
  preview?: string;
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
  authorUsername: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  liked: boolean;
  bookmarked: boolean;
}

export type PostFilter = 'personalized' | 'chronological' | 'all' | 'latest' | 'popular' | 'unanswered' | 'following' | 'mine';

interface PostsResult {
  posts: CommunityPost[];
  total: number;
  page: number;
  pages: number;
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

export function useCommunityPosts(filter: PostFilter, category?: string, page = 1) {
  const [result, setResult] = useState<PostsResult>({ posts: [], total: 0, page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);

  const pending = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);

    const params = new URLSearchParams({ filter, page: String(page), limit: '20' });
    if (category) params.set('category', category);
    const empty: PostsResult = { posts: [], total: 0, page, pages: 0 };

    fetch(`/api/community/posts?${params}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : empty)
      .then((data: PostsResult) => {
        if (!controller.signal.aborted) setResult(Array.isArray(data?.posts) ? data : empty);
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult(empty);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [filter, category, page]);

  useEffect(() => {
    load();
    return () => pending.current?.abort();
  }, [load]);

  return { ...result, loading, reload: load };
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

interface TrendingPost {
  tags: string | null;
  likeCount: number | null;
  replyCount: number | null;
}

export function getTrendingTopics(posts: readonly TrendingPost[]) {
  const topics = new Map<string, { tag: string; count: number; engagement: number }>();
  for (const post of posts) {
    const tags = post.tags?.split(',').map(tag => tag.trim()).filter(Boolean) ?? [];
    const counted = new Set<string>();
    for (const tag of tags) {
      const key = tag.toLowerCase();
      if (counted.has(key)) continue;
      counted.add(key);
      const topic = topics.get(key) ?? { tag, count: 0, engagement: 0 };
      topic.count++;
      topic.engagement += (post.likeCount ?? 0) + 2 * (post.replyCount ?? 0);
      topics.set(key, topic);
    }
  }
  return [...topics.values()]
    .sort((a, b) => b.count - a.count || b.engagement - a.engagement || a.tag.localeCompare(b.tag))
    .slice(0, 5);
}

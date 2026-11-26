import { expect, it } from 'vitest';
import { getTrendingTopics } from './community-trending-topics';

it('combines case variants, counts each post once and uses engagement to break ties', () => {
  expect(getTrendingTopics([
    { tags: 'Moon, moon, Tarot', likeCount: 1, replyCount: 1 },
    { tags: 'MOON, Ritual', likeCount: 0, replyCount: 2 },
    { tags: null, likeCount: 20, replyCount: 10 },
  ])).toEqual([
    { tag: 'Moon', count: 2, engagement: 7 },
    { tag: 'Ritual', count: 1, engagement: 4 },
    { tag: 'Tarot', count: 1, engagement: 3 },
  ]);
});

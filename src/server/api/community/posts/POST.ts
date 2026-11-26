import { SPARK_LIMIT, countSparkCharacters, sparkBodyHtml } from '@/lib/sparks';
import { renderSharedReading, sharedReadingSchema } from '@/lib/shared-reading';
import { notifyCommunityMentions } from '@/server/lib/community-mention-notifications.js';
/**
 * POST /api/community/posts — create a new post (auth required)
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityPosts, communityCategories, communityPolls } from '@/server/db/schema.js';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { visiblePostForMember } from '@/server/lib/community-post-access.js';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Sign in to post' });

  const { categoryId, type = 'discussion', title, body = '', tags = '', imageUrl, poll, audience = 'public', quotedPostId, sharedReading } = req.body as {
    categoryId?: number;
    type?: string;
    title?: string;
    body?: string;
    tags?: string;
    imageUrl?: string;
    audience?: string;
    quotedPostId?: number;
    sharedReading?: unknown;
    poll?: { question: string; choices: string[]; closesAt?: string };
  };

  if (type === 'spark') {
    if (typeof body !== 'string' || !body.trim() || countSparkCharacters(body) > SPARK_LIMIT) {
      return res.status(400).json({ error: `A Spark must have 1–${SPARK_LIMIT} characters` });
    }
    if (title !== undefined || tags || poll || quotedPostId !== undefined || sharedReading !== undefined) {
      return res.status(400).json({ error: 'Sparks support short text and an optional image. Use a discussion for other content.' });
    }
    if (imageUrl !== undefined) {
      try {
        if (typeof imageUrl !== 'string' || imageUrl.length > 2048) throw new Error('Invalid URL');
        const parsed = new URL(imageUrl);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid URL');
      } catch {
        return res.status(400).json({ error: 'Enter a valid HTTPS image URL' });
      }
    }
    if (audience !== 'public' && audience !== 'coven') {
      return res.status(400).json({ error: 'Invalid audience' });
    }
    const [category] = await db.select({ id: communityCategories.id }).from(communityCategories)
      .where(eq(communityCategories.isActive, true))
      .orderBy(desc(sql`${communityCategories.slug} = 'witches-lounge'`), asc(communityCategories.sortOrder), asc(communityCategories.id))
      .limit(1);
    if (!category) return res.status(503).json({ error: 'Sparks are temporarily unavailable' });

    const text = body.trim();
    const [spark] = await db.insert(communityPosts).values({
      userId: session.user.id, categoryId: category.id, type, title: text, body: sparkBodyHtml(text), audience, imageUrl: imageUrl ?? null,
    }).$returningId();
    return res.status(201).json({ id: spark.id });
  }

  if (!categoryId || typeof title !== 'string' || !title.trim() || typeof body !== 'string' ||
      (!body.trim() && sharedReading === undefined)) {
    return res.status(400).json({ error: 'Category, title, and a body or reading are required' });
  }
  if (!['discussion', 'question'].includes(type)) {
    return res.status(400).json({ error: 'Invalid post type' });
  }

  if (audience !== 'public' && audience !== 'coven') {
    return res.status(400).json({ error: 'Invalid audience' });
  }

  let postBody = body.trim();
  if (sharedReading !== undefined) {
    const parsed = sharedReadingSchema.safeParse(sharedReading);
    const preview = parsed.success ? renderSharedReading(parsed.data) : null;
    if (!preview) return res.status(400).json({ error: 'Invalid shared reading' });
    postBody += preview;
  }
  if (quotedPostId !== undefined) {
    if (!Number.isSafeInteger(quotedPostId) || quotedPostId < 1) {
      return res.status(400).json({ error: 'Invalid original post' });
    }
    const [source] = await db.select({ id: communityPosts.id }).from(communityPosts)
      .where(and(visiblePostForMember(quotedPostId, session.user.id), eq(communityPosts.audience, 'public'))).limit(1);
    if (!source) return res.status(404).json({ error: 'Original post unavailable' });
    postBody += `<p><a href="/community/post/${source.id}">View original Coven post</a></p>`;
  }

  // Verify category exists
  const [cat] = await db.select({ id: communityCategories.id }).from(communityCategories).where(eq(communityCategories.id, categoryId)).limit(1);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  const [result] = await db.insert(communityPosts).values({
    userId: session.user.id,
    categoryId,
    type,
    title: title.trim().slice(0, 300),
    body: postBody,
    audience,
    tags: tags.slice(0, 500),
    imageUrl: imageUrl ?? null,
  });

  const postId = (result as unknown as { insertId: number }).insertId;

  // Create poll if provided
  if (poll?.question && Array.isArray(poll.choices) && poll.choices.length >= 2 && poll.choices.length <= 6) {
    await db.insert(communityPolls).values({
      postId,
      question: poll.question.slice(0, 500),
      choices: poll.choices.map((c: string) => c.trim()).filter(Boolean),
      closesAt: poll.closesAt ? new Date(poll.closesAt) : null,
    });
  }

  await notifyCommunityMentions({ html: body, actorId: session.user.id, postId }).catch(() => {
    console.error('community.mention-notifications.failed');
  });

  res.status(201).json({ id: postId });
}

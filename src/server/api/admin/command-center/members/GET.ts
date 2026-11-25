/**
 * GET /api/admin/command-center/members
 * Owner-only paginated member list with search + role + account-type filters.
 * Query: ?q=&role=&accountType=&limit=25&offset=0
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq, like, or, and, count, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const q          = typeof req.query.q          === 'string' ? req.query.q.trim()          : '';
  const roleFilter = typeof req.query.role        === 'string' ? req.query.role.trim()        : '';
  const typeFilter = typeof req.query.accountType === 'string' ? req.query.accountType.trim() : '';
  const limit      = Math.min(Number(req.query.limit) || 25, 100);
  const offset     = Number(req.query.offset) || 0;

  // Build WHERE conditions using proper Drizzle expressions
  const conditions = [];

  if (q) {
    const term = `%${q}%`;
    conditions.push(
      or(
        like(user.username, term),
        like(user.name, term),
        like(user.email, term),
      )
    );
  }
  if (roleFilter) conditions.push(eq(user.platformRole, roleFilter));
  if (typeFilter) conditions.push(eq(user.accountType, typeFilter));

  const where = conditions.length === 0
    ? undefined
    : conditions.length === 1
      ? conditions[0]
      : and(...conditions);

  const [rows, [totalRow]] = await Promise.all([
    db.select({
      id:           user.id,
      name:         user.name,
      email:        user.email,
      username:     user.username,
      image:        user.image,
      platformRole: user.platformRole,
      accountType:  user.accountType,
      createdAt:    user.createdAt,
      updatedAt:    user.updatedAt,
    })
      .from(user)
      .where(where)
      .orderBy(sql`${user.createdAt} DESC`)
      .limit(limit + 1)
      .offset(offset),

    db.select({ n: count() }).from(user).where(where),
  ]);

  const hasMore = rows.length > limit;
  return res.json({
    members: rows.slice(0, limit),
    hasMore,
    total: Number(totalRow?.n ?? 0),
    offset,
    limit,
  });
}

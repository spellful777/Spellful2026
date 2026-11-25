/**
 * block-check.ts
 * Shared helper to check if a block exists between two users.
 * Used by profile, presence, messaging, feed, and search endpoints.
 *
 * SECURITY: Both functions FAIL CLOSED — if the database is unavailable,
 * they throw a BlockCheckError rather than returning false/empty, which
 * would silently expose protected content. Callers must catch this error
 * and return a 503 or equivalent safe response.
 */
import { db } from '@/server/db/client.js';
import { communityBlocks } from '@/server/db/schema.js';
import { or, and, eq } from 'drizzle-orm';

/**
 * Thrown when the block check cannot be completed safely.
 * Callers must treat this as a hard failure — do NOT fall through to
 * exposing protected content.
 */
export class BlockCheckError extends Error {
  constructor(message = 'Block check unavailable — database unreachable') {
    super(message);
    this.name = 'BlockCheckError';
  }
}

/**
 * Returns true if either user has blocked the other.
 * Mutual: A blocks B OR B blocks A → both are blocked from each other.
 *
 * @throws {BlockCheckError} if the database is unavailable — callers must
 *   handle this and return a safe error response (e.g. 503) rather than
 *   proceeding as if no block exists.
 */
export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  if (!db) throw new BlockCheckError();
  const [row] = await db
    .select({ id: communityBlocks.id })
    .from(communityBlocks)
    .where(
      or(
        and(eq(communityBlocks.blockerId, userA), eq(communityBlocks.blockedId, userB)),
        and(eq(communityBlocks.blockerId, userB), eq(communityBlocks.blockedId, userA)),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Returns the set of user IDs that the given user has blocked OR been blocked by.
 * Used for feed/search filtering.
 *
 * @throws {BlockCheckError} if the database is unavailable — callers must
 *   handle this and return a safe error response (e.g. 503) rather than
 *   proceeding with an empty block set.
 */
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  if (!db) throw new BlockCheckError();
  const rows = await db
    .select({ blockerId: communityBlocks.blockerId, blockedId: communityBlocks.blockedId })
    .from(communityBlocks)
    .where(
      or(
        eq(communityBlocks.blockerId, userId),
        eq(communityBlocks.blockedId, userId),
      ),
    );
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.blockerId === userId) ids.add(row.blockedId);
    else ids.add(row.blockerId);
  }
  return ids;
}

/**
 * GET /api/stream/messages
 *
 * Server-Sent Events stream for the Messenger.
 * Each authenticated user gets a long-lived connection; the server pushes
 * events instead of the client polling.
 *
 * Events pushed:
 *   new_message      — a new DM arrived in one of the user's conversations
 *   group_message    — a new message arrived in one of the user's groups
 *   typing           — the other participant in a conversation started typing
 *   read_receipt     — the other participant read up to a message
 *   presence_update  — a user's online status changed
 *   unread_count     — total unread badge count changed
 *   request_update   — a message request was accepted or declined
 *   ping             — keepalive (every 25 s)
 *
 * The client reconnects automatically via EventSource's built-in retry.
 * A 'ping' event resets the browser's reconnect timer.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { registerSse, unregisterSse } from '@/server/lib/sse-registry.js';

// Keepalive interval — must be shorter than any proxy's idle timeout (typically 60 s)
const PING_INTERVAL_MS = 25_000;

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const userId = session.user.id;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send an immediate ping so the client knows the stream is open
  res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);

  registerSse(userId, res);

  // Keepalive ping
  const pingTimer = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    } catch {
      clearInterval(pingTimer);
    }
  }, PING_INTERVAL_MS);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(pingTimer);
    unregisterSse(userId, res);
  });
}

/**
 * In-process SSE client registry.
 *
 * Keeps a Map<userId, Set<Response>> so any API handler can push a real-time
 * event to all browser tabs a user has open, without a message broker.
 *
 * Usage (from any handler):
 *   import { fanoutToUser } from '@/server/lib/sse-registry.js';
 *   fanoutToUser(recipientId, { type: 'new_message', payload: { ... } });
 */
import type { Response } from 'express';

export interface SseEvent {
  type:
    | 'new_message'
    | 'group_message'
    | 'typing'
    | 'read_receipt'
    | 'presence_update'
    | 'unread_count'
    | 'request_update'
    | 'ping';
  payload?: unknown;
}

// userId → Set of open SSE Response objects
const registry = new Map<string, Set<Response>>();

/** Register a new SSE connection for a user. */
export function registerSse(userId: string, res: Response): void {
  let set = registry.get(userId);
  if (!set) {
    set = new Set();
    registry.set(userId, set);
  }
  set.add(res);
}

/** Remove a closed SSE connection. */
export function unregisterSse(userId: string, res: Response): void {
  const set = registry.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) registry.delete(userId);
}

/** Push an event to every open SSE connection for a user. */
export function fanoutToUser(userId: string, event: SseEvent): void {
  const set = registry.get(userId);
  if (!set || set.size === 0) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      // Connection already closed — will be cleaned up on 'close'
    }
  }
}

/** Number of open SSE connections (for monitoring). */
export function sseConnectionCount(): number {
  let total = 0;
  for (const set of registry.values()) total += set.size;
  return total;
}

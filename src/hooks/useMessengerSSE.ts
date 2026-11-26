/**
 * useMessengerSSE
 *
 * Opens a Server-Sent Events connection to /api/stream/messages and dispatches
 * real-time events to the Messenger page.
 *
 * Replaces the 3 s message poll, 2 s typing poll, and 5 s read-receipt poll
 * with a single long-lived connection. Falls back to polling if SSE is
 * unavailable (e.g. the browser is offline or the server returns non-200).
 *
 * Reconnect strategy:
 *   - EventSource reconnects automatically on network drop (browser built-in).
 *   - We track `isConnected` so the UI can show an offline indicator.
 *   - On reconnect we trigger a full refresh so any messages missed during
 *     the gap are fetched immediately.
 */
import { apiOrigin } from '@/lib/native-api';
import { useEffect, useRef, useCallback } from 'react';

export interface MessengerSseEvent {
  type:
    | 'new_message'
    | 'group_message'
    | 'typing'
    | 'read_receipt'
    | 'presence_update'
    | 'unread_count'
    | 'request_update'
    | 'ping';
  payload?: {
    conversationId?: number;
    groupId?: number;
    senderId?: string;
    messageId?: number;
    isMine?: boolean;
    userId?: string;
    online?: boolean;
    readBy?: string;
    count?: number;
  };
}

interface Options {
  /** Called for every non-ping event. */
  onEvent: (event: MessengerSseEvent) => void;
  /** Called when the connection opens or reconnects. */
  onConnect?: () => void;
  /** Called when the connection drops. */
  onDisconnect?: () => void;
  /** Set false to skip opening the stream (e.g. user not signed in). */
  enabled?: boolean;
}

export function useMessengerSSE({ onEvent, onConnect, onDisconnect, enabled = true }: Options): void {
  const esRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Keep refs current without re-running the effect
  onEventRef.current = onEvent;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;

  const open = useCallback(() => {
    if (!('EventSource' in window)) return; // SSE not supported (very old browser)
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(apiOrigin + '/api/stream/messages', { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      onConnectRef.current?.();
    };

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as MessengerSseEvent;
        if (event.type !== 'ping') {
          onEventRef.current(event);
        }
      } catch {
        // Malformed event — ignore
      }
    };

    es.onerror = () => {
      onDisconnectRef.current?.();
      // EventSource will retry automatically; we just track the state
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    open();

    // Re-open on visibility change (tab comes back to foreground)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // If the EventSource is in CLOSED state, reopen it
        if (esRef.current?.readyState === EventSource.CLOSED) {
          open();
          onConnectRef.current?.();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [enabled, open]);
}

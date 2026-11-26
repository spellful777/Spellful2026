/**
 * BlockedMembersModal — view and manage blocked users from within Messages.
 * Fetches from GET /api/blocks and allows unblocking via DELETE /api/blocks/:userId.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldOff, UserX } from 'lucide-react';

interface BlockedUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  blockedAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BlockedMembersModal({ open, onClose }: Props) {
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch('/api/blocks', { credentials: 'include' })
      .then(r => r.json())
      .then((data: { blocks?: BlockedUser[] }) => {
        setBlocked(data.blocks ?? []);
      })
      .catch(() => setError('Could not load blocked members.'))
      .finally(() => setLoading(false));
  }, [open]);

  async function unblock(userId: string) {
    setUnblocking(userId);
    try {
      const res = await fetch(`/api/blocks/${userId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setBlocked(prev => prev.filter(u => u.id !== userId));
      }
    } finally {
      setUnblocking(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-3xl shadow-2xl max-w-md mx-auto"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3"
              style={{ borderBottom: '1px solid hsl(var(--border))' }}>
              <div className="flex items-center gap-2">
                <ShieldOff className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
                <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>Blocked Members</p>
              </div>
              <button onClick={onClose} style={{ color: 'hsl(var(--muted-foreground))' }} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-10">
                  <span className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin"
                    style={{ color: 'hsl(var(--primary))' }} />
                </div>
              ) : error ? (
                <p className="text-sm text-center py-8" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>
              ) : blocked.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <UserX className="w-10 h-10 opacity-20" style={{ color: 'hsl(var(--muted-foreground))' }} />
                  <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No blocked members</p>
                </div>
              ) : (
                blocked.map(u => (
                  <div key={u.id}
                    className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{ background: 'hsl(var(--muted))' }}>
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
                      style={{ background: 'hsl(var(--muted-foreground) / 0.2)' }}>
                      {u.image
                        ? <img src={u.image} alt={u.name ?? ''} className="w-full h-full object-cover" />
                        : <span className="text-base font-semibold" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            {(u.name ?? u.username ?? '?')[0].toUpperCase()}
                          </span>
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>
                        {u.name ?? u.username ?? 'Unknown'}
                      </p>
                      {u.username && (
                        <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>@{u.username}</p>
                      )}
                    </div>
                    {/* Unblock */}
                    <button
                      onClick={() => void unblock(u.id)}
                      disabled={unblocking === u.id}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity disabled:opacity-50 active:opacity-70"
                      style={{ background: 'hsl(var(--muted-foreground) / 0.15)', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}>
                      {unblocking === u.id ? '…' : 'Unblock'}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer note */}
            <div className="px-5 pb-5 pt-2">
              <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Blocked members cannot send you messages or see your online status.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

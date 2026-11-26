/**
 * AppealModal — appeal a moderation action on a post or reply.
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Scale, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  targetType: 'post' | 'reply';
  targetId: number;
  onClose: () => void;
}

export default function AppealModal({ targetType, targetId, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/community/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetType, targetId, reason }),
      });
      if (res.status === 409) { setSubmitted(true); return; }
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to submit appeal');
      }
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'hsl(var(--background) / 0.8)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Scale className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground flex-1">Appeal Moderation Decision</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {submitted ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(var(--success))' }} />
              <p className="font-medium text-foreground mb-1">Appeal submitted</p>
              <p className="text-sm text-muted-foreground mb-4">
                Our moderation team will review your appeal and respond as soon as possible.
              </p>
              <Button onClick={onClose}>Done</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If you believe this moderation decision was made in error, please explain why below.
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Your reason <span className="text-destructive">*</span></label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={5}
                  required
                  maxLength={2000}
                  placeholder="Explain why you believe this decision was incorrect"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting || !reason.trim()} className="flex-1">
                  {submitting ? 'Submitting…' : 'Submit Appeal'}
                </Button>
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * ReportModal — reusable report dialog for posts, replies, and profiles.
 * Usage: <ReportModal targetType="post" targetId={post.id} onClose={() => setOpen(false)} />
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Flag, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  targetType: 'post' | 'reply' | 'profile';
  targetId: number | string;
  onClose: () => void;
  /** When provided, the modal only renders when open is true */
  open?: boolean;
}

const REASONS = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech or discrimination' },
  { value: 'spam', label: 'Spam or repetitive content' },
  { value: 'scams', label: 'Scam or predatory behaviour' },
  { value: 'misinformation', label: 'Harmful misinformation' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Privacy violation or other' },
];

export function ReportModal({ targetType, targetId, onClose, open }: Props) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (open === false) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/community/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetType, targetId, reason, details }),
      });
      if (res.status === 409) {
        setSubmitted(true); // already reported — treat as success
        return;
      }
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to submit report');
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
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Flag className="w-5 h-5 text-destructive" />
          <h2 className="text-base font-semibold text-foreground flex-1">Report {targetType}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {submitted ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(var(--success))' }} />
              <p className="font-medium text-foreground mb-1">Report submitted</p>
              <p className="text-sm text-muted-foreground mb-4">
                Thank you. Reports are reviewed confidentially by our moderation team.
              </p>
              <Button onClick={onClose}>Done</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reports are confidential. Please select the reason that best describes the issue.
              </p>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="space-y-2">
                {REASONS.map(r => (
                  <label key={r.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="accent-primary"
                    />
                    <span className="text-sm text-foreground">{r.label}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Additional details <span className="text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Any additional context that may help our team"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={submitting || !reason} className="flex-1">
                  {submitting ? 'Submitting…' : 'Submit Report'}
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

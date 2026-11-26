import { useEffect, useState } from 'react';
import { Check, Clock, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  memberId: string;
  initialCovenStatus: string | null;
  initialConnectionId: number | null;
  onCovenChange: (status: string | null, connectionId: number | null) => void;
}

export function MemberConnectionActions({
  memberId, initialCovenStatus: status, initialConnectionId: connectionId, onCovenChange,
}: Props) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [checkingFollow, setCheckingFollow] = useState(true);
  const [busy, setBusy] = useState<'follow' | 'coven' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/community/follows?targetUserId=${encodeURIComponent(memberId)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json() as { following: boolean };
        if (!controller.signal.aborted) setFollowing(data.following);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load follow status.'); })
      .finally(() => { if (!controller.signal.aborted) setCheckingFollow(false); });
    return () => controller.abort();
  }, [memberId]);

  async function send(path: string, body?: Record<string, unknown>) {
    const response = await fetch(path, {
      method: body ? 'POST' : 'DELETE',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json() as { error?: string; following?: boolean; connectionId?: number };
    if (!response.ok) throw new Error(data.error ?? 'Could not update the connection.');
    return data;
  }

  async function toggleFollow() {
    setBusy('follow');
    setError('');
    try {
      const data = await send('/api/community/follows', { targetUserId: memberId });
      setFollowing(data.following ?? null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update your follow.');
    } finally {
      setBusy(null);
    }
  }

  async function updateCoven() {
    setBusy('coven');
    setError('');
    try {
      if (status === 'pending_received' && connectionId) {
        await send('/api/coven/respond', { connectionId, action: 'accept' });
        onCovenChange('accepted', connectionId);
      } else if (status === 'pending_sent' && connectionId) {
        await send(`/api/coven/${connectionId}`);
        onCovenChange(null, null);
      } else if (!status) {
        const data = await send('/api/coven/request', { receiverId: memberId });
        onCovenChange('pending_sent', data.connectionId ?? null);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update your Coven request.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant={following ? 'outline' : 'default'} disabled={busy !== null || checkingFollow} aria-pressed={following ?? undefined} onClick={toggleFollow}>
        {following ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {busy === 'follow' ? 'Updating…' : following ? 'Following' : 'Follow'}
      </Button>
      {status === 'accepted' ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm"><Check className="h-4 w-4" /> In your Coven</span>
      ) : status === 'pending_sent' ? (
        <>
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Coven request sent</span>
          {connectionId && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={updateCoven}>Cancel request</Button>}
        </>
      ) : (status === null || status === 'pending_received') && (
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={updateCoven}>
          <Users className="h-4 w-4" />
          {busy === 'coven' ? 'Updating…' : status === 'pending_received' ? 'Accept Coven request' : 'Send Coven request'}
        </Button>
      )}
      {error && <p className="w-full text-sm text-destructive" role="status">{error}</p>}
    </div>
  );
}

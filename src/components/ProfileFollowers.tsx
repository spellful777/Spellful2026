import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Follower { username: string; name: string }

export function ProfileFollowers({ username, count }: { username: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = cursor === null ? '' : `?before=${cursor}`;
    fetch(`/api/profile/${encodeURIComponent(username)}/followers${params}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Follower list unavailable.');
        return response.json() as Promise<{ followers: Follower[]; next: number | null }>;
      })
      .then(data => {
        if (controller.signal.aborted) return;
        setFollowers(previous => cursor === null ? data.followers : [...previous, ...data.followers]);
        setNext(data.next);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFollowers([]);
          setNext(null);
          setError('Follower list unavailable.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, username, cursor, attempt]);

  return (
    <Dialog open={open} onOpenChange={value => {
      setOpen(value);
      setFollowers([]);
      setCursor(null);
      setNext(null);
      setError('');
      setLoading(value);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Heart className="h-4 w-4" /> {count} {count === 1 ? 'follower' : 'followers'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Followers</DialogTitle>
          <DialogDescription>Members who follow @{username} and whose profiles you can view.</DialogDescription>
        </DialogHeader>
        {error ? (
          <div><p role="status">{error}</p><Button variant="outline" onClick={() => { setCursor(null); setAttempt(value => value + 1); }}>Try again</Button></div>
        ) : (
          <ul className="space-y-2">
            {followers.map(follower => (
              <li key={follower.username}>
                <Link to={`/u/${encodeURIComponent(follower.username)}`} onClick={() => setOpen(false)} className="block rounded-lg border border-border p-3 hover:border-primary">
                  <span className="block font-medium">{follower.name}</span>
                  <span className="text-sm text-muted-foreground">@{follower.username}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {loading && <p role="status">Loading followers…</p>}
        {!loading && !error && followers.length === 0 && <p role="status">No followers to display.</p>}
        {next !== null && !error && <Button variant="outline" disabled={loading} onClick={() => setCursor(next)}>Load more</Button>}
      </DialogContent>
    </Dialog>
  );
}

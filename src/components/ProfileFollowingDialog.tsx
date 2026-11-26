import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface FollowingPage {
  members: { username: string; name: string | null; image: string | null }[];
  next: number | null;
}

export default function ProfileFollowingDialog({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [cursors, setCursors] = useState<number[]>([]);
  const [page, setPage] = useState<FollowingPage | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const before = cursors.at(-1);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      const params = new URLSearchParams({ following: '1' });
      if (before !== undefined) params.set('before', String(before));
      try {
        const response = await fetch(`/api/profile/${encodeURIComponent(username)}?${params}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setPage(null);
          setError(response.status === 403 || response.status === 404
            ? 'This Following list is unavailable.'
            : 'Couldn’t load the Following list.');
          return;
        }
        const result: FollowingPage = await response.json();
        if (!controller.signal.aborted) {
          setPage(result);
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) {
          setPage(null);
          setError('Couldn’t load the Following list.');
        }
      }
    }
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 15_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [before, open, retry, username]);

  function changePage(next: number[]) {
    setPage(null);
    setError('');
    setCursors(next);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) changePage([]);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">Following list</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Following</DialogTitle>
          <DialogDescription>People @{username} follows.</DialogDescription>
        </DialogHeader>
        {error ? (
          <div>
            <p role="status" className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setRetry(value => value + 1)}>Try again</Button>
          </div>
        ) : !page ? (
          <p role="status" className="text-sm text-muted-foreground">Loading…</p>
        ) : page.members.length ? (
          <ul className="divide-y divide-border">
            {page.members.map(member => (
              <li key={member.username}>
                <Link
                  to={`/u/${encodeURIComponent(member.username)}`}
                  onClick={() => { setOpen(false); changePage([]); }}
                  className="flex min-h-12 items-center gap-3 rounded px-2 py-2 hover:bg-muted focus-visible:outline focus-visible:outline-primary"
                >
                  {member.image && <img src={member.image} alt="" loading="lazy" className="h-8 w-8 rounded-full object-cover" />}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{member.name ?? member.username}</span>
                    <span className="block truncate text-xs text-muted-foreground">@{member.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No accounts to show.</p>
        )}
        {!error && (before !== undefined || page?.next != null) && (
          <nav aria-label="Following list pages" className="flex justify-between gap-2">
            <Button size="sm" variant="outline" disabled={before === undefined} onClick={() => changePage(cursors.slice(0, -1))}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page?.next == null} onClick={() => {
              if (page?.next != null) changePage([...cursors, page.next]);
            }}>Next</Button>
          </nav>
        )}
      </DialogContent>
    </Dialog>
  );
}

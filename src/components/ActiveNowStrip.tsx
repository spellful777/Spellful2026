import { uploadedMediaUrl } from '@/lib/native-api';
import { Link } from 'react-router';
import { useState } from 'react';

interface ActiveUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

interface Props {
  users: ActiveUser[];
  presence: Record<string, { online: boolean }>;
}

function AvatarBubble({ user, online }: { user: ActiveUser; online: boolean }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const label = user.name?.trim() || user.username || 'Spellful member';
  const image = user.image !== failedImage ? user.image : null;
  const initials = label
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Link
      to={`/u/${encodeURIComponent(user.username || `~${user.id}`)}`}
      aria-label={`View ${label}’s profile`}
      className="flex flex-col items-center gap-1 flex-shrink-0"
      style={{ width: 56 }}>
      <span className="relative">
        <span
          className="flex items-center justify-center rounded-full text-sm font-semibold overflow-hidden"
          style={{
            width: 44,
            height: 44,
            background: image ? 'transparent' : 'hsl(var(--primary) / 0.18)',
            color: 'hsl(var(--primary))',
            border: '2px solid hsl(var(--primary) / 0.35)',
          }}>
          {image ? (
            <img
              src={uploadedMediaUrl(image)}
              onError={() => setFailedImage(image)}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </span>
        {online && <span
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: 11,
            height: 11,
            background: 'hsl(var(--success))',
            border: '2px solid hsl(var(--background))',
          }}
        />}
      </span>
      <span
        className="text-xs truncate w-full text-center leading-tight"
        style={{ color: 'hsl(var(--muted-foreground))', maxWidth: 52 }}>
        {user.name?.split(/\s+/)[0] ?? user.username ?? '?'}
      </span>
    </Link>
  );
}

export default function ActiveNowStrip({ users, presence }: Props) {
  if (users.length === 0) return null;

  return (
    <section className="border-b border-border/50 px-4 py-2" aria-label="Friends">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Friends</p>
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
        {users.map(user => (
          <AvatarBubble key={user.id} user={user} online={presence[user.id]?.online ?? false} />
        ))}
      </div>
    </section>
  );
}

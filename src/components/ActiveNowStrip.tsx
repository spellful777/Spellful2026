/**
 * ActiveNowStrip — horizontal scroll row of online users.
 * Shows members whose presence data indicates they are currently active.
 */
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';

interface ActiveUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

interface Props {
  users: ActiveUser[];
  onStartConversation: (user: ActiveUser) => void;
}

function AvatarBubble({ user, onClick }: { user: ActiveUser; onClick: () => void }) {
  const initials = (user.name ?? user.username ?? '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1 flex-shrink-0"
      style={{ width: 56 }}>
      <span className="relative">
        <span
          className="flex items-center justify-center rounded-full text-sm font-semibold overflow-hidden"
          style={{
            width: 44,
            height: 44,
            background: user.image ? 'transparent' : 'hsl(var(--primary) / 0.18)',
            color: 'hsl(var(--primary))',
            border: '2px solid hsl(var(--primary) / 0.35)',
          }}>
          {user.image ? (
            <img
              src={user.image}
              alt={user.name ?? user.username ?? ''}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </span>
        {/* Green online dot */}
        <span
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: 11,
            height: 11,
            background: 'hsl(var(--success))',
            border: '2px solid hsl(var(--background))',
          }}
        />
      </span>
      <span
        className="text-xs truncate w-full text-center leading-tight"
        style={{ color: 'hsl(var(--muted-foreground))', maxWidth: 52 }}>
        {user.name?.split(' ')[0] ?? user.username ?? '?'}
      </span>
    </motion.button>
  );
}

export default function ActiveNowStrip({ users, onStartConversation }: Props) {
  const navigate = useNavigate();

  if (users.length === 0) return null;

  return (
    <div
      className="px-4 py-2"
      style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Active now
      </p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {users.slice(0, 12).map(u => (
          <AvatarBubble
            key={u.id}
            user={u}
            onClick={() => onStartConversation(u)}
          />
        ))}
        {users.length > 12 && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate('/community/discover')}
            className="flex flex-col items-center gap-1 flex-shrink-0"
            style={{ width: 56 }}>
            <span
              className="flex items-center justify-center rounded-full text-xs font-semibold"
              style={{
                width: 44,
                height: 44,
                background: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
                border: '2px solid hsl(var(--border))',
              }}>
              +{users.length - 12}
            </span>
            <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>More</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}

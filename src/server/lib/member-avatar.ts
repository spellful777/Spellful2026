import { sql } from 'drizzle-orm';
import { STARTER_AVATAR, profileAvatar } from '@/lib/default-avatars';
import { user } from '@/server/db/schema.js';

// Older profile editors saved the hat in avatar_preset without setting image.
// Resolve either representation when reading a profile or a Spark, without rewriting accounts.
export const memberAvatar = sql<string>`coalesce(nullif(${user.image}, ''), nullif(${user.avatarPreset}, ''), ${STARTER_AVATAR.src})`
  .mapWith((value: string) => profileAvatar(value));

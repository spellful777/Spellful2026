import { inboxFlag } from './inbox-flag';

export interface GroupSummary {
  id: number;
  name: string;
  description: string;
  avatarUrl: string | null;
  createdBy: string;
  role: string;
  memberCount: number;
  unreadCount: number;
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;
  lastMessage: { content: string | null; senderId: string; createdAt: string } | null;
  updatedAt: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseInboxGroups(payload: unknown): GroupSummary[] {
  const groups = asRecord(payload)?.groups;
  if (!Array.isArray(groups)) throw new Error('Invalid group list');

  return groups.flatMap(value => {
    const group = asRecord(value);
    if (!group) return [];
    const identifier = group.id ?? group.groupId ?? group.group_id;
    const id = typeof identifier === 'number' || typeof identifier === 'string' ? Number(identifier) : 0;
    if (!Number.isSafeInteger(id) || id <= 0) return [];

    const lastMessage = asRecord(group.lastMessage);
    return [{
      id,
      name: asText(group.name).trim() || asText(group.groupName ?? group.group_name).trim() || 'Group chat',
      description: asText(group.description),
      avatarUrl: asText(group.avatarUrl ?? group.avatar_url) || null,
      createdBy: asText(group.createdBy),
      role: asText(group.role),
      memberCount: Number(group.memberCount) || 0,
      unreadCount: Number(group.unreadCount) || 0,
      isArchived: inboxFlag(group.isArchived),
      isPinned: inboxFlag(group.isPinned),
      isMuted: inboxFlag(group.isMuted),
      lastMessage: lastMessage ? {
        content: asText(lastMessage.content) || null,
        senderId: asText(lastMessage.senderId),
        createdAt: asText(lastMessage.createdAt),
      } : null,
      updatedAt: asText(group.updatedAt ?? group.updated_at),
    }];
  });
}

import { describe, expect, it } from 'vitest';
import { parseInboxGroups } from '../inbox-groups';

describe('inbox group responses', () => {
  it('keeps an existing unnamed group searchable and openable', () => {
    const [group] = parseInboxGroups({ groups: [{ id: 7, unreadCount: 2 }] });
    expect(group).toMatchObject({ id: 7, name: 'Group chat', unreadCount: 2 });
    expect(group.name.toLowerCase()).toContain('group');
  });

  it('keeps group names and skips rows without a usable thread ID', () => {
    expect(parseInboxGroups({ groups: [null, {}, { id: 4, name: 'Moon Circle' }, { group_id: '8', group_name: 'Coven' }] }))
      .toMatchObject([{ id: 4, name: 'Moon Circle' }, { id: 8, name: 'Coven' }]);
  });
});

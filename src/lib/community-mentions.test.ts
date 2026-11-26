import { expect, it } from 'vitest';
import { communityMentionRecipients } from './community-mentions';

it('deduplicates usernames and skips mentions inside code, links and discarded markup', () => {
  expect(communityMentionRecipients('<p>@Moon123 @moon123 and @SkyWatcher</p><code>@Code123</code><a href="/">@Link123</a><script>@Hidden123</script> moon@Other123.com')).toEqual(['moon123', 'skywatcher']);
});

it('caps notification recipients at ten per post or reply', () => {
  const names = Array.from({ length: 11 }, (_, index) => `moon${index}`);
  expect(communityMentionRecipients(names.map(name => `@${name}`).join(' '))).toEqual(names.slice(0, 10));
});

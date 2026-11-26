import { expect, it } from 'vitest';
import { publicShareUrl } from '../share-studio';

it('shares an app route as a public HTTPS link without losing its query or fragment', () => {
  expect(publicShareUrl('capacitor://localhost/community/post/12?ref=share#reply'))
    .toBe('https://spellful.com/community/post/12?ref=share#reply');
  expect(publicShareUrl('https://spellful.com/tarot')).toBe('https://spellful.com/tarot');
});

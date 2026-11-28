// Historical preset keys identify the same hats across older apps and saved profiles.
const hats = [
  { key: 'default-hat-black', label: 'White', src: '/assets/media/avatars-default-hat-black-bd922c2e.png?v=0d075ad276' },
  { key: 'default-hat-orange', label: 'Orange', src: '/assets/media/avatars-default-hat-orange-7802ec79.png?v=e7cdd4ee48' },
  { key: 'default-hat-red', label: 'Red', src: '/assets/media/avatars-default-hat-red-0924e950.png?v=260ae1d470' },
  { key: 'default-hat-blue', label: 'Blue', src: '/assets/media/avatars-default-hat-blue-9a4d6757.png?v=b8db95f152' },
  { key: 'default-hat-green', label: 'Green', src: '/assets/media/avatars-default-hat-green-67bdacc1.png?v=d0b0dc7fad' },
  { key: 'default-hat-purple', label: 'Purple', src: '/assets/media/avatars-default-hat-purple-3e8d2e42.png?v=9523628dab' },
  { key: 'default-hat-rainbow', label: 'Rainbow Pride', src: '/assets/media/avatars-default-hat-rainbow-db059ee9.png?v=dd38274ed4' },
  { key: 'default-hat-lesbian', label: 'Lesbian Pride', src: '/assets/media/avatars-default-hat-lesbian-5bab4424.png?v=786f174611' },
  { key: 'default-hat-trans', label: 'Trans Pride', src: '/assets/media/avatars-default-hat-trans-5369a230.png?v=d56151b051' },
];
export const DEFAULT_AVATARS = hats.map(hat => ({
  ...hat,
  legacyUrl: '/airo-assets/images/avatars/' + hat.key,
}));

export const STARTER_AVATAR = DEFAULT_AVATARS.find(hat => hat.key === 'default-hat-purple')!;

export function findDefaultAvatar(value: unknown) {
  return DEFAULT_AVATARS.find(hat => value === hat.key || value === hat.src || value === hat.legacyUrl
    || value === hat.key.slice(8) || value === hat.src.split('?')[0]);
}

export function profileAvatar(image?: string | null, preset?: string | null): string {
  if (image) return findDefaultAvatar(image)?.src ?? image;
  return findDefaultAvatar(preset)?.src ?? STARTER_AVATAR.src;
}

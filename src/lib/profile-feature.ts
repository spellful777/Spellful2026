export type ProfileFeature =
  | { kind: 'playlist' | 'spark'; id: number }
  | { kind: 'link'; title: string; url: string };

export function parseProfileFeature(value: unknown): ProfileFeature | null {
  if (!value || typeof value !== 'object' || !('kind' in value)) return null;
  if ((value.kind === 'playlist' || value.kind === 'spark') && 'id' in value &&
      typeof value.id === 'number' && Number.isSafeInteger(value.id) && value.id > 0) {
    return { kind: value.kind, id: value.id };
  }
  if (value.kind === 'link' && 'title' in value && 'url' in value &&
      typeof value.title === 'string' && typeof value.url === 'string' &&
      value.title.trim() && value.title.length <= 100 && value.url.length <= 2048) {
    try {
      const url = new URL(value.url);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        return { kind: 'link', title: value.title.trim(), url: url.href };
      }
    } catch { /* Invalid link. */ }
  }
  return null;
}

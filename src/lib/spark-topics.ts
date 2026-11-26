export const SPARK_TOPICS = ['Tarot', 'Moon Magic', 'Herbalism', 'Crystals', 'Astrology', 'Divination', 'Spellwork', 'Meditation', 'Dream Work', 'Shadow Work', 'Runes', 'Numerology', 'Candle Magic', 'Ritual', 'Wicca', 'Paganism'] as const;
export const topicSlug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-');
export const findTopic = (value: unknown) => typeof value === 'string'
  ? SPARK_TOPICS.find(topic => topicSlug(topic) === topicSlug(value)) : undefined;
export const topicPath = (name: string) => '/explore/topics/' + topicSlug(name);

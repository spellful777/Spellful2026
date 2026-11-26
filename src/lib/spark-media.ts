export type SparkMediaKind = 'photo' | 'video';
export interface SparkMedia { id: string; kind: SparkMediaKind }
export interface SparkMediaLimits {
  photos: number;
  photoBytes: number;
  videoBytes: number;
  videoSeconds: number;
}

export const sparkMediaPath = (id: string, poster = false) =>
  `/api/community/spark-media/${id}${poster ? '/poster' : ''}`;
export const isSparkMediaId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);

export interface OriginalSpark {
  id: number;
  title: string;
  authorName: string | null;
  sparkMedia: SparkMedia[] | null;
  imageUrl: string | null;
}

import { SPARK_COMPOSE } from './community-navigation';
import { parseSparkReading, type SparkReading } from './spark-reading';
const prefix = 'spellful-reading-draft:';

export function startSparkReadingDraft(reading: SparkReading) {
  const id = crypto.randomUUID();
  sessionStorage.setItem(prefix + id, JSON.stringify({ reading, created: Date.now() }));
  return SPARK_COMPOSE + '&reading=' + id;
}

export function loadSparkReadingDraft(id: string | null) {
  if (!id || !/^[a-f0-9-]{36}$/.test(id) || typeof window === 'undefined') return null;
  try {
    const record = JSON.parse(sessionStorage.getItem(prefix + id) ?? 'null');
    return record && Date.now() - record.created < 3600000 ? parseSparkReading(record.reading) : null;
  } catch { return null; }
}

export function clearSparkReadingDraft(id: string | null) {
  if (id) sessionStorage.removeItem(prefix + id);
}

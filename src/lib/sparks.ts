export const SPARK_LIMIT = 160;

export function countSparkCharacters(text: string) {
  return Array.from(text).length;
}

export function sparkBodyHtml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

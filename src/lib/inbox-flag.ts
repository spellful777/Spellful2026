/** Accept boolean flags from the API and numeric flags from older SQL-backed responses. */
export function inboxFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

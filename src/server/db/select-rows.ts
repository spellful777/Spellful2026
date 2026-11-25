// mysql2 returns rows for SELECT and a result header for mutations.
// Drizzle's raw execute type does not distinguish those responses.
export function selectRows<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new Error('Expected a SQL result set');
  return value;
}

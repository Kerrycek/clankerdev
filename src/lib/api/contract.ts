export function omitHaveApiParams(params: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const safe: Record<string, unknown> = { ...params };
  for (const key of keys) delete safe[key];
  return safe;
}

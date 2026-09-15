/**
 * Cliente HTTP minimalista con timeout. Devuelve `null` ante cualquier fallo
 * (red, timeout, status !=2xx) para permitir un fallback limpio a mock.
 */
export async function safeFetchJson<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T | null> {
  const { timeoutMs = 8000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

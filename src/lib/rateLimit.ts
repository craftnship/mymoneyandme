/** In-memory fixed-window limiter; one process serves the site, so this is enough for abuse control. */
export function makeRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; start: number }>();
  return (key: string, now = Date.now()) => {
    const h = hits.get(key);
    if (!h || now - h.start > windowMs) {
      hits.set(key, { count: 1, start: now });
      if (hits.size > 10000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
      return true;
    }
    h.count += 1;
    return h.count <= limit;
  };
}

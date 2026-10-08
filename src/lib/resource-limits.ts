// One fixed bucket per operation, not an unbounded map of spoofable client IPs.
// Single-process demo protection; replicas each have independent budgets.
export function createResourceLimits(now: () => number = Date.now) {
  const buckets = new Map<string, { start: number; count: number; active: number }>();
  return {
    enter(name: string, perMinute: number, maxConcurrent: number) {
      const time = now();
      let bucket = buckets.get(name);
      if (!bucket) { bucket = {start: time, count: 0, active: 0}; buckets.set(name, bucket); }
      if (time - bucket.start >= 60_000) { bucket.start = time; bucket.count = 0; }
      if (bucket.count >= perMinute) return { status: 429, retryAfter: Math.max(1, Math.ceil((60_000 - (time - bucket.start)) / 1000)) };
      if (bucket.active >= maxConcurrent) return { status: 503, retryAfter: 3 };
      bucket.count++; bucket.active++;
      let released = false;
      return { release: () => { if (!released) { released = true; bucket!.active--; } } };
    },
  };
}

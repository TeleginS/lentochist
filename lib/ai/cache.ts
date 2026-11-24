import type { Judgment } from './questions';

/**
 * Judgments cached per tweet, so scrolling back or reloading never pays twice.
 * Probabilities are stored, not decisions, so moving a threshold needs no new
 * calls; changing the questions changes the key and so misses the cache.
 */

const PREFIX = 'j:';
const MAX_ENTRIES = 5000;

interface Entry extends Judgment {
  at: number;
}

export async function getCached(key: string): Promise<Judgment | null> {
  const k = PREFIX + key;
  const result = await browser.storage.local.get(k);
  const entry = result[k] as Entry | undefined;
  return entry ? { probabilities: entry.probabilities, provider: entry.provider } : null;
}

export async function putCached(key: string, judgment: Judgment): Promise<void> {
  const entry: Entry = { ...judgment, at: Date.now() };
  await browser.storage.local.set({ [PREFIX + key]: entry });
  writes++;
  if (writes % 200 === 0) void prune();
}

let writes = 0;

/** Drops the oldest entries above MAX_ENTRIES. */
export async function prune(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const entries = Object.entries(all)
    .filter(([k]) => k.startsWith(PREFIX))
    .map(([k, v]) => [k, (v as Entry).at] as const);
  if (entries.length <= MAX_ENTRIES) return;
  entries.sort((a, b) => a[1] - b[1]);
  await browser.storage.local.remove(entries.slice(0, entries.length - MAX_ENTRIES).map(([k]) => k));
}

import { loadKeys, loadSettings, type ProviderId } from '../settings';
import { getCached, putCached } from './cache';
import { loadPreview, type Preview } from './image';
import type { JudgeRequest, JudgeResponse } from './messages';
import { appleFm } from './providers/apple-fm';
import { cloudflare } from './providers/cloudflare';
import { nano } from './providers/nano';
import { jev } from './providers/jev';
import { Unavailable, type Provider } from './providers/types';
import { hashQuestions, type Judgment } from './questions';

/** The provider chain: try each provider in the user's order until one answers. */

async function chain(): Promise<Provider[]> {
  const [settings, keys] = await Promise.all([loadSettings(), loadKeys()]);
  const make: Record<ProviderId, () => Provider[]> = {
    // Apple FM if its helper is installed, else Gemini Nano.
    local: () => [appleFm(), nano()],
    cloudflare: () => [cloudflare(keys.cloudflareAccountId, keys.cloudflareToken)],
    jev: () => [jev(keys.jevApiKey)],
  };
  return settings.providers.order.filter((id) => settings.providers.enabled[id]).flatMap((id) => make[id]());
}

const MAX_PARALLEL = 3;
let running = 0;
const queue: (() => void)[] = [];

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => queue.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    queue.shift()?.();
  }
}

const inFlight = new Map<string, Promise<Judgment>>();

async function run(request: JudgeRequest): Promise<Judgment> {
  let preview: Preview | null = null;
  if (request.previewUrl) {
    preview = await loadPreview(request.previewUrl).catch((e) => {
      console.warn('[lentochist] preview failed', e);
      return null;
    });
  }

  const failures: string[] = [];
  for (const provider of await chain()) {
    try {
      const probabilities = await provider.judge({ state: request.state, questions: request.questions, preview });
      return { probabilities, provider: provider.label };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!(e instanceof Unavailable)) console.warn(`[lentochist] ${provider.label} failed:`, message);
      failures.push(`${provider.label}: ${message}`);
    }
  }
  throw new Error(failures.length ? failures.join('; ') : 'No providers enabled');
}

export async function handleJudge(request: JudgeRequest): Promise<JudgeResponse> {
  const key = [request.filter, hashQuestions(request.questions), request.previewUrl ? 'img' : 'txt', request.tweetId].join(':');
  try {
    const cached = await getCached(key);
    if (cached) return { ok: true, judgment: cached };

    let pending = inFlight.get(key);
    if (!pending) {
      pending = limited(() => run(request)).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    const judgment = await pending;
    await putCached(key, judgment);
    return { ok: true, judgment };
  } catch (e) {
    // A failed call is an error, never a "keep the tweet" answer: nothing is cached.
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

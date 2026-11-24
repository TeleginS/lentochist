import type { Browser } from 'wxt/browser';
import { parseAnswers, SYSTEM_PROMPT, userPrompt } from './generative';
import { Unavailable, type JudgeInput, type Probabilities, type Provider } from './types';

/**
 * Apple Foundation Models through the optional native helper in `native/`.
 * Chrome cannot reach the model directly, so the helper speaks Native Messaging.
 */

export const HOST_NAME = 'com.lentochist.fm';
const TIMEOUT_MS = 30_000;

interface HelperReply {
  id: number;
  error?: string;
  available?: boolean;
  images?: boolean;
  reason?: string;
  answers?: unknown;
}

let port: Browser.runtime.Port | null = null;
let nextId = 1;
const pending = new Map<number, (reply: HelperReply) => void>();

function connect(): Browser.runtime.Port {
  if (port) return port;
  const p = browser.runtime.connectNative(HOST_NAME);
  p.onMessage.addListener((message: unknown) => {
    const reply = message as HelperReply;
    pending.get(reply.id)?.(reply);
    pending.delete(reply.id);
  });
  p.onDisconnect.addListener(() => {
    const reason = browser.runtime.lastError?.message ?? 'helper exited';
    for (const resolve of pending.values()) resolve({ id: 0, error: `disconnected: ${reason}` });
    pending.clear();
    port = null;
  });
  port = p;
  return p;
}

function call(message: object): Promise<HelperReply> {
  return new Promise((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ id, error: 'timeout' });
    }, TIMEOUT_MS);
    pending.set(id, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
    try {
      connect().postMessage({ id, ...message });
    } catch (e) {
      pending.delete(id);
      clearTimeout(timer);
      resolve({ id, error: String(e) });
    }
  });
}

let status: Promise<HelperReply> | null = null;

/** Whether the helper is installed and the model is ready. Cached until the helper disconnects. */
export function appleFmStatus(): Promise<HelperReply> {
  status ??= call({ kind: 'status' }).then((reply) => {
    if (reply.error) status = null;
    return reply;
  });
  return status;
}

export function appleFm(): Provider {
  return {
    label: 'Apple FM',
    async judge({ state, questions, preview }: JudgeInput): Promise<Probabilities> {
      const s = await appleFmStatus();
      if (s.error || !s.available) throw new Unavailable(`Apple FM: ${s.error ?? s.reason ?? 'unavailable'}`);

      const image = preview && s.images ? preview.base64 : undefined;
      const reply = await call({
        kind: 'judge',
        instructions: SYSTEM_PROMPT,
        prompt: userPrompt(state, questions, Boolean(image)),
        image,
      });
      if (reply.error) throw new Error(`Apple FM: ${reply.error}`);
      return parseAnswers(reply, questions);
    },
  };
}

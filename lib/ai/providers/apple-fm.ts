import type { Browser } from 'wxt/browser';
import { parseAnswers, SYSTEM_PROMPT, userPrompt } from './generative';
import type { AppleModel } from '../../settings';
import { Unavailable, type JudgeInput, type Probabilities, type Provider } from './types';

/**
 * Apple Foundation Models through the optional native helper in `native/`.
 * Chrome cannot reach the model directly, so the helper speaks Native Messaging.
 */

export const HOST_NAME = 'com.lentochist.fm';
const TIMEOUT_MS = 30_000;

export interface ModelStatus {
  available: boolean;
  images: boolean;
  reason?: string;
  /** PCC only: whether the helper is signed with the PCC entitlement. */
  entitlement?: boolean;
  /** PCC only: the usage quota is used up. */
  quota?: boolean;
}

interface HelperReply {
  id: number;
  error?: string;
  quota?: boolean;
  system?: ModelStatus;
  pcc?: ModelStatus;
  answers?: unknown;
}

export const APPLE_MODELS: Record<AppleModel, string> = {
  system: 'System: on this Mac, free, private',
  pcc: 'PCC: Apple\'s server model on Private Cloud Compute',
};

const LABELS: Record<AppleModel, string> = { system: 'Apple FM', pcc: 'Apple PCC' };

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

const STATUS_TTL_MS = 60_000;
let status: { at: number; reply: Promise<HelperReply> } | null = null;

/**
 * Whether the helper is installed and each Apple model is ready. Rechecked
 * every minute, since the PCC quota and Apple Intelligence state can change.
 */
export function appleFmStatus(): Promise<HelperReply> {
  if (!status || Date.now() - status.at > STATUS_TTL_MS) {
    const reply = call({ kind: 'status' });
    status = { at: Date.now(), reply };
    void reply.then((r) => {
      if (r.error) status = null;
    });
  }
  return status.reply;
}

export function appleFm(model: AppleModel): Provider {
  const label = LABELS[model];
  return {
    label,
    async judge({ state, questions, preview }: JudgeInput): Promise<Probabilities> {
      const reply = await appleFmStatus();
      const s = reply[model];
      if (reply.error || !s?.available) throw new Unavailable(`${label}: ${reply.error ?? s?.reason ?? 'unavailable'}`);

      const image = preview && s.images ? preview.base64 : undefined;
      const answer = await call({
        kind: 'judge',
        model,
        instructions: SYSTEM_PROMPT,
        prompt: userPrompt(state, questions, Boolean(image)),
        image,
      });
      if (answer.quota) {
        status = null;
        throw new Unavailable(`${label}: quota limit reached`);
      }
      if (answer.error) throw new Error(`${label}: ${answer.error}`);
      return parseAnswers(answer, questions);
    },
  };
}

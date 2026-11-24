import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, saveKeys, saveSettings, type AppleModel } from '@/lib/settings';
import { topicQuestions } from '@/lib/ai/questions';

/** A fake native helper: system model ready, PCC missing its entitlement. */
function fakeHelper() {
  const sent: Record<string, unknown>[] = [];
  vi.spyOn(fakeBrowser.runtime, 'connectNative').mockImplementation(() => {
    const listeners: ((m: unknown) => void)[] = [];
    return {
      onMessage: { addListener: (f: (m: unknown) => void) => listeners.push(f) },
      onDisconnect: { addListener: () => {} },
      postMessage: (m: Record<string, unknown>) => {
        sent.push(m);
        const reply =
          m.kind === 'status'
            ? {
                id: m.id,
                system: { available: true, images: true },
                pcc: { available: false, images: false, reason: 'helper is not signed with com.apple.developer.private-cloud-compute', entitlement: false },
              }
            : { id: m.id, answers: [{ id: 'topic_0', probability: 0.9 }] };
        queueMicrotask(() => listeners.forEach((f) => f(reply)));
      },
    } as never;
  });
  return sent;
}

async function judgeWith(appleModel: AppleModel) {
  vi.resetModules(); // fresh helper connection and status cache
  const { handleJudge } = await import('@/lib/ai/chain');
  await saveSettings({ ...DEFAULT_SETTINGS, providers: { ...DEFAULT_SETTINGS.providers, appleModel } });
  return handleJudge({
    type: 'judge',
    filter: 'topic',
    tweetId: appleModel,
    state: { author: 'A', text: 'Messi scores', media: [] },
    questions: topicQuestions(['football']),
    previewUrl: null,
  });
}

describe('Apple FM provider', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
    await saveKeys({ cloudflareAccountId: 'acc', cloudflareToken: 'cf', jevApiKey: '' });
  });

  it('answers with the on-device model', async () => {
    const sent = fakeHelper();
    expect(await judgeWith('system')).toEqual({
      ok: true,
      judgment: { provider: 'Apple FM', probabilities: { topic_0: 0.9 } },
    });
    expect(sent.find((m) => m.kind === 'judge')).toMatchObject({ model: 'system' });
  });

  it('falls through to Cloudflare when PCC lacks its entitlement', async () => {
    const sent = fakeHelper();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, result: { answers: { topic_0: { noul: 0.4 } } } }))));
    expect(await judgeWith('pcc')).toMatchObject({ ok: true, judgment: { provider: 'Clef Flash' } });
    expect(sent.some((m) => m.kind === 'judge')).toBe(false);
    vi.unstubAllGlobals();
  });
});

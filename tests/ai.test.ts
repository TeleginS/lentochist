import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { handleJudge } from '@/lib/ai/chain';
import { previewSize } from '@/lib/ai/image';
import { parseAnswers } from '@/lib/ai/providers/generative';
import { clefRequest } from '@/lib/ai/providers/cloudflare';
import { jevRequest } from '@/lib/ai/providers/jev';
import { decide, hashQuestions, MEDIA_QUESTIONS, topicQuestions } from '@/lib/ai/questions';
import { DEFAULT_SETTINGS, parseTopics, saveKeys, saveSettings } from '@/lib/settings';

const topics = topicQuestions(['crypto', 'football']);
const state = { author: 'A @a', text: 'Messi scores again', media: [] };

describe('questions', () => {
  it('hides on the most likely question at or above the threshold', () => {
    const judgment = { provider: 'JEV', probabilities: { topic_0: 0.2, topic_1: 0.91 } };
    expect(decide(topics, judgment, 0.8)?.label).toBe('football');
    expect(decide(topics, judgment, 0.95)).toBeNull();
  });

  it('changes the hash when the topic list changes', () => {
    expect(hashQuestions(topics)).toBe(hashQuestions(topicQuestions(['crypto', 'football'])));
    expect(hashQuestions(topics)).not.toBe(hashQuestions(topicQuestions(['crypto'])));
  });

  it('parses topics: trims, dedupes, caps at 30', () => {
    expect(parseTopics(' crypto \n\nCrypto\nfootball')).toEqual(['crypto', 'football']);
    expect(parseTopics(Array.from({ length: 40 }, (_, i) => `t${i}`).join('\n'))).toHaveLength(30);
  });
});

describe('generative answers', () => {
  it('reads JSON, clamps, and tolerates code fences', () => {
    const raw = '```json\n{"answers":[{"id":"topic_0","probability":1.4},{"id":"topic_1","probability":0.3}]}\n```';
    expect(parseAnswers(raw, topics)).toEqual({ topic_0: 1, topic_1: 0.3 });
  });

  it('rejects answers that skip a question', () => {
    expect(() => parseAnswers({ answers: [{ id: 'topic_0', probability: 0.1 }] }, topics)).toThrow(/topic_1/);
  });
});

describe('preview size', () => {
  it('keeps both sides within 280–1568 px', () => {
    expect(previewSize(1200, 900)).toEqual({ width: 768, height: 576 });
    expect(previewSize(2000, 600)).toEqual({ width: 933, height: 280 });
    expect(previewSize(4000, 300)).toBeNull();
  });
});

describe('JEV request', () => {
  it('asks one Noul per question and attaches the image as an asset', () => {
    const body = jevRequest({
      state: { ...state, media: ['photo'] },
      questions: MEDIA_QUESTIONS,
      preview: { base64: 'AAAA', blob: new Blob(), width: 768, height: 576 },
    });
    expect(body.state).toMatchObject({ tweet: 'Messi scores again', attached_media: 'photo', image: 'tweet_image' });
    expect(body.assets).toEqual({ tweet_image: { type: 'image', format: 'jpg', data_base64: 'AAAA' } });
    expect(Object.keys(body.questions)).toEqual(['adult_promo', 'scam', 'viral_junk']);
    expect(body.questions.scam).toMatchObject({ type: 'noul', criteria: { true: expect.any(String) } });
  });
});

describe('Clef request', () => {
  it('uses the System One shape with the image as a data URL', () => {
    const body = clefRequest(
      { state, questions: topics, preview: { base64: 'AAAA', blob: new Blob(), width: 768, height: 576 } },
      'clef-flash',
    );
    expect(body.model).toBe('clef-flash');
    expect(body.images).toEqual(['data:image/jpeg;base64,AAAA']);
    expect(body.questions.topic_1).toMatchObject({ type: 'noul', instructions: 'The tweet is about: football' });
    expect(body.state).not.toHaveProperty('image');
  });
});

describe('provider chain', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    fakeBrowser.reset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    await saveSettings(DEFAULT_SETTINGS);
    await saveKeys({ cloudflareAccountId: 'acc', cloudflareToken: 'cf', jevApiKey: 'jev' });
  });
  afterEach(() => vi.unstubAllGlobals());

  const request = (tweetId: string) => ({
    type: 'judge' as const,
    filter: 'topic' as const,
    tweetId,
    state,
    questions: topics,
    previewUrl: null,
  });

  it('falls through local and an exhausted Cloudflare quota to JEV, then caches', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('cloudflare')
        ? new Response(JSON.stringify({ success: false, errors: [{ code: 3036, message: 'daily free allocation' }] }), { status: 429 })
        : new Response(JSON.stringify({ answers: { topic_0: { noul: 0.05 }, topic_1: { noul: 0.97 } } })),
    );

    const first = await handleJudge(request('1'));
    expect(first).toEqual({ ok: true, judgment: { provider: 'JEV', probabilities: { topic_0: 0.05, topic_1: 0.97 } } });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const jevCall = fetchMock.mock.calls[1]!;
    expect(jevCall[0]).toBe('https://api.typesafe.ai/v1/systemone');
    expect(jevCall[1].headers.Authorization).toBe('Bearer jev');

    await handleJudge(request('1'));
    expect(fetchMock).toHaveBeenCalledTimes(2); // served from cache
  });

  it('uses the chosen Clef model when Cloudflare answers', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, providers: { ...DEFAULT_SETTINGS.providers, cloudflareModel: 'clef' } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        result: { model: 'clef', answers: { topic_0: { type: 'noul', noul: 0.01 }, topic_1: { type: 'noul', noul: 0.9 } } },
      })),
    );
    const response = await handleJudge(request('2'));
    expect(response).toEqual({ ok: true, judgment: { provider: 'Clef', probabilities: { topic_0: 0.01, topic_1: 0.9 } } });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/cloudflare/clef');
  });

  it('accepts a Clef answer without the result wrapper', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ answers: { topic_0: { noul: 0.2 }, topic_1: { noul: 0.3 } } })),
    );
    expect(await handleJudge(request('5'))).toMatchObject({ ok: true, judgment: { provider: 'Clef Flash' } });
  });

  it('reports an error instead of an answer when every provider fails', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const response = await handleJudge(request('3'));
    expect(response.ok).toBe(false);
    expect(await handleJudge(request('3'))).toMatchObject({ ok: false }); // failures are not cached
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

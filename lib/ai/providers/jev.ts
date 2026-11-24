import { Unavailable, type JudgeInput, type Probabilities, type Provider } from './types';

/** TypeSafe JEV: one Noul per question over one shared state; calibrated probabilities. */

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const IMAGE_ID = 'tweet_image';

export function jevRequest({ state, questions, preview }: JudgeInput) {
  return {
    model: MODEL,
    state: {
      author: state.author,
      tweet: state.text,
      ...(state.quoted ? { quoted_tweet: state.quoted } : {}),
      ...(state.media.length ? { attached_media: state.media.join(', ') } : {}),
      ...(preview ? { image: IMAGE_ID } : {}),
    },
    ...(preview
      ? { assets: { [IMAGE_ID]: { type: 'image', format: 'jpg', data_base64: preview.base64 } } }
      : {}),
    questions: Object.fromEntries(
      questions.map((q) => [
        q.id,
        { type: 'noul', instructions: q.statement, criteria: { true: q.whenTrue, false: q.whenFalse } },
      ]),
    ),
  };
}

export function jev(apiKey: string): Provider {
  return {
    label: 'JEV',
    async judge(input: JudgeInput): Promise<Probabilities> {
      if (!apiKey) throw new Unavailable('No JEV API key');
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(input.preview ? { 'TypeSafe-Danger-Zone-Images': 'true' } : {}),
        },
        body: JSON.stringify(jevRequest(input)),
      });
      if (!response.ok) {
        throw new Error(`JEV ${response.status}: ${(await response.text()).slice(0, 300)}`);
      }
      const data = (await response.json()) as { answers: Record<string, { noul?: number }> };
      const result: Probabilities = {};
      for (const q of input.questions) {
        const p = data.answers?.[q.id]?.noul;
        if (typeof p !== 'number') throw new Error(`JEV skipped ${q.id}`);
        result[q.id] = p;
      }
      return result;
    },
  };
}

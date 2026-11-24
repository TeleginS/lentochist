import { readNouls, systemOneQuestions, systemOneState } from './system-one';
import { Unavailable, type JudgeInput, type Probabilities, type Provider } from './types';

/** TypeSafe JEV: one Noul per question over one shared state; calibrated probabilities. */

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const IMAGE_ID = 'tweet_image';

export function jevRequest({ state, questions, preview }: JudgeInput) {
  return {
    model: MODEL,
    // JEV places an image where its asset id appears in the state.
    state: { ...systemOneState(state), ...(preview ? { image: IMAGE_ID } : {}) },
    ...(preview
      ? { assets: { [IMAGE_ID]: { type: 'image', format: 'jpg', data_base64: preview.base64 } } }
      : {}),
    questions: systemOneQuestions(questions),
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
      const data = (await response.json()) as { answers?: Record<string, { noul?: number }> };
      return readNouls(data.answers, input.questions, 'JEV');
    },
  };
}

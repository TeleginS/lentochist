import { ANSWER_SCHEMA, parseAnswers, SYSTEM_PROMPT, userPrompt } from './generative';
import { Unavailable, type JudgeInput, type Probabilities, type Provider } from './types';

/** Gemini Nano built into Chrome (Prompt API). Free and on-device. */

interface LanguageModelApi {
  availability(options?: object): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(options?: object): Promise<{
    prompt(input: unknown, options?: object): Promise<string>;
    destroy(): void;
  }>;
}

const api = (): LanguageModelApi | undefined =>
  (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;

const TEXT = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
const WITH_IMAGE = {
  expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

export async function nanoStatus(withImage = false): Promise<string> {
  const lm = api();
  if (!lm) return 'unavailable';
  return lm.availability(withImage ? WITH_IMAGE : TEXT).catch(() => 'unavailable');
}

export function nano(): Provider {
  return {
    label: 'Gemini Nano',
    async judge({ state, questions, preview }: JudgeInput): Promise<Probabilities> {
      const lm = api();
      if (!lm) throw new Unavailable('Prompt API not available in this Chrome');

      // Fall back to text only when this Chrome cannot take image input.
      const useImage = Boolean(preview) && (await nanoStatus(true)) === 'available';
      const options = useImage ? WITH_IMAGE : TEXT;
      if ((await lm.availability(options)) !== 'available') {
        throw new Unavailable('Gemini Nano model is not downloaded');
      }

      const session = await lm.create({ ...options, initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }] });
      try {
        const text = userPrompt(state, questions, useImage);
        const content = useImage
          ? [{ type: 'text', value: text }, { type: 'image', value: preview!.blob }]
          : [{ type: 'text', value: text }];
        const output = await session.prompt([{ role: 'user', content }], { responseConstraint: ANSWER_SCHEMA });
        return parseAnswers(output, questions);
      } finally {
        session.destroy();
      }
    },
  };
}

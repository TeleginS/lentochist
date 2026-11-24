import type { ClefModel } from '../../settings';
import { readNouls, systemOneQuestions, systemOneState } from './system-one';
import { Unavailable, type JudgeInput, type Probabilities, type Provider } from './types';

/**
 * Cloudflare Workers AI with a Clef decision model. Clef speaks the same
 * System One API as JEV: one Noul per question, probabilities trained for
 * calibration, billed on input tokens only.
 */

export const CLEF_MODELS: Record<ClefModel, string> = {
  'clef-flash': 'Clef Flash: 9B, fastest, ~6× more tweets per free day than Clef',
  clef: 'Clef: 27B, most precise',
  'clef-omni': 'Clef Omni: 30B MoE, also reads audio and video',
};

export function clefRequest({ state, questions, preview }: JudgeInput, model: ClefModel) {
  return {
    model,
    state: systemOneState(state),
    // Clef puts images before the state; it takes data URLs, not remote URLs.
    ...(preview ? { images: [`data:image/jpeg;base64,${preview.base64}`] } : {}),
    questions: systemOneQuestions(questions),
  };
}

type ClefAnswers = Record<string, { noul?: number }>;

export function cloudflare(accountId: string, token: string, model: ClefModel): Provider {
  return {
    label: CLEF_LABELS[model],
    async judge(input: JudgeInput): Promise<Probabilities> {
      if (!accountId || !token) throw new Unavailable('No Cloudflare account ID or token');

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/cloudflare/${model}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(clefRequest(input, model)),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        errors?: { code: number; message: string }[];
        result?: { answers?: ClefAnswers };
        answers?: ClefAnswers;
      } | null;

      if (!response.ok || data?.success === false) {
        const error = data?.errors?.[0];
        // 3036: the free daily neuron allocation is used up.
        if (error?.code === 3036) throw new Unavailable('Cloudflare daily free allocation used up');
        throw new Error(`Cloudflare ${response.status}: ${error?.code ?? ''} ${error?.message ?? ''}`.trim());
      }
      // The REST API usually wraps model output in `result`; accept it bare too.
      return readNouls(data?.result?.answers ?? data?.answers, input.questions, CLEF_LABELS[model]);
    },
  };
}

const CLEF_LABELS: Record<ClefModel, string> = {
  'clef-flash': 'Clef Flash',
  clef: 'Clef',
  'clef-omni': 'Clef Omni',
};

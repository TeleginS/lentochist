import { ANSWER_SCHEMA, parseAnswers, SYSTEM_PROMPT, userPrompt } from './generative';
import { Unavailable, type JudgeInput, type Probabilities, type Provider } from './types';

/** Cloudflare Workers AI; text and vision in one model. */

const MODEL = '@cf/google/gemma-4-26b-a4b-it';

export function cloudflare(accountId: string, token: string): Provider {
  return {
    label: 'Cloudflare',
    async judge({ state, questions, preview }: JudgeInput): Promise<Probabilities> {
      if (!accountId || !token) throw new Unavailable('No Cloudflare account ID or token');

      const text = userPrompt(state, questions, Boolean(preview));
      const content = preview
        ? [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${preview.base64}`, detail: 'low' } },
          ]
        : text;

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'judgment', schema: ANSWER_SCHEMA, strict: true },
            },
            chat_template_kwargs: { enable_thinking: false },
            temperature: 0,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        errors?: { code: number; message: string }[];
        result?: { choices?: { message?: { content?: unknown } }[]; response?: unknown };
      } | null;

      if (!response.ok || !data?.success) {
        const error = data?.errors?.[0];
        // 3036: the free daily neuron allocation is used up.
        if (error?.code === 3036) throw new Unavailable('Cloudflare daily free allocation used up');
        throw new Error(`Cloudflare ${response.status}: ${error?.code ?? ''} ${error?.message ?? ''}`.trim());
      }
      const output = data.result?.choices?.[0]?.message?.content ?? data.result?.response;
      return parseAnswers(output, questions);
    },
  };
}

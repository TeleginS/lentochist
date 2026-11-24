import type { Question, TweetState } from '../questions';
import type { Probabilities } from './types';

/**
 * Shared prompt for generative providers (Apple FM, Gemini Nano, Cloudflare).
 * They state a probability themselves, which is less calibrated than JEV's.
 */

export const SYSTEM_PROMPT =
  'You judge tweets for a personal feed filter. For each statement, give the probability ' +
  'from 0 to 1 that it is true of the tweet. Judge only what the tweet shows. ' +
  'Answer every statement id exactly once.';

export function userPrompt(state: TweetState, questions: Question[], hasImage: boolean): string {
  const tweet = {
    author: state.author,
    text: state.text,
    ...(state.quoted ? { quoted_tweet: state.quoted } : {}),
    ...(state.media.length ? { media: state.media.join(', ') } : {}),
    ...(state.media.length && !hasImage ? { note: 'The media itself is not shown, only its kind.' } : {}),
  };
  const statements = questions.map((q) => ({
    id: q.id,
    statement: q.statement,
    true_when: q.whenTrue,
    false_when: q.whenFalse,
  }));
  return `Tweet:\n${JSON.stringify(tweet, null, 2)}\n\nStatements:\n${JSON.stringify(statements, null, 2)}`;
}

/** JSON schema of the expected answer. */
export const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          probability: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['id', 'probability'],
        additionalProperties: false,
      },
    },
  },
  required: ['answers'],
  additionalProperties: false,
} as const;

/** Reads `{answers:[{id, probability}]}`; throws if any question is unanswered. */
export function parseAnswers(raw: unknown, questions: Question[]): Probabilities {
  const data = typeof raw === 'string' ? JSON.parse(stripFences(raw)) : raw;
  const answers = (data as { answers?: unknown })?.answers;
  if (!Array.isArray(answers)) throw new Error('No answers array in model output');

  const result: Probabilities = {};
  for (const a of answers) {
    const { id, probability } = a as { id?: unknown; probability?: unknown };
    if (typeof id === 'string' && typeof probability === 'number' && Number.isFinite(probability)) {
      result[id] = Math.min(1, Math.max(0, probability));
    }
  }
  const missing = questions.filter((q) => !(q.id in result)).map((q) => q.id);
  if (missing.length) throw new Error(`Model skipped: ${missing.join(', ')}`);
  return result;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

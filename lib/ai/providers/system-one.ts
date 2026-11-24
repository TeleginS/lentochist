import type { Question, TweetState } from '../questions';
import type { Probabilities } from './types';

/**
 * The System One request shape shared by JEV and Cloudflare's Clef models:
 * a state, plus one Noul (probability that a statement is true) per question.
 */

export function systemOneState(state: TweetState): Record<string, string> {
  return {
    author: state.author,
    tweet: state.text,
    ...(state.quoted ? { quoted_tweet: state.quoted } : {}),
    ...(state.media.length ? { attached_media: state.media.join(', ') } : {}),
  };
}

export function systemOneQuestions(questions: Question[]) {
  return Object.fromEntries(
    questions.map((q) => [
      q.id,
      { type: 'noul', instructions: q.statement, criteria: { true: q.whenTrue, false: q.whenFalse } },
    ]),
  );
}

/** Reads `answers.<id>.noul`; throws if any question is unanswered. */
export function readNouls(
  answers: Record<string, { noul?: number }> | undefined,
  questions: Question[],
  label: string,
): Probabilities {
  const result: Probabilities = {};
  for (const q of questions) {
    const p = answers?.[q.id]?.noul;
    if (typeof p !== 'number') throw new Error(`${label} skipped ${q.id}`);
    result[q.id] = p;
  }
  return result;
}

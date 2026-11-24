/**
 * Everything the AI filters ask a model, in one place. Each question is a
 * statement about the tweet; a provider answers with the probability that it
 * is true. Code, not the model, decides whether to hide (see `decide`).
 */

import type { MediaKind } from '../feed';

/** What a person would look at to judge the tweet. */
export interface TweetState {
  author: string;
  text: string;
  /** Text of a quoted tweet, if any. */
  quoted?: string;
  media: MediaKind[];
}

export interface Question {
  id: string;
  /** Shown in the stub when this question hides the tweet. */
  label: string;
  statement: string;
  /** What a true answer looks like. */
  whenTrue: string;
  /** What a false answer looks like, as a concrete situation. */
  whenFalse: string;
}

export type AiFilter = 'topic' | 'media';

export function topicQuestions(topics: string[]): Question[] {
  return topics.map((topic, i) => ({
    id: `topic_${i}`,
    label: topic,
    statement: `The tweet is about: ${topic}`,
    whenTrue: `The main subject of the tweet is ${topic}, or the tweet clearly takes part in it.`,
    whenFalse: `The tweet is about something else and mentions ${topic} at most in passing.`,
  }));
}

export const MEDIA_QUESTIONS: Question[] = [
  {
    id: 'adult_promo',
    label: '18+ promo',
    statement: 'The tweet advertises 18+ content or an adult creator page.',
    whenTrue: 'It promotes erotic content, an OnlyFans or Boosty page, or links to one, often with a suggestive photo.',
    whenFalse: 'The photo or video is not used to sell or link to adult content.',
  },
  {
    id: 'scam',
    label: 'scam',
    statement: 'The tweet is a scam.',
    whenTrue: 'It tries to get money, crypto, logins or personal data by deception: fake giveaways, fake investments, impersonation.',
    whenFalse: 'It does not ask the reader to pay, invest, connect a wallet or share data under false pretences.',
  },
  {
    id: 'viral_junk',
    label: 'useless viral content',
    statement: 'The tweet is low-value viral content.',
    whenTrue: 'A reposted meme, shock clip, rage bait or engagement bait ("like if you agree") that informs about nothing.',
    whenFalse: 'The media shows news, the author\'s own work or life, or something the reader can learn from.',
  },
];

/** Probability per question id, as answered by one provider. */
export interface Judgment {
  probabilities: Record<string, number>;
  provider: string;
}

/** The question most likely to be true, if it reaches the threshold. */
export function decide(
  questions: Question[],
  judgment: Judgment,
  threshold: number,
): Question | null {
  let best: Question | null = null;
  let bestP = -1;
  for (const q of questions) {
    const p = judgment.probabilities[q.id] ?? 0;
    if (p > bestP) {
      best = q;
      bestP = p;
    }
  }
  return best && bestP >= threshold ? best : null;
}

/** Short stable hash, used to invalidate cached judgments when questions change. */
export function hashQuestions(questions: Question[]): string {
  const text = questions.map((q) => `${q.id}\u0000${q.statement}`).join('\u0001');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

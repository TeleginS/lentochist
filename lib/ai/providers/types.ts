import type { Question, TweetState } from '../questions';
import type { Preview } from '../image';

export interface JudgeInput {
  state: TweetState;
  questions: Question[];
  preview: Preview | null;
}

/** Probability per question id. */
export type Probabilities = Record<string, number>;

export interface Provider {
  /** Shown in the stub, e.g. "JEV". */
  label: string;
  /** Throws when the provider cannot answer; the chain then tries the next one. */
  judge(input: JudgeInput): Promise<Probabilities>;
}

/** A provider that is not set up here (no key, no model, no helper). Not worth logging loudly. */
export class Unavailable extends Error {}

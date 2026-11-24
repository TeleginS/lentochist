import type { AiFilter, Judgment, Question, TweetState } from './questions';

/** Content script → service worker: judge one tweet for one AI filter. */
export interface JudgeRequest {
  type: 'judge';
  filter: AiFilter;
  tweetId: string;
  state: TweetState;
  questions: Question[];
  /** pbs.twimg.com image to downscale and show the model, if previews are on. */
  previewUrl: string | null;
}

export type JudgeResponse =
  | { ok: true; judgment: Judgment }
  | { ok: false; error: string };

export function judge(request: Omit<JudgeRequest, 'type'>): Promise<JudgeResponse> {
  return browser.runtime.sendMessage({ type: 'judge', ...request } satisfies JudgeRequest);
}

/**
 * Reading tweets from X's DOM. X runs two web UIs (see AGENTS.md); each has
 * its own module, and every selector X can break lives in one of them.
 * The rest of the extension only sees `FeedTweet`.
 */

import { rwebTweets } from './rweb';
import { xwebTweets } from './xweb';

export type MediaKind = 'photo' | 'video' | 'gif';

export interface TweetMedia {
  kinds: MediaKind[];
  /** A pbs.twimg.com photo or video poster to show the model. */
  previewUrl: string | null;
}

export interface FeedTweet {
  /** The element a stub replaces. Also where per-tweet bookkeeping is stored. */
  element: HTMLElement;
  id: string | null;
  /** Text of the tweet itself, without a quoted tweet. */
  mainText(): string;
  /** Text of a quoted tweet, or ''. */
  quotedText(): string;
  /** Display name and @handle. */
  author(): string;
  media(): TweetMedia;
  /** Whether X marks this tweet as an ad. */
  isAd(): boolean;
}

const STATUS_PATH = /^\/[^/]+\/status\/(\d+)/;

export function statusId(href: string): string | null {
  return STATUS_PATH.exec(new URL(href, location.origin).pathname)?.[1] ?? null;
}

/** Whether the current page is one where tweets get filtered. */
export function isFilteredPage(pathname: string): boolean {
  return pathname === '/home' || pathname.startsWith('/search') || STATUS_PATH.test(pathname);
}

/** The tweet a thread page is about; it is never hidden. */
export function focalTweetId(pathname: string): string | null {
  return STATUS_PATH.exec(pathname)?.[1] ?? null;
}

/** Every tweet on the page, in whichever UI X rendered it. */
export function findTweets(root: ParentNode): FeedTweet[] {
  return [...rwebTweets(root), ...xwebTweets(root)];
}

export function smallImage(src: string): string {
  const url = new URL(src);
  url.searchParams.set('name', 'small');
  return url.href;
}

export function fullText(tweet: FeedTweet): string {
  return [tweet.mainText(), tweet.quotedText()].filter(Boolean).join('\n');
}

/** Reading X's DOM. All selectors X can break live here. */

export const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const TEXT_SELECTOR = '[data-testid="tweetText"]';
const STATUS_PATH = /^\/[^/]+\/status\/(\d+)/;

/** Whether the current page is one where tweets get filtered. */
export function isFilteredPage(pathname: string): boolean {
  return pathname === '/home' || pathname.startsWith('/search') || STATUS_PATH.test(pathname);
}

/** The tweet a thread page is about; it is never hidden. */
export function focalTweetId(pathname: string): string | null {
  return STATUS_PATH.exec(pathname)?.[1] ?? null;
}

export function tweetId(article: Element): string | null {
  for (const link of article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')) {
    if (!link.querySelector('time')) continue;
    const id = STATUS_PATH.exec(new URL(link.href, location.origin).pathname)?.[1];
    if (id) return id;
  }
  return null;
}

/** Text of the tweet itself, without a quoted tweet. */
export function mainText(article: Element): string {
  return article.querySelector<HTMLElement>(TEXT_SELECTOR)?.innerText.trim() ?? '';
}

/** Text of the tweet and any quoted tweet. */
export function fullText(article: Element): string {
  return [...article.querySelectorAll<HTMLElement>(TEXT_SELECTOR)]
    .map((el) => el.innerText.trim())
    .join('\n');
}

export type MediaKind = 'photo' | 'video' | 'gif';

export interface TweetMedia {
  kinds: MediaKind[];
  /** A pbs.twimg.com photo or video poster to show the model. */
  previewUrl: string | null;
}

/** Photos, videos and GIFs of the tweet itself. */
export function tweetMedia(article: Element): TweetMedia {
  const kinds = new Set<MediaKind>();
  let previewUrl: string | null = null;

  for (const img of article.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img')) {
    if (!img.src.includes('pbs.twimg.com/media/')) continue;
    kinds.add('photo');
    previewUrl ??= smallImage(img.src);
  }
  for (const video of article.querySelectorAll<HTMLVideoElement>('video')) {
    const poster = video.poster;
    kinds.add(poster.includes('tweet_video_thumb') ? 'gif' : 'video');
    if (poster.includes('pbs.twimg.com')) previewUrl ??= poster;
  }

  return { kinds: [...kinds], previewUrl };
}

function smallImage(src: string): string {
  const url = new URL(src);
  url.searchParams.set('name', 'small');
  return url.href;
}

/** Display name and handle as X shows them. */
export function tweetAuthor(article: Element): string {
  const el = article.querySelector<HTMLElement>('[data-testid="User-Name"]');
  return el?.innerText.replace(/\s*\n\s*/g, ' ').split(' · ')[0]?.trim() ?? '';
}

/** Text of a quoted tweet, if any. */
export function quotedText(article: Element): string {
  const texts = article.querySelectorAll<HTMLElement>(TEXT_SELECTOR);
  return texts.length > 1 ? (texts[1]?.innerText.trim() ?? '') : '';
}

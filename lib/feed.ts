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

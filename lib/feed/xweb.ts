/**
 * The new X web UI ("xweb"): no data-testid attributes. Timeline rows are
 * `[id^="urt:"] > ul > li[data-index]`; a tweet is `[data-href="/user/status/ID"] > article`.
 *
 * Verified against Control Panel for Twitter's source: rows, tweet element,
 * ID and handle from data-href, the quote frame, photos, video elements.
 * NOT verified on a live page: that the tweet text is the element carrying
 * a `lang` attribute, and how GIFs differ from videos. The display name is
 * unknown, so the author is the @handle. If text reading is wrong, filters
 * see empty text and hide nothing; see `warnIfTextMissing`.
 */

import { isXwebAdRow } from '../ads';
import { smallImage, type FeedTweet, type MediaKind, type TweetMedia } from './index';

const QUOTE_FRAME = '[data-slot="embedded-tweet-frame"]';
const DATA_HREF = /^\/([A-Za-z\d_]{1,20})\/status\/(\d+)/;

function text(el: Element | null | undefined): string {
  if (!el) return '';
  return ((el as HTMLElement).innerText ?? el.textContent ?? '').trim();
}

function outsideQuote(el: Element, article: Element): boolean {
  const frame = el.closest(QUOTE_FRAME);
  return !frame || !article.contains(frame);
}

/** The innermost `[lang]` element of the tweet itself, skipping the quote frame. */
function mainTextElement(article: Element): Element | undefined {
  return [...article.querySelectorAll('[lang]')].find(
    (el) => outsideQuote(el, article) && !el.querySelector('[lang]'),
  );
}

function quotedTextElement(article: Element): Element | undefined {
  return article.querySelector(`${QUOTE_FRAME} [lang]`) ?? undefined;
}

function media(article: Element): TweetMedia {
  const kinds = new Set<MediaKind>();
  let previewUrl: string | null = null;
  for (const img of article.querySelectorAll<HTMLImageElement>('img[src^="https://pbs.twimg.com/media/"]')) {
    kinds.add('photo');
    previewUrl ??= smallImage(img.src);
  }
  for (const video of article.querySelectorAll<HTMLVideoElement>('video')) {
    const poster = video.getAttribute('poster') ?? '';
    // Unverified for xweb: rweb marks GIF posters with tweet_video_thumb.
    kinds.add(poster.includes('tweet_video_thumb') ? 'gif' : 'video');
    if (poster.includes('pbs.twimg.com')) previewUrl ??= poster;
  }
  return { kinds: [...kinds], previewUrl };
}

let seen = 0;
let withText = 0;
let warned = false;

/** Logs once if many xweb tweets show up but none yields text: the `[lang]` guess is wrong. */
function warnIfTextMissing(hasText: boolean): void {
  seen++;
  if (hasText) withText++;
  if (!warned && seen >= 20 && withText === 0) {
    warned = true;
    console.warn('[lentochist] New X UI: found tweets but no tweet text. Text-based filters cannot work; see lib/feed/xweb.ts.');
  }
}

export function xwebTweets(root: ParentNode): FeedTweet[] {
  const tweets: FeedTweet[] = [];
  for (const holder of root.querySelectorAll<HTMLElement>('[id^="urt:"] [data-href]')) {
    const match = DATA_HREF.exec(holder.getAttribute('data-href') ?? '');
    const article = holder.querySelector<HTMLElement>(':scope > article');
    if (!match || !article || holder.closest(QUOTE_FRAME)) continue;

    const [, handle, id] = match;
    const main = mainTextElement(article);
    warnIfTextMissing(Boolean(text(main)));

    tweets.push({
      element: article,
      id: id ?? null,
      mainText: () => text(mainTextElement(article)),
      quotedText: () => text(quotedTextElement(article)),
      author: () => `@${handle}`,
      media: () => media(article),
      isAd: () => {
        const row = holder.closest('li[data-index]');
        return row ? isXwebAdRow(row) : false;
      },
    });
  }
  return tweets;
}

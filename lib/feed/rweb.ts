/** The old X web UI ("rweb"): marked up with data-testid attributes. */

import { isRwebAdTweet } from '../ads';
import { smallImage, statusId, type FeedTweet, type MediaKind, type TweetMedia } from './index';

const TWEET = 'article[data-testid="tweet"]';
const TEXT = '[data-testid="tweetText"]';

function id(article: Element): string | null {
  for (const link of article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')) {
    if (!link.querySelector('time')) continue;
    const found = statusId(link.href);
    if (found) return found;
  }
  return null;
}

function media(article: Element): TweetMedia {
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

function texts(article: Element): HTMLElement[] {
  return [...article.querySelectorAll<HTMLElement>(TEXT)];
}

export function rwebTweets(root: ParentNode): FeedTweet[] {
  return [...root.querySelectorAll<HTMLElement>(TWEET)].map((article) => ({
    element: article,
    id: id(article),
    mainText: () => texts(article)[0]?.innerText.trim() ?? '',
    quotedText: () => texts(article)[1]?.innerText.trim() ?? '',
    author: () =>
      article
        .querySelector<HTMLElement>('[data-testid="User-Name"]')
        ?.innerText.replace(/\s*\n\s*/g, ' ')
        .split(' · ')[0]
        ?.trim() ?? '',
    media: () => media(article),
    isAd: () => isRwebAdTweet(article),
  }));
}

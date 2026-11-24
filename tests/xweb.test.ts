// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { findTweets, fullText } from '@/lib/feed';

const row = (i: number, inner: string) => `<li data-index="${i}">${inner}</li>`;

beforeEach(() => {
  document.body.innerHTML = `<main><div id="urt:home:for-you:"><ul>
    ${row(0, `<div data-href="/alice/status/101"><article>
      <a href="/alice">Alice</a><div lang="ru"><span>Великолепный гол Месси</span></div>
    </article></div>`)}
    ${row(1, `<div data-href="/bob/status/102"><article>
      <div lang="en">Look at this</div>
      <div data-slot="embedded-tweet-frame"><div data-href="/carol/status/50"><article><div lang="en">quoted words</div></article></div></div>
      <img src="https://pbs.twimg.com/media/XYZ?format=jpg&name=medium">
      <video poster="https://pbs.twimg.com/tweet_video_thumb/G.jpg"></video>
    </article></div>`)}
    ${row(2, `<div data-href="/advertiser/status/103"><article>
      <a href="/advertiser">Ad</a><button><svg><use href="#icon-more-dots-hor"></use></svg></button><div lang="en">buy now</div>
    </article></div>`)}
  </ul></div></main>`;
});

describe('new X UI tweets', () => {
  it('finds tweets by data-href and skips quoted ones', () => {
    expect(findTweets(document).map((t) => t.id)).toEqual(['101', '102', '103']);
  });

  it('reads text, quote, handle and media', () => {
    const [alice, bob] = findTweets(document);
    expect(alice!.mainText()).toBe('Великолепный гол Месси');
    expect(alice!.author()).toBe('@alice');
    expect(alice!.media().kinds).toEqual([]);

    expect(bob!.mainText()).toBe('Look at this');
    expect(bob!.quotedText()).toBe('quoted words');
    expect(fullText(bob!)).toBe('Look at this\nquoted words');
    expect(bob!.media()).toEqual({
      kinds: ['photo', 'gif'],
      previewUrl: 'https://pbs.twimg.com/media/XYZ?format=jpg&name=small',
    });
  });

  it('uses the article as the element a stub replaces, and knows ads', () => {
    const tweets = findTweets(document);
    expect(tweets[0]!.element.tagName).toBe('ARTICLE');
    expect(tweets.map((t) => t.isAd())).toEqual([false, false, true]);
  });
});

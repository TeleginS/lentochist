// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyAdRemoval, isRwebAdTweet, isXwebAdRow } from '@/lib/ads';

const PROMOTED_PATH = 'M19.498 3h-15c-1.381 0-2.5 1.12-2.5 2.5v13c0 1.38 1.119 2.5 2.5 2.5h15c1.381 0 2.5-1.12 2.5-2.5v-13c0-1.38-1.119-2.5-2.5-2.5zm-3.502 12h-2v-3.59l-5.293 5.3-1.414-1.42L12.581 10H8.996V8h7v7z';

const tweetCell = (inner: string) =>
  `<div data-testid="cellInnerDiv"><div class="content">${inner}</div></div>`;
const article = '<article data-testid="tweet"><div data-testid="tweetText">text</div></article>';

const xwebRow = (inner: string, i: number) => `<li data-index="${i}"><div data-href="/u/status/${i}"><article>${inner}</article></div></li>`;
const moreButton = '<button><svg><use href="#icon-more-dots-hor"></use></svg></button>';

describe('ad removal, old UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      ${tweetCell(article)}
      ${tweetCell(`<div data-testid="placementTracking">${article}<div data-testid="abc-impression-pixel"></div></div>`)}
      <div data-testid="UserCell" id="promoted-user"><svg><path d="${PROMOTED_PATH}"></path></svg></div>
      <div data-testid="UserCell" id="normal-user"><svg><path d="M1 1h2"></path></svg></div>`;
  });

  it('hides the content of ad cells and promoted accounts only', () => {
    applyAdRemoval(document, true);
    const contents = document.querySelectorAll('.content');
    expect(contents[0]!.classList.contains('lentochist-ad')).toBe(false);
    expect(contents[1]!.classList.contains('lentochist-ad')).toBe(true);
    expect(document.getElementById('promoted-user')!.classList.contains('lentochist-ad')).toBe(true);
    expect(document.getElementById('normal-user')!.classList.contains('lentochist-ad')).toBe(false);
  });

  it('knows which tweets are ads so filters can skip them', () => {
    const [normal, ad] = document.querySelectorAll('article');
    expect(isRwebAdTweet(normal!)).toBe(false);
    expect(isRwebAdTweet(ad!)).toBe(true);
  });

  it('shows ads again when the toggle is off', () => {
    applyAdRemoval(document, true);
    applyAdRemoval(document, false);
    expect(document.querySelectorAll('.lentochist-ad')).toHaveLength(0);
  });
});

describe('ad removal, new UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="urt:home"><ul>
      ${xwebRow(`<a href="/alice/status/1">5m</a>${moreButton}<p>normal tweet that says Ad</p>`, 0)}
      ${xwebRow(`<a href="/advertiser">Ad</a>${moreButton}<p>buy</p>`, 1)}
      ${xwebRow(`<a target="_blank" href="https://shop.example">Реклама от shop.example</a>`, 2)}
      ${xwebRow(`<span><svg data-icon="icon-rocket"></svg></span>`, 3)}
    </ul></div>`;
  });

  it('collapses ad rows and leaves normal tweets', () => {
    applyAdRemoval(document, true);
    const rows = [...document.querySelectorAll('li')].map((li) => li.classList.contains('lentochist-ad-row'));
    expect(rows).toEqual([false, true, true, true]);
  });

  it('unmarks a reused row that no longer holds an ad', () => {
    applyAdRemoval(document, true);
    const row = document.querySelectorAll('li')[1]!;
    row.innerHTML = '<article><a href="/bob/status/9">1m</a><p>now a normal tweet</p></article>';
    applyAdRemoval(document, true);
    expect(row.classList.contains('lentochist-ad-row')).toBe(false);
    expect(isXwebAdRow(row)).toBe(false);
  });
});

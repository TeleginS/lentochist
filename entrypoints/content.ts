import { AD_STYLES, applyAdRemoval, isRwebAdTweet } from '@/lib/ads';
import { judge } from '@/lib/ai/messages';
import { decide, MEDIA_QUESTIONS, topicQuestions, type AiFilter, type Question, type TweetState } from '@/lib/ai/questions';
import {
  focalTweetId,
  fullText,
  isFilteredPage,
  mainText,
  quotedText,
  tweetAuthor,
  tweetId,
  tweetMedia,
  TWEET_SELECTOR,
} from '@/lib/feed';
import { parseKeywords, checkKeywords, type Keyword } from '@/lib/keywords';
import { checkLanguage, detectLanguage } from '@/lib/languages';
import { loadSettings, onSettingsChanged, parseTopics, type Settings } from '@/lib/settings';
import { forgetDetached, hide, reveal, revealAll, STUB_STYLES } from '@/lib/stub';
import type { HideReason } from '@/lib/verdict';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',

  async main() {
    let settings: Settings = await loadSettings();
    let keywords: Keyword[] = parseKeywords(settings.keywords.list).keywords;
    let topics: Question[] = topicQuestions(parseTopics(settings.topics.list));
    /** Bumped whenever settings or the page change, so every tweet is checked again. */
    let generation = 0;
    let lastPath = location.pathname;
    /** Tweets the reader reopened with Show stay visible until the tab reloads. */
    const shown = new Set<string>();

    const style = document.createElement('style');
    style.textContent = STUB_STYLES + AD_STYLES;
    document.head.append(style);

    async function localVerdict(article: HTMLElement): Promise<HideReason | null> {
      const keywordHit = settings.keywords.enabled ? checkKeywords(fullText(article), keywords) : null;
      // Language goes first in the stub, but it needs an async detection, so
      // keywords are computed up front and only used if language passes.
      if (settings.languages.enabled) {
        const language = checkLanguage(await detectLanguage(mainText(article)), settings.languages);
        if (language) return language;
      }
      return keywordHit;
    }

    async function process(article: HTMLElement): Promise<void> {
      const id = tweetId(article);
      const key = `${generation}:${id ?? ''}`;
      if (article.dataset.lentochist === key) return;
      article.dataset.lentochist = key;
      // The element may still carry a stub from the tweet X rendered in it before.
      reveal(article);

      if (!id || shown.has(id) || id === focalTweetId(location.pathname)) return;
      // Ad removal handles ads; never spend filters or AI calls on them.
      if (settings.ads.remove && isRwebAdTweet(article)) return;

      // X may reuse this element for another tweet while we wait.
      const current = () => article.dataset.lentochist === key;
      let hidden = false;
      const hideOnce = (reason: HideReason) => {
        if (!current() || hidden) return;
        hidden = true;
        hide(article, reason, () => shown.add(id));
      };

      const local = await localVerdict(article);
      if (local) return hideOnce(local);
      if (!current()) return;

      // AI filters run only when local filters let the tweet through. The tweet
      // stays visible while they think; topics and media are independent.
      const media = tweetMedia(article);
      const state: TweetState = {
        author: tweetAuthor(article),
        text: mainText(article),
        quoted: quotedText(article) || undefined,
        media: media.kinds,
      };
      const askAi = async (filter: AiFilter, questions: Question[], threshold: number, previewUrl: string | null) => {
        const response = await judge({ filter, tweetId: id, state, questions, previewUrl });
        if (!response.ok) {
          console.debug('[lentochist]', filter, id, response.error);
          return;
        }
        const hit = decide(questions, response.judgment, threshold);
        if (hit) hideOnce({ filter, reason: hit.label, provider: response.judgment.provider });
      };

      const jobs: Promise<void>[] = [];
      if (settings.topics.enabled && topics.length && (state.text || state.quoted)) {
        jobs.push(askAi('topic', topics, settings.topics.threshold, null));
      }
      if (settings.media.enabled && media.kinds.length) {
        const preview = settings.media.sendPreview ? media.previewUrl : null;
        jobs.push(askAi('media', MEDIA_QUESTIONS, settings.media.threshold, preview));
      }
      await Promise.all(jobs);
    }

    function scan(): void {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        generation++;
        revealAll();
      }
      forgetDetached();
      // Ads go everywhere X shows tweets, profiles included; filters only on filtered pages.
      applyAdRemoval(document, settings.ads.remove);
      if (!isFilteredPage(location.pathname)) return;
      for (const article of document.querySelectorAll<HTMLElement>(TWEET_SELECTOR)) {
        void process(article);
      }
    }

    let scheduled = false;
    function scheduleScan(): void {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        scan();
      });
    }

    onSettingsChanged((next) => {
      settings = next;
      keywords = parseKeywords(next.keywords.list).keywords;
      topics = topicQuestions(parseTopics(next.topics.list));
      generation++;
      revealAll();
      scheduleScan();
    });

    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
    scan();
  },
});

import { focalTweetId, fullText, isFilteredPage, mainText, tweetId, TWEET_SELECTOR } from '@/lib/feed';
import { parseKeywords, checkKeywords, type Keyword } from '@/lib/keywords';
import { checkLanguage, detectLanguage } from '@/lib/languages';
import { loadSettings, onSettingsChanged, type Settings } from '@/lib/settings';
import { forgetDetached, hide, reveal, revealAll, STUB_STYLES } from '@/lib/stub';
import type { HideReason } from '@/lib/verdict';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',

  async main() {
    let settings: Settings = await loadSettings();
    let keywords: Keyword[] = parseKeywords(settings.keywords.list).keywords;
    /** Bumped whenever settings or the page change, so every tweet is checked again. */
    let generation = 0;
    let lastPath = location.pathname;
    /** Tweets the reader reopened with Show stay visible until the tab reloads. */
    const shown = new Set<string>();

    const style = document.createElement('style');
    style.textContent = STUB_STYLES;
    document.head.append(style);

    async function verdict(article: HTMLElement): Promise<HideReason | null> {
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

      const reason = await verdict(article);
      // X may have reused this element for another tweet while we were waiting.
      if (!reason || article.dataset.lentochist !== key) return;
      hide(article, reason, () => shown.add(id));
    }

    function scan(): void {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        generation++;
        revealAll();
      }
      forgetDetached();
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
      generation++;
      revealAll();
      scheduleScan();
    });

    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
    scan();
  },
});

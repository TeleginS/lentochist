# Onboarding

Welcome to lentochist: a Chrome extension that cleans up the X/Twitter feed.
This guide gets you from clone to a working extension and gives you the map
you need to change it. Read `README.md` for what it does, `GLOSSARY.md` for
the words we use, and `AGENTS.md` for the rules that are easy to break.

## 1. What it does, in one minute

- **Ad removal** (on by default): tweets and "Who to follow" accounts that X
  marks as ads disappear everywhere, with no trace.
- **Four filters** collapse unwanted tweets into a one-line **stub** with a
  Show button, for example "Tweet hidden — topic: football · Clef Flash".
  - **Languages** and **Keywords** run locally.
  - **Topics** and **Media** ask an AI model.
- **Where:** filters run on the home feed, reply threads and search.
  Profiles are left alone.
- **No backend.** Each user loads the extension unpacked and enters their
  own keys. See `docs/adr/0001-no-backend.md` for why.

## 2. Set up (about 10 minutes)

You need Node 22+ and Google Chrome 138+. For the Apple model you also need
macOS 26+ with Apple Intelligence and Xcode.

```sh
git clone git@github.com:TeleginS/lentochist.git && cd lentochist
npm install
npm run build
```

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load
   unpacked** and pick `.output/chrome-mv3`.
2. Click the toolbar icon to open the settings.
3. Open x.com. Ads should already be gone.
4. Turn on **01 Languages** with "Keep only selected", and you will see
   stubs right away.

For day-to-day work run `npm run dev`. It opens a browser with live reload.

### AI filters

Pick at least one provider under **05 Providers**:

| Provider | Cost | Setup |
|---|---|---|
| Apple FM (on this Mac) | free | `native/install.sh` once, then reload the extension |
| Gemini Nano (in Chrome) | free | the "Download Gemini Nano" button, if your device supports it |
| Cloudflare Workers AI, Clef models | 10,000 neurons a day free | account ID and an API token with Workers AI Read + Edit |
| JEV (TypeSafe) | paid per input token | API key |

The **provider chain** tries them top to bottom and falls through when one is
missing, out of quota or failing. The stub names the provider that hid the
tweet.

Apple PCC (Apple's server model) is in the list too. It only works if the
helper is signed with Apple's restricted Private Cloud Compute entitlement.
See README.

## 3. Map of the code

```
entrypoints/
  content.ts        runs on x.com: ad removal, then local filters, then AI filters
  background.ts     service worker: answers "judge" requests through the provider chain
  options/          settings page (ads toggle + sections 01–05)
lib/
  feed/             reading tweets from X's DOM: every tweet selector lives here
    index.ts        FeedTweet: the only shape the rest of the code sees
    rweb.ts         X's old web UI (data-testid markup)
    xweb.ts         X's new web UI (no test ids; NOT verified live)
  ads.ts            ad removal for both UIs
  languages.ts      language filter (Chrome's built-in detector)
  keywords.ts       keyword filter (ru/en stemming, /regex/ lines)
  stub.ts           the stub and its Show button
  settings.ts       settings, defaults, provider keys (stored apart)
  ai/
    questions.ts    every statement the AI filters ask, and decide()
    chain.ts        provider chain, cache, concurrency limit
    image.ts        media preview downscaling
    providers/      apple-fm, nano, cloudflare (Clef), jev, plus shared shapes
native/             Swift helper that lets Chrome reach Apple Foundation Models
tests/              vitest; fakeBrowser for chrome.*, jsdom for DOM tests
docs/adr/           architecture decisions
```

What happens to one tweet:

1. `content.ts` finds it through `findTweets()` in `lib/feed`.
2. If it is an ad, ad removal takes it and nothing else runs.
3. Otherwise the Languages and Keywords filters check it. If one hits, the
   tweet gets a stub.
4. Otherwise Topics and Media ask the service worker in parallel. The tweet
   stays visible while they wait.
5. The worker checks the cache, then walks the provider chain. It caches the
   probabilities, never the decision.
6. Back in the content script, `decide()` compares those probabilities with
   the user's threshold and adds a stub if needed.

## 4. How we work

- **Settle the design before writing code.** New features start with a
  grilling session that walks through the open decisions one by one.
  - Settled terms go into `GLOSSARY.md` straight away.
  - Decisions that are hard to reverse go into `docs/adr/`.
- **Use the glossary terms:** filter, ad removal, provider, provider chain,
  statement, judgment, stub, helper, preview. If you need a new word, add it
  to the glossary first.
- **Before you push,** run `npm test`, `npm run typecheck` and `npm run build`.
- **Say what you verified, and how.** "Tested on live x.com" and "tested
  against a mocked feed" are different claims. Write down which one you
  mean, in the PR and in the commit.
- **Commits** are small and describe the behaviour change. We push to
  `main`.

## 5. Testing without x.com or keys

- **Unit tests:**
  - DOM tests use `// @vitest-environment jsdom`.
  - Provider tests stub `fetch`.
  - `tests/apple-fm.test.ts` fakes the native helper.
- **Feed check in a browser:**
  1. Write a fixture HTML page with X's markup.
  2. In Playwright, route `https://x.com/home` to it.
  3. Stub `chrome.storage`, `chrome.i18n.detectLanguage` and
     `chrome.runtime.sendMessage`.
  4. Inject `.output/chrome-mv3/content-scripts/content.js`.

  `AGENTS.md` has the details.
- **Apple helper:** talk to `native/.build/out/Products/Release/lentochist-fm`
  directly. Each message is JSON preceded by a 4-byte little-endian length.
  Send `{"id":1,"kind":"status"}` first.

## 6. Where things stand (November 2026)

| Area | State |
|---|---|
| Ad removal, old UI | built; verified against mocked feeds |
| Languages, Keywords | built; verified against mocked feeds |
| Topics, Media + provider chain | built; providers mocked in tests |
| Apple FM helper | verified live on macOS 27: status, judgments, images |
| Cloudflare Clef, JEV, Gemini Nano | **never called live**: no keys yet |
| Apple PCC | wired, but blocked on Apple's entitlement |
| X's new web UI | built from Control Panel for Twitter's source; **not seen live** |

## 7. Good first tasks

- **Run the extension on your own x.com feed** with real keys, and report
  what breaks. This is the most valuable thing anyone can do right now.
- **If your account has X's new web UI:** run
  `copy(document.querySelector('[id^="urt:"]')?.outerHTML)` in DevTools and
  share the result. Use it to confirm the guesses in `lib/feed/xweb.ts`:
  the text element, the display name, and how GIF differs from video.
- **Watch Cloudflare's free quota.** It sends one request per tweet per AI
  filter. If it runs out too fast, batch several tweets into one request.
- **Shrink the bundle.** The stemming library ships every language, but we
  only need Russian and English, which would save about 300 KB.

## 8. Who to ask

The project owner is Sergei Telegin (GitHub: TeleginS). Open an issue on the
repo for bugs and questions.

# AGENTS.md

lentochist is a Chrome MV3 extension that hides unwanted tweets on x.com and
collapses each one into a one-line stub with a Show button. It has no
backend; see `docs/adr/0001-no-backend.md`. Use the terms in `GLOSSARY.md`
(filter, provider, provider chain, statement, judgment, stub, helper) in
code, comments and docs.

## Commands

```sh
npm install          # also runs `wxt prepare`
npm run build        # → .output/chrome-mv3, load it unpacked in chrome://extensions
npm run dev          # browser with live reload
npm test             # vitest
npm run typecheck    # tsc --noEmit
```

Apple FM helper (Swift, macOS 26+):

```sh
cd native && swift build -c release   # if the SDK is not found, prefix DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
native/install.sh                     # build + register with Chrome; native/uninstall.sh removes it
```

Run `npm test`, `npm run typecheck` and `npm run build` before you call a
change done.

## Layout

- `entrypoints/content.ts`: runs on x.com. Local filters first; AI filters
  only if the tweet passes them. Topics and media run in parallel, and the
  tweet stays visible while they wait.
- `entrypoints/background.ts`: service worker. Answers `judge` messages
  through the provider chain.
- `entrypoints/options/`: the settings page, sections 01–05.
- `lib/feed/`: **every X DOM selector for tweets lives here.**
  - `index.ts` defines `FeedTweet`, the only thing the rest of the code sees.
  - `rweb.ts` and `xweb.ts` read the two X UIs.
  - When X changes its markup, fix it here and nowhere else.
- `lib/languages.ts`, `lib/keywords.ts`: local filters. Keywords use
  Snowball stemming for ru and en; a `/regex/` line is used as written.
- `lib/ads.ts`: ad removal. It toggles classes only and never removes nodes,
  because X virtualizes and reuses timeline rows.
- `lib/stub.ts`: the stub. Its text is "Tweet hidden — {filter}: {reason} · {provider}".
- `lib/settings.ts`: settings and defaults. Provider keys are stored apart
  from settings (`providerKeys`), so content scripts never read them.
- `lib/ai/questions.ts`: **all statements the AI filters ask, in one place.**
  `decide()` applies the threshold in code; the model never decides.
- `lib/ai/chain.ts`: provider chain, cache, concurrency limit, in-flight dedupe.
- `lib/ai/providers/`:
  - `system-one.ts`: request shape shared by `jev.ts` and `cloudflare.ts`.
  - `generative.ts`: prompt and JSON parsing shared by the local generative
    models, `apple-fm.ts` and `nano.ts`.
- `lib/ai/image.ts`: media preview, downscaled to fit JEV's 280–1568 px limit.
- `native/`: the Native Messaging helper for Apple Foundation Models.
- `tests/`: vitest with WXT's `fakeBrowser`. Mock `fetch` for providers.

## X has two web UIs

X is rolling out a new web UI ("xweb") account by account, next to the old
one ("rweb").
- The old UI uses `data-testid`: `article[data-testid="tweet"]`,
  `tweetText`, `User-Name`, `cellInnerDiv`, `placementTracking`.
- The new one has no test ids. Timeline rows are
  `[id^="urt:"] > ul > li[data-index]`, and tweets are
  `[data-href="/user/status/ID"] > article`.

Both UIs are supported by the filters (`lib/feed/rweb.ts`, `lib/feed/xweb.ts`)
and by ad removal (`lib/ads.ts`).

**The new UI has not been seen live.**
- Its tweet text is read from the innermost `[lang]` element outside the
  quote frame. That is inferred from Control Panel for Twitter's CSS, not
  confirmed on a real page.
- The display name is unknown, so the author is the `@handle`.
- GIF vs video uses the old UI's poster rule.
- If the text guess is wrong, filters see empty text and hide nothing, and
  the console warns once: "New X UI: found tweets but no tweet text".
- When someone with the new UI can share a markup sample, verify these
  first.

In the new UI the stub replaces the `article` inside `[data-href]`, and X is
left to re-measure the row height itself. If gaps show up, Control Panel for
Twitter calls `virtualizer.resizeItem` through React's fiber. We
deliberately do not, yet. Collapse new-UI rows to 1px, never `display:none` or zero
height, or X's virtual list breaks. Control Panel for Twitter
(github.com/insin/control-panel-for-twitter) is the best reference for both UIs.

## Rules that are easy to break

- **No backend.** Model calls go from the service worker only. Content
  scripts are subject to CORS, and providers send no CORS headers.
- **A failed call is an error, never an answer.** Do not treat a provider
  failure as "keep the tweet", and do not cache it. `Unavailable` means the
  provider is not set up here or is out of quota: fall through quietly.
  Other errors also fall through, but are logged.
- **The cache stores probabilities, not decisions.** Its key includes the
  hash of the questions, so editing topics misses the cache, while moving a
  threshold does not trigger new calls.
- **Questions are atomic statements with concrete `whenTrue`/`whenFalse`.**
  Combine them in code. Do not tune their wording to fix single test cases.
- **The extension ID is pinned** by `key` in `wxt.config.ts`
  (`nnpgkkggehcakagglofehockjhinfhie`). The helper's host manifest allows
  only that ID. Changing the key breaks Apple FM.
- **Apple FM guardrails:** the on-device model uses
  `.permissiveContentTransformations`, because default guardrails refuse
  scam and 18+ tweets, which are exactly what we classify. PCC needs the
  restricted `com.apple.developer.private-cloud-compute` entitlement, which
  the helper checks for itself.
- **Provider facts:**
  - Cloudflare signals an exhausted free quota with `429` and error code `3036`.
  - JEV needs the header `TypeSafe-Danger-Zone-Images: true` for images,
    which it takes as raw base64 in `assets`.
  - Clef takes images as data URLs in `images`.
  - Check the live docs before you change request shapes.
- UI text is English. Keep the options page close to the design in
  `docs/screenshots/`, which are local only and gitignored.

## Testing on the feed

There are no live keys in the repo. To check the content script without x.com:

1. Serve a fixture page that uses X's markup (`article[data-testid="tweet"]`,
   `[data-testid="tweetText"]`, `[data-testid="User-Name"]`,
   `[data-testid="tweetPhoto"] img`).
2. In Playwright, route `https://x.com/home` to the fixture.
3. Stub `chrome.storage`, `chrome.i18n.detectLanguage` and
   `chrome.runtime.sendMessage`.
4. Inject `.output/chrome-mv3/content-scripts/content.js`.

Say plainly what was verified live and what only against mocks.

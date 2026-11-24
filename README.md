# lentochist

Chrome extension that cleans up the X/Twitter feed. Hidden tweets collapse
into a one-line stub ("Tweet hidden — topic: …") with a **Show** button.

Status: stage 1 works: the Languages and Keywords filters. The Topics and
Media AI filters come in stage 2.

## Install

```sh
npm install
npm run build
```

Open `chrome://extensions`, turn on Developer mode, click **Load unpacked**
and pick `.output/chrome-mv3`. Click the toolbar icon to open the settings.
`npm run dev` starts a browser with live reload. `npm test` runs the tests.

## Filters

1. **Languages.** Pick languages from a list, then either hide them or keep
   only them. Detection runs locally with a language-detect library. A
   minimum-confidence slider leaves short or ambiguous tweets visible.
2. **Keywords.** Regex matching that also catches other word forms. X's
   built-in muting matches Russian words only in the exact form typed.
3. **Topics (AI).** A list of unwanted topics, up to 30, one per line. The
   tweet text goes to a Cloudflare Workers AI model. When the Cloudflare
   limit runs out, the check falls back to JEV through its own API. A
   block-threshold slider sets how sure the model must be before it hides a
   tweet.
4. **Tweets with media (AI).** A separate strict check for photo, video and
   GIF tweets: 18+ promo (Boosty, OnlyFans), scams and useless viral content.
   It has its own threshold and uses the same models as the topic check.
   Optionally the server downloads a reduced preview from pbs.twimg.com and
   sends it to the model with the text (about +40% cost per media tweet).

## Stack

- Chrome extension only, no backend (see `docs/adr/0001-no-backend.md`):
  content script on the feed, service worker for model calls, options page.
  Self-hosted: load it unpacked.
- Works on the home feed, reply threads and search; profiles are left alone.
- AI checks try providers in order, falling through when one is missing or
  out of quota:
  1. a free local model: Apple Foundation Models through an optional
     Native Messaging helper, otherwise Gemini Nano built into Chrome;
  2. Cloudflare Workers AI;
  3. JEV through its own API.
- Keys (Cloudflare account ID and API token, JEV API key) are entered on the
  options page and kept in `chrome.storage.local`.
- Built in two stages: first the stubs and local filters (languages,
  keywords), then the AI filters (topics, media).

## Origin

Inspired by a post showing the same tool built from one prompt in about ten
minutes.

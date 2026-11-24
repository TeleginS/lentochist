# lentochist

Chrome extension that cleans up the X/Twitter feed. Hidden tweets collapse
into a one-line stub ("Tweet hidden — topic: …") with a **Show** button.

Status: all four filters are built. The AI filters have only been tested with
mocked providers and the Apple FM helper on its own, not yet on the live feed.

## Install

```sh
npm install
npm run build
```

Open `chrome://extensions`, turn on Developer mode, click **Load unpacked**
and pick `.output/chrome-mv3`. Click the toolbar icon to open the settings.
`npm run dev` starts a browser with live reload. `npm test` runs the tests.

For the AI filters, enter keys under **05 Providers** on the settings page.
For a free local model on macOS 26+ with Apple Intelligence, run
`native/install.sh` once: it builds the Apple Foundation Models helper and
registers it with Chrome (`native/uninstall.sh` removes it). Without it,
Gemini Nano built into Chrome is used if the device supports it.

The settings let you pick which Apple model the helper runs:

- **System** (default): the on-device model. Free, and the tweet never
  leaves the Mac.
- **PCC**: Apple's larger server model on Private Cloud Compute (macOS 27+).
  It is gated by the restricted entitlement
  `com.apple.developer.private-cloud-compute`, which Apple grants to eligible
  developer teams. The helper built by `install.sh` is not signed with it, so
  PCC shows as unavailable and the chain falls through to the next provider.
  If your team has the entitlement, sign the helper with
  `native/pcc.entitlements` and a matching provisioning profile.
  Restricted entitlements need the profile, which in practice means wrapping
  the helper in an `.app` bundle.
  Then point the `path` in the host manifest at the signed binary.

## Ad removal

A toggle at the top of the settings, on by default. Tweets and "Who to
follow" accounts that X itself marks as ads leave the feed entirely, with no
stub, wherever X shows tweets, profiles included. Ads are removed before any
filter runs, so they never cost an AI call. Unmarked advertising, such as
creator integrations, is left to the Topics and Media filters.

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
  1. a free local model: Apple Foundation Models (on-device, or Private
     Cloud Compute if entitled) through an optional Native Messaging helper,
     otherwise Gemini Nano built into Chrome;
  2. Cloudflare Workers AI with a Clef decision model of your choice (Clef
     Flash, Clef or Clef Omni), which answers in the same shape as JEV;
  3. JEV through its own API.
- Keys (Cloudflare account ID and API token, JEV API key) are entered on the
  options page and kept in `chrome.storage.local`.
- Built in two stages: first the stubs and local filters (languages,
  keywords), then the AI filters (topics, media).

## Origin

Inspired by a post showing the same tool built from one prompt in about ten
minutes.

# lentochist

Chrome extension that cleans up the X/Twitter feed. Hidden tweets collapse
into a one-line stub ("Tweet hidden — topic: …") with a **Show** button.

Status: idea, no code yet.

## Filters

1. **Languages.** Pick languages from a list, then either hide them or keep
   only them. Detection runs locally with a language-detect library. A
   minimum-confidence slider leaves short or ambiguous tweets visible.
2. **Keywords.** Regex matching that also catches other word forms. X's
   built-in muting matches Russian words only in the exact form typed.
3. **Topics (AI).** A list of unwanted topics, up to 30, one per line. The
   tweet text goes to the JEV model through OpenRouter. A block-threshold
   slider sets how sure the model must be before it hides a tweet.
4. **Tweets with media (AI).** A separate strict check for photo, video and
   GIF tweets: 18+ promo (Boosty, OnlyFans), scams and useless viral content.
   It has its own threshold. Optionally the server downloads a reduced
   preview from pbs.twimg.com and sends it to JEV with the text (about +40%
   cost per media tweet).

## Stack

- Chrome extension: content script on the feed and a settings page.
- Python backend for the AI checks. `OPENROUTER_API_KEY` lives in `.env`.

## Origin

Inspired by a post showing the same tool built from one prompt in about ten
minutes.

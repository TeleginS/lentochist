# lentochist

A Chrome extension that hides unwanted tweets from the X/Twitter feed and
collapses each one into a stub the reader can reopen.

## Filtering

**Filter**:
One independently switchable rule that can hide a tweet: Languages,
Keywords, Topics or Media.
_Avoid_: rule, check (on its own), module

**Local filter**:
A filter that decides on the device without any model call: Languages and
Keywords.

**AI filter**:
A filter that asks a model to decide: Topics and Media.
_Avoid_: smart filter

**Keyword**:
One line of the Keywords filter: either a plain word, which also matches its
other word forms, or a `/pattern/` written by hand.
_Avoid_: stop word, mute word

**Topic**:
One line of the user's list of unwanted subjects that the Topics filter asks
a model about.
_Avoid_: category, tag

**Threshold**:
How sure a filter must be before it hides a tweet; Languages calls it
minimum confidence, AI filters call it block threshold.

## Models

**Provider**:
A source of model answers for AI filters: Apple FM (the on-device model or
Apple PCC), Gemini Nano, Cloudflare Workers AI (running a Clef model) or JEV.
_Avoid_: backend, API, engine

**Local provider**:
A provider reached on the user's machine at no cost: Apple FM or Gemini
Nano. Apple PCC is reached the same way but runs on Apple's servers.

**Provider chain**:
The ordered list of providers an AI filter tries until one answers.
_Avoid_: fallback list

**Statement**:
One yes-or-no claim about a tweet that an AI filter asks a provider about,
such as "the tweet is about football" or "the tweet is a scam".
_Avoid_: prompt, question (on its own), label

**Judgment**:
The probability per statement that one provider gave for one tweet.
_Avoid_: verdict, score, result

**Helper**:
The small local program that lets the extension reach Apple FM, which Chrome
cannot call directly.
_Avoid_: native host, bridge, daemon

## Feed

**Preview**:
A downscaled photo or video frame of a tweet that the Media filter can show a
provider along with the text.
_Avoid_: thumbnail

**Stub**:
The one-line placeholder that replaces a hidden tweet and names the filter
and reason, with a Show button.
_Avoid_: placeholder, banner, collapsed tweet

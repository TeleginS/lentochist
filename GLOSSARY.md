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
A source of model answers for AI filters: Apple FM, Gemini Nano,
Cloudflare Workers AI or JEV.
_Avoid_: backend, API, engine

**Local provider**:
A provider that runs on the user's machine at no cost: Apple FM or Gemini
Nano.

**Provider chain**:
The ordered list of providers an AI filter tries until one answers.
_Avoid_: fallback list

## Feed

**Stub**:
The one-line placeholder that replaces a hidden tweet and names the filter
and reason, with a Show button.
_Avoid_: placeholder, banner, collapsed tweet

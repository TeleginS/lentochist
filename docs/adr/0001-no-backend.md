# No backend: the extension calls providers directly

lentochist is self-hosted: the repo is public and anyone who wants it loads
the unpacked extension themselves. So we dropped the planned Python backend.
The extension's service worker calls every provider directly, and each user
enters their own Cloudflare and JEV keys on the options page, stored in
`chrome.storage.local`. One server per user would have been extra work to run
just to hide a few keys. Those keys never leave the user's own browser anyway.

## Consequences

- Keys sit in browser storage. That is acceptable because each install
  belongs to one person and uses that person's own keys.
- Media previews are fetched from pbs.twimg.com and downscaled by the
  extension itself, not by a server.
- Apple FM cannot be called from Chrome directly. It is reached through an
  optional Native Messaging helper that the user installs. This is the one
  local process we accept, and the provider chain skips it when it is
  missing.
- Provider chain: local provider (Apple FM, else Gemini Nano) → Cloudflare
  Workers AI → JEV. Generative providers report a self-stated score, so the
  same threshold is less reliable for them than for JEV, whose probabilities
  are calibrated. The stub names which provider hid the tweet.

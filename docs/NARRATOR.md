# The narrator

The resolution story is written per game by Claude, given the five figures the
player actually appointed and how each of their checks went.

## Why it is not pre-generated

Pre-written lines can be specific about one person in one post. They cannot be
specific about a *combination* — and the combination is the joke. Five posts
drawn from 122 figures with roles assigned is a space no one can write in
advance, and a story that flows needs each beat to know what the previous ones
said. Both of those need generation at play time.

## Why it needs a server

The API key must never reach a browser. `api/narrate.ts` is the only thing that
talks to Anthropic; the game posts it a summary and gets beats back.

## Running it locally

```
cp .env.example .env.local     # then put your key in it
npm run dev
```

`.env.local` is git-ignored and read by the dev server's node process. The Vite
plugin in `vite.config.ts` mounts the real `api/narrate.ts` handler on the dev
server — not a stub — so local play exercises the code that ships.

If `ANTHROPIC_API_KEY` is already exported in your shell, that is used and no
`.env.local` is needed.

## Deploying

`vercel.json` builds the static site to `dist/` and runs `api/narrate.ts` as a
function with a 30s limit. Set `ANTHROPIC_API_KEY` in the Vercel project's
environment variables. `ANTHROPIC_MODEL` is optional and defaults to
`claude-opus-5`.

## When it fails

Every failure falls back to the templated narrator in `src/app/narrate.ts`, so
the game is fully playable with no key, no network, a rate limit, or a timeout.
The player sees a shorter, more generic story and nothing else changes. This is
why the templates stay in the build rather than being deleted.

Failure paths verified: no key (503), malformed or oversized body (400), wrong
method (405), and a request that never returns (25s client timeout).

## Cost and latency

One call per completed game. Measured on the Suez scenario:

| Model | Latency | Input / Output |
| --- | --- | --- |
| `claude-opus-5` (default) | ~19s | $5 / $25 per MTok |
| `claude-sonnet-5` | ~15s | $2 / $10 per MTok |

The wait is hidden behind the opening beat, which is rendered locally from the
event dossier while the rest generates. Sonnet was not enough faster to be worth
the drop in writing quality, but it is a one-line change if the bill argues
otherwise.

Effort is set to `low` in `api/narrate.ts`: this is short creative prose, and
higher effort spends latency on reasoning the task does not need.

# ai-visibility-scan

VA task sheet that captures what **ChatGPT and Gemini** answer for 30 German buying
questions, so we can see whether **Ozem+ / Oz+** gets named in AI answers and which pages
those engines cite.

**LIVE (noindex):** https://oliveroliver10816.github.io/ai-visibility-scan/
**Repo:** https://github.com/oliveroliver10816/ai-visibility-scan (public, Pages, 3 standard collaborators)

## Why this property

`ozem-plus.store` is the only site of ours with **proven organic revenue** — $480 from 6 sales
(12–17 Jul 2026), 100% organic, $0 ad spend, DE ×2 / IT ×2 / PL ×1 / NL ×1. So whether AI answers
name us, ignore us, or warn about us has a direct revenue consequence. First run is **DE only**
(primary geo, where the brand demand is).

## What it captures

⚠ **Bob's correction, 2026-07-31 — the VA interprets NOTHING.** The first build asked her to judge
"was Ozem+ mentioned", "which brands", "which sources". That put the analysis in her hands and made
the data only as good as her understanding. **Rebuilt: she copies the question and pastes back the
two raw replies. All extraction happens on our side.**

30 questions, one screen each, two paste boxes (ChatGPT + Gemini). Question mix: 8 brand-intent
(`Ist Ozem+ seriös oder Betrug?`), 14 category-commercial (`Welche Abnehmkapseln sind die besten?`),
8 comparison/trust (`Wovor warnt die Verbraucherzentrale…`).

**The word limit and the source request live INSIDE the prompt she copies:**

> Antworte in höchstens 120 Wörtern. Liste danach alle verwendeten Quellen als vollständige URLs
> auf, eine pro Zeile. Wenn du keine Quellen hast, schreibe KEINE QUELLEN.

That does three jobs at once: keeps answers short enough to copy comfortably, makes the engines
emit their citations as plain URLs instead of hiding them behind footnote chips, and produces an
explicit **`KEINE QUELLEN`** marker — so "no sources" is a fact in the data rather than an empty
box we have to guess about. `citation_report.py` counts those and extracts every URL itself.

⚠ **No pre-filled competitor list.** We discover the competitive set from the raw text rather than
assuming it.

## Design decisions (VA-proofing)

- **Zero judgment calls.** Copy, paste twice, next.
- **One guard**: cannot save unless both boxes have text, or she presses "Couldn't get an answer".
- **localStorage persistence + auto-send**, resumes at the first unanswered question.
- **"Couldn't get an answer"** records an explicit gap. The footer tells her plainly not to invent
  text to fill one.
- **Nothing to email.** Each save POSTs both replies to our Cloudflare collector; a header badge
  shows `all sent ✓` or `N not sent yet`, with a Resend button.

## Verified before shipping

Driven end to end with Playwright, on the **live github.io page**: guard fires for each empty box
independently, save advances and auto-sends, progress survives reload and resumes correctly, grid
jump restores both pasted answers, 30 squares render, zero console errors, no horizontal overflow
desktop or mobile. Cross-origin POST to the worker confirmed working. An answer saved while offline
is kept and auto-flushed on reconnect. **WCAG contrast: 12/12 pairs pass AA.**
Full chain re-tested: raw pastes → export → `citation_report.py` correctly stripped a run-on comma
and a trailing period from URLs, counted the `KEINE QUELLEN` answer, and dropped Reddit/Wikipedia.

## Collector

Cloudflare Worker + D1 on the Osanix account — `collector/`, see its README.
`https://ai-visibility-collect.fleet-fefsba.workers.dev`. Two tokens: the **submit** token ships
in the public page and can only write; the **admin** token reads and never leaves this server
(`/root/.config/ai-visibility-tokens.json`, chmod 600). Verified the submit token gets 403 on
`/export`. ⚠ Deploy only with `--config ./wrangler.json` — the parent `/root/workspace/wrangler.jsonc`
hijacks it otherwise.

Pull the data:
```bash
AT=$(python3 -c "import json;print(json.load(open('/root/.config/ai-visibility-tokens.json'))['admin_token'])")
curl -s "https://ai-visibility-collect.fleet-fefsba.workers.dev/export?token=$AT&batch=ozem-de" > answers.json
```

## Next

1. VA works through the 30. Data arrives live — check `/status` or `/export` any time.
2. Feed it to `citation_report.py` from the `link-outreach` skill → ranked cited domains,
   our-vs-competitor presence, gap questions.
3. Two outcomes to look for: **are we named at all**, and **what shape of page do the engines
   trust** — if they cite third-party review/comparison pages, we can build pages of that shape
   ourselves rather than pitching anyone (we already run review sites).

⚠ Outreach is NOT the follow-up here — per the `link-outreach` skill's own portfolio gate, no
independent editor adds a publicly-flagged supplement brand. The value on this property is
measurement plus content-shape intelligence.

## Status

Built and deployed 2026-07-31. **Waiting on the VA's data file.** Nothing bought, $0 spent.

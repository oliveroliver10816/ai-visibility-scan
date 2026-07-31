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

30 questions × 2 engines = **60 runs**. Question mix: 8 brand-intent (`Ist Ozem+ seriös oder
Betrug?`, `Gibt es Ozem+ in der Apotheke?`), 14 category-commercial (`Welche Abnehmkapseln sind
die besten?`), 8 comparison/trust (`Ozempic Alternative ohne Rezept`, `Wovor warnt die
Verbraucherzentrale…`).

Per run the VA records: was Ozem+/Oz+ named (**no / yes / mentioned as a warning**), every brand
the answer named, every source URL shown, an explicit **"no sources shown"** flag, and an optional
note. Exports one JSON file.

⚠ **Deliberately no pre-filled competitor list.** The VA writes down every brand the answer names,
so we *discover* the competitive set instead of assuming it.

## Design decisions (VA-proofing)

- **Guided one-run-at-a-time flow**, not a table — far harder to fill in the wrong row.
- **Two hard guards**: cannot save without answering Q1, and cannot save with an empty sources box
  unless "no sources shown" is ticked. An empty box and a genuine "nothing shown" mean different
  things to the analysis, so the page refuses to let them collapse into each other.
- **localStorage persistence**, resumes at the first unrecorded run; 60-square grid to jump back.
- **"Can't do this one"** records an explicit gap — a recorded gap beats a guess.
- Nothing is transmitted; the VA downloads a JSON file and sends it back.

## Verified before shipping

Driven end to end with Playwright: both guards fire, save advances correctly (Q1 ChatGPT → Q1
Gemini), progress survives reload and resumes at the right run, grid jump restores saved values,
export trims whitespace and drops blank lines, 60 squares render, zero console errors, no
horizontal overflow desktop or mobile. **WCAG contrast: 12/12 pairs pass AA.**

## Next

1. VA runs the 60 and returns `ai-answers-ozem-de.json`.
2. Convert to JSONL and feed `citation_report.py` from the `link-outreach` skill → ranked cited
   domains, our-vs-competitor presence, gap questions.
3. Two outcomes to look for: **are we named at all**, and **what shape of page do the engines
   trust** — if they cite third-party review/comparison pages, we can build pages of that shape
   ourselves rather than pitching anyone (we already run review sites).

⚠ Outreach is NOT the follow-up here — per the `link-outreach` skill's own portfolio gate, no
independent editor adds a publicly-flagged supplement brand. The value on this property is
measurement plus content-shape intelligence.

## Status

Built and deployed 2026-07-31. **Waiting on the VA's data file.** Nothing bought, $0 spent.

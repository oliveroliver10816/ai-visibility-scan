# ai-visibility-collect

Cloudflare Worker + D1 that receives the VA's answers directly. She never handles a file.

**Live:** `https://ai-visibility-collect.fleet-fefsba.workers.dev`
**Account:** Osanix/Vikash (creds `/root/.config/cloudflare/osanix-fleetview.json`)
**D1:** `ai_visibility` · `71901ca0-4b1b-4479-972c-d560c0620a17`
**Tokens:** `/root/.config/ai-visibility-tokens.json` (chmod 600)

## Pull the data

```bash
AT=$(python3 -c "import json;print(json.load(open('/root/.config/ai-visibility-tokens.json'))['admin_token'])")
curl -s "https://ai-visibility-collect.fleet-fefsba.workers.dev/export?token=$AT&batch=ozem-de" > answers.json
```

Then convert to JSONL and feed `citation_report.py` from the `link-outreach` skill.

## Endpoints

| Route | Token | Purpose |
|---|---|---|
| `POST /submit` | submit | one run; **upserts** on `(batch, question_number, engine)` |
| `GET /status` | submit | `{recorded}` — lets the page show the server's truth |
| `GET /export` | **admin** | every record |

## Two tokens on purpose

The **submit** token ships inside a public HTML page, so treat it as known. It can only write
runs into a fixed shape — size-capped, list-capped, string-truncated, and validated on
`question_number` and `engine`. The **admin** token is the only way to read data back out and
never leaves this server. Verified: the submit token gets **403** on `/export`.

## Deploying

⚠ **Always pass `--config ./wrangler.json`.** `/root/workspace/wrangler.jsonc` otherwise hijacks
the deploy (see memory `wrangler-parent-config-trap`).

```bash
export CLOUDFLARE_EMAIL=… CLOUDFLARE_API_KEY=… CLOUDFLARE_ACCOUNT_ID=…
wrangler deploy --config ./wrangler.json
```

## Tested

Validation returns 400 on a non-integer `question_number` and on a missing `engine`, 413 over
24 KB, 403 on a bad or wrong-scope token. Upsert confirmed: re-submitting the same
question+engine updates in place rather than duplicating. Driven from the **live github.io
page**: cross-origin submit works with zero console errors, an answer saved while offline is
kept and auto-flushed on reconnect, and the header shows `all sent ✓` / `N not sent yet`.

⚠ `workers.dev` throttles rapid requests from a datacenter IP with `error code: 1042`. That is
Cloudflare, not this code — space out bulk test calls. A VA on a normal connection won't see it.

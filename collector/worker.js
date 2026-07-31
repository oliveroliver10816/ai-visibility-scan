/**
 * ai-visibility-collect — receives one run record per save from the VA task sheet.
 *
 * The VA never handles a file and is never asked to interpret anything. She pastes the raw
 * reply from each engine; every save POSTs that text here and it lands in D1 immediately.
 * All extraction (brand mentions, cited URLs) happens later, on our side, from the raw text.
 *
 * Endpoints
 *   POST /submit    submit token, one pasted answer -> upsert by (batch, question_number, engine)
 *   GET  /status    submit token                  -> {recorded, total} so the page can show truth
 *   GET  /export    ADMIN token                   -> every record as JSON
 *
 * Two different tokens on purpose. The submit token ships inside a public HTML page and
 * must be assumed known; it can only write runs into a fixed shape. The admin token
 * never leaves this server and is the only way to read the data back out.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Token",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const MAX_BODY = 64 * 1024;      // now carries the full pasted answer text
const MAX_ANSWER = 40000;        // a 120-word answer is ~1 KB; this is very generous
const MAX_STR = 2000;

const clean = (v, max = MAX_STR) =>
  typeof v === "string" ? v.slice(0, max) : "";

async function ensure(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS runs (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       batch TEXT NOT NULL,
       question_number INTEGER NOT NULL,
       question TEXT NOT NULL,
       engine TEXT NOT NULL,
       prompt TEXT,
       answer_text TEXT,
       notes TEXT,
       skipped INTEGER DEFAULT 0,
       saved_at TEXT,
       received_at TEXT NOT NULL,
       UNIQUE (batch, question_number, engine)
     )`
  ).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    await ensure(env);

    const token =
      request.headers.get("X-Token") || url.searchParams.get("token") || "";

    // ---- write path ------------------------------------------------------
    if (path === "/submit" && request.method === "POST") {
      if (token !== env.SUBMIT_TOKEN) return json({ error: "bad token" }, 403);

      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: "too large" }, 413);

      let b;
      try { b = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }

      const qn = Number(b.question_number);
      const engine = clean(b.engine, 40);
      if (!Number.isInteger(qn) || qn < 1 || qn > 200)
        return json({ error: "bad question_number" }, 400);
      if (!engine) return json({ error: "missing engine" }, 400);

      await env.DB.prepare(
        `INSERT INTO runs
           (batch, question_number, question, engine, prompt, answer_text,
            notes, skipped, saved_at, received_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (batch, question_number, engine) DO UPDATE SET
           prompt=excluded.prompt, answer_text=excluded.answer_text,
           notes=excluded.notes, skipped=excluded.skipped,
           saved_at=excluded.saved_at, received_at=excluded.received_at`
      ).bind(
        clean(b.batch, 60) || "default",
        qn,
        clean(b.question),
        engine,
        clean(b.prompt, 4000),
        clean(b.answer_text, MAX_ANSWER),
        clean(b.notes, 600),
        b.skipped ? 1 : 0,
        clean(b.saved_at, 40),
        new Date().toISOString()
      ).run();

      const { results } = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM runs WHERE batch = ?`
      ).bind(clean(b.batch, 60) || "default").all();

      return json({ ok: true, recorded: results[0].n });
    }

    // ---- progress (page shows the server's count, not just its own) ------
    if (path === "/status" && request.method === "GET") {
      if (token !== env.SUBMIT_TOKEN) return json({ error: "bad token" }, 403);
      const batch = clean(url.searchParams.get("batch"), 60) || "default";
      const { results } = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM runs WHERE batch = ?`
      ).bind(batch).all();
      return json({ recorded: results[0].n });
    }

    // ---- read path (admin only) -----------------------------------------
    if (path === "/export" && request.method === "GET") {
      if (token !== env.ADMIN_TOKEN) return json({ error: "bad token" }, 403);
      const batch = clean(url.searchParams.get("batch"), 60) || "default";
      const { results } = await env.DB.prepare(
        `SELECT * FROM runs WHERE batch = ? ORDER BY question_number, engine`
      ).bind(batch).all();
      return json({
        batch,
        exported_at: new Date().toISOString(),
        recorded: results.length,
        runs: results.map((r) => ({ ...r, skipped: !!r.skipped })),
      });
    }

    return json({ error: "not found" }, 404);
  },
};

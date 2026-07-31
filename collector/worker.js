/**
 * ai-visibility-collect — receives one run record per save from the VA task sheet.
 *
 * The VA never handles a file. Each "Save and next" POSTs that single run here and it
 * lands in D1 immediately, so partial work is never lost and there is nothing to send.
 * The page keeps its localStorage copy and its Download button purely as a fallback.
 *
 * Endpoints
 *   POST /submit    submit token, one run record  -> upsert by (batch, question_number, engine)
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

const MAX_BODY = 24 * 1024;      // one run record is ~1-2 KB; this is generous
const MAX_LIST = 60;             // brands / sources per answer
const MAX_STR = 2000;

const clean = (v, max = MAX_STR) =>
  typeof v === "string" ? v.slice(0, max) : "";

const cleanList = (v) =>
  Array.isArray(v)
    ? v.filter((x) => typeof x === "string" && x.trim())
       .slice(0, MAX_LIST)
       .map((x) => x.trim().slice(0, 600))
    : [];

async function ensure(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS runs (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       batch TEXT NOT NULL,
       question_number INTEGER NOT NULL,
       question TEXT NOT NULL,
       engine TEXT NOT NULL,
       us TEXT,
       brands TEXT,
       sources TEXT,
       no_sources INTEGER DEFAULT 0,
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
           (batch, question_number, question, engine, us, brands, sources,
            no_sources, notes, skipped, saved_at, received_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (batch, question_number, engine) DO UPDATE SET
           us=excluded.us, brands=excluded.brands, sources=excluded.sources,
           no_sources=excluded.no_sources, notes=excluded.notes,
           skipped=excluded.skipped, saved_at=excluded.saved_at,
           received_at=excluded.received_at`
      ).bind(
        clean(b.batch, 60) || "default",
        qn,
        clean(b.question),
        engine,
        clean(b.us, 20),
        JSON.stringify(cleanList(b.brands)),
        JSON.stringify(cleanList(b.sources)),
        b.no_sources ? 1 : 0,
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
        runs: results.map((r) => ({
          ...r,
          brands: JSON.parse(r.brands || "[]"),
          sources: JSON.parse(r.sources || "[]"),
          no_sources: !!r.no_sources,
          skipped: !!r.skipped,
        })),
      });
    }

    return json({ error: "not found" }, 404);
  },
};

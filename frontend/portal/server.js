import http from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORTAL_PORT || 8103);
const ORCHESTRATOR = process.env.ORCHESTRATOR_BASE_URL || "http://localhost:8102";
const LISTENER = process.env.LISTENER_BASE_URL || "http://localhost:8101";
const here = dirname(fileURLToPath(import.meta.url));
const eventFeed = [];
const EVENT_LIMIT = 100;

async function fetchJson(path, fallback) {
  try {
    const r = await fetch(`${ORCHESTRATOR}${path}`);
    if (!r.ok) return fallback;
    return await r.json();
  } catch {
    return fallback;
  }
}

async function fetchJsonAbsolute(url, fallback) {
  try {
    const r = await fetch(url);
    if (!r.ok) return fallback;
    return await r.json();
  } catch {
    return fallback;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += String(chunk);
      if (raw.length > 1_000_000) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid json body"));
      }
    });
    req.on("error", (err) => reject(err));
  });
}

function normalizeEvent(raw) {
  const now = new Date().toISOString();
  const eventId = String(raw?.event_id || raw?.signature || `evt_${Date.now()}`);
  const signature = String(raw?.signature || "");
  const eventType = String(raw?.event_type || "UnknownEvent");
  const programId = String(raw?.program_id || "unknown_program");
  const subjects = Array.isArray(raw?.subjects) ? raw.subjects : [];
  const payload = raw?.payload && typeof raw.payload === "object" ? raw.payload : {};
  const severity = eventType.toLowerCase().includes("error") ? "high" : "info";

  return {
    event_id: eventId,
    signature,
    event_type: eventType,
    program_id: programId,
    subjects,
    payload,
    severity,
    created_at_utc: String(raw?.created_at_utc || now),
  };
}

function upsertEvent(raw) {
  const item = normalizeEvent(raw);
  const key = item.event_id;
  const idx = eventFeed.findIndex((x) => x.event_id === key);
  if (idx >= 0) {
    eventFeed[idx] = item;
    return;
  }
  eventFeed.unshift(item);
  if (eventFeed.length > EVENT_LIMIT) eventFeed.length = EVENT_LIMIT;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    return res.end("Bad Request");
  }

  if (req.url === "/" || req.url === "/index.html") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    return res.end(readFileSync(resolve(here, "web", "index.html"), "utf-8"));
  }

  if (req.url === "/app.js") {
    res.setHeader("content-type", "application/javascript; charset=utf-8");
    return res.end(readFileSync(resolve(here, "web", "app.js"), "utf-8"));
  }

  if (req.url === "/health") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ service: "portal-frontend-3d", ok: true }));
  }

  if (req.url === "/api/advisory-message") {
    res.setHeader("content-type", "application/json");
    const data = await fetchJson("/advisory/latest", { message_text: "No advisory available." });
    return res.end(JSON.stringify(data));
  }

  if (req.url === "/api/ui-signal") {
    res.setHeader("content-type", "application/json");
    const data = await fetchJson("/ui-signal", { reaction: "pulse_neutral", voice_style: "neutral", intensity: 0.5 });
    return res.end(JSON.stringify(data));
  }

  if (req.url === "/api/voice-turn" && req.method === "POST") {
    res.setHeader("content-type", "application/json");
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "bad_request" }));
    }

    try {
      const r = await fetch(`${ORCHESTRATOR}/voice/turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        res.writeHead(502);
        return res.end(JSON.stringify({ error: "orchestrator_error", status: r.status }));
      }
      return res.end(JSON.stringify(await r.json()));
    } catch {
      res.writeHead(502);
      return res.end(JSON.stringify({ error: "upstream_unavailable" }));
    }
  }

  if (req.url === "/api/events") {
    res.setHeader("content-type", "application/json");
    const latest = await fetchJsonAbsolute(`${LISTENER}/events/latest`, null);
    if (latest && typeof latest === "object") {
      upsertEvent(latest);
    }
    return res.end(
      JSON.stringify({
        items: eventFeed,
        total: eventFeed.length,
      }),
    );
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`[portal] running on :${PORT}`);
  console.log(`[portal] orchestrator=${ORCHESTRATOR}`);
  console.log(`[portal] listener=${LISTENER}`);
});

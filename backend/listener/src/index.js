import http from "node:http";

const PORT = Number(process.env.LISTENER_PORT || 8101);
const MOCK_MODE = String(process.env.LISTENER_MOCK_MODE || "true") === "true";
const PROGRAM_IDS = String(process.env.SOLANA_PROGRAM_IDS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

function buildMockEvent() {
  return {
    event_id: `evt_${Date.now()}`,
    chain: "solana",
    program_id: PROGRAM_IDS[0] || "11111111111111111111111111111111",
    slot: 0,
    signature: "mock_signature",
    event_type: "AccountChanged",
    subjects: [],
    payload: { source: "mock" }
  };
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    return res.end("Bad Request");
  }

  if (req.url === "/health") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ service: "solana-listener", ok: true, mock_mode: MOCK_MODE }));
  }

  if (req.url === "/events/latest") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify(buildMockEvent()));
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`[listener] running on :${PORT}`);
  console.log(`[listener] mock_mode=${MOCK_MODE}`);
});

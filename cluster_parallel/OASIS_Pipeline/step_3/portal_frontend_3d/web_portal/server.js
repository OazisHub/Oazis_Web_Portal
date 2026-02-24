import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 4173);
const clusterRoot = process.env.CLUSTER_ROOT;
if (!clusterRoot) {
  throw new Error('CLUSTER_ROOT is required for portal server');
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const staticIndex = resolve(scriptDir, 'index.html');
const staticApp = resolve(scriptDir, 'app.js');

const uiSignalPath = resolve(clusterRoot, '3_Runtime/ai_orchestrator/steps/1_6/data/ui_signal.json');
const advisoryPath = resolve(clusterRoot, '3_Runtime/ai_orchestrator/steps/1_5/data/advisory_message.json');

function safeReadJson(path, fallback = {}) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return fallback;
  }
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(readFileSync(staticIndex, 'utf-8'));
    return;
  }

  if (req.url === '/app.js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.end(readFileSync(staticApp, 'utf-8'));
    return;
  }

  if (req.url === '/api/ui-signal') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(safeReadJson(uiSignalPath, { reaction: 'pulse_neutral', voice_style: 'neutral', intensity: 0.5 })));
    return;
  }

  if (req.url === '/api/advisory-message') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(safeReadJson(advisoryPath, { message_text: 'No advisory available yet.', confidence_score: 0.5, voice_style: 'neutral' })));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('[portal] ▶ START server on http://localhost:' + PORT);
  console.log('[portal] ▶ USING ui_signal=' + uiSignalPath);
  console.log('[portal] ▶ USING advisory=' + advisoryPath);
});

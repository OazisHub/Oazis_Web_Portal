import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

function fmt(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(3) : "0.000";
}

async function fetchJson(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function setStatus(ok, text) {
  const el = document.getElementById("status");
  el.className = ok ? "ok" : "err";
  el.textContent = text;
}

function short(value, n = 10) {
  const s = String(value || "");
  if (s.length <= n) return s;
  return s.slice(0, n) + "...";
}

function createScene() {
  const host = document.getElementById("scene3d");
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x061019, 0.06);

  const camera = new THREE.PerspectiveCamera(52, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 100);
  camera.position.set(0, 0.35, 3.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0x9dd9ff, 0.45);
  scene.add(ambient);

  const key = new THREE.PointLight(0x58d9ff, 1.2, 10);
  key.position.set(1.3, 1.2, 2.2);
  scene.add(key);

  const rim = new THREE.PointLight(0x6dffc9, 0.8, 10);
  rim.position.set(-1.6, 0.6, -1.6);
  scene.add(rim);

  const coreGeo = new THREE.IcosahedronGeometry(0.78, 3);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x59d6ff,
    emissive: 0x1e7ea0,
    emissiveIntensity: 0.5,
    metalness: 0.15,
    roughness: 0.25,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  const ringGeo = new THREE.TorusGeometry(1.18, 0.03, 16, 140);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x7dffe0, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI * 0.5;
  scene.add(ring);

  const state = {
    reaction: "idle",
    intensity: 0.5,
    voiceStyle: "neutral",
  };

  function applySignal({ reaction, intensity, voiceStyle }) {
    state.reaction = reaction || "idle";
    state.intensity = Number.isFinite(Number(intensity)) ? Number(intensity) : 0.5;
    state.voiceStyle = voiceStyle || "neutral";

    let base = 0x59d6ff;
    if (String(state.reaction).includes("danger")) base = 0xff8f8f;
    if (String(state.reaction).includes("green")) base = 0x7dffe0;
    if (state.voiceStyle === "calm") base = 0x49d2ff;

    coreMat.color.setHex(base);
    coreMat.emissive.setHex(base);
    ringMat.color.setHex(base);
  }

  function onResize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();
    const amp = 1 + Math.max(0, state.intensity) * 0.08;
    const pulse = 1 + Math.sin(t * (1.6 + state.intensity * 2.4)) * 0.045 * amp;

    core.rotation.y += 0.006 + state.intensity * 0.01;
    core.rotation.x = Math.sin(t * 0.8) * 0.12;
    core.scale.setScalar(pulse);

    ring.rotation.z += 0.004 + state.intensity * 0.006;
    ring.scale.setScalar(1 + Math.sin(t * 1.2) * 0.04);

    coreMat.emissiveIntensity = 0.45 + state.intensity * 0.65;
    key.intensity = 1 + state.intensity * 1.4;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  applySignal(state);
  return { applySignal };
}

const sceneCtrl = createScene();
let currentEventFilter = "all";

function matchEventFilter(item, filter) {
  if (filter === "all") return true;
  const text = String(item?.event_type || "").toLowerCase();
  return text.includes(filter);
}

function renderEvents(items) {
  const root = document.getElementById("eventsList");
  const filtered = (items || []).filter((x) => matchEventFilter(x, currentEventFilter));
  if (!filtered.length) {
    root.innerHTML = "<div class='event-item'><div class='event-meta'>No events yet.</div></div>";
    return;
  }
  root.innerHTML = filtered
    .map((item) => {
      const when = String(item.created_at_utc || "").replace("T", " ").slice(0, 19);
      const severity = item.severity === "high" ? "high" : "info";
      return `
      <div class="event-item">
        <div class="event-row">
          <div class="event-type">${item.event_type || "UnknownEvent"}</div>
          <div class="tag ${severity}">${severity}</div>
        </div>
        <div class="event-meta">time: ${when || "-"} | program: ${short(item.program_id, 18)} | sig: ${short(item.signature, 18)}</div>
      </div>`;
    })
    .join("");
}

function applyData(advisory, signal) {
  const reaction = signal?.reaction || advisory?.ui_reaction || "idle";
  const voiceStyle = signal?.voice_style || advisory?.voice_style || "neutral";
  const intensity = signal?.intensity ?? advisory?.confidence_score ?? 0.5;

  document.getElementById("reaction").textContent = reaction;
  document.getElementById("voiceStyle").textContent = voiceStyle;
  document.getElementById("intensity").textContent = fmt(intensity);
  document.getElementById("confidence").textContent = fmt(advisory?.confidence_score ?? 0.5);
  document.getElementById("updated").textContent = "updated: " + new Date().toISOString();
  document.getElementById("message").textContent = advisory?.message_text || "No advisory available yet.";
  document.getElementById("entities").textContent = JSON.stringify(advisory?.related_entities || {}, null, 2);

  sceneCtrl.applySignal({ reaction, intensity, voiceStyle });
}

async function refresh() {
  const [advisory, signal, events] = await Promise.all([
    fetchJson("/api/advisory-message"),
    fetchJson("/api/ui-signal"),
    fetchJson("/api/events")
  ]);

  if (!advisory || !signal) {
    setStatus(false, "degraded");
  } else {
    setStatus(true, "online");
  }

  applyData(advisory || {}, signal || {});
  renderEvents(events?.items || []);
}

async function sendAsk() {
  const input = document.getElementById("askInput");
  const utterance = input.value.trim();
  if (!utterance) return;

  setStatus(true, "requesting...");
  const payload = {
    session_id: "classic_ui_session",
    wallet_pubkey: null,
    utterance_text: utterance,
    detected_intent: null,
    context_scope: "portal"
  };

  const advisory = await fetchJson("/api/voice-turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!advisory) {
    setStatus(false, "request failed");
    return;
  }

  if (advisory.error) {
    setStatus(false, advisory.error);
    return;
  }

  applyData(advisory, {
    reaction: advisory.ui_reaction,
    voice_style: advisory.voice_style,
    intensity: advisory.confidence_score
  });
  setStatus(true, "online");
  input.value = "";
}

document.getElementById("refresh").addEventListener("click", refresh);
document.getElementById("askQuick").addEventListener("click", () => {
  document.getElementById("askInput").focus();
});
document.getElementById("askSend").addEventListener("click", sendAsk);
document.getElementById("askInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendAsk();
});

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentEventFilter = btn.dataset.filter || "all";
    refresh();
  });
});

setInterval(refresh, 4000);
refresh();

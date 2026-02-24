async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return {};
  return await res.json();
}

function fmt(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(3) : "0.000";
}

async function tick() {
  const signal = await fetchJson('/api/ui-signal');
  const advisory = await fetchJson('/api/advisory-message');

  const reaction = signal.reaction || 'pulse_neutral';
  const voiceStyle = signal.voice_style || advisory.voice_style || 'neutral';
  const intensity = signal.intensity ?? advisory.confidence_score ?? 0.5;
  const msg = advisory.message_text || 'No advisory message yet.';

  document.getElementById('reaction').textContent = 'reaction: ' + reaction;
  document.getElementById('voiceStyle').textContent = 'voice_style: ' + voiceStyle;
  document.getElementById('intensity').textContent = 'intensity: ' + fmt(intensity);
  document.getElementById('updated').textContent = 'updated: ' + new Date().toISOString();
  document.getElementById('message').textContent = msg;

  const avatar = document.getElementById('avatar');
  const isPulse = String(reaction).includes('pulse');
  avatar.classList.toggle('pulse', isPulse);
  avatar.textContent = isPulse ? 'AVATAR • PULSE' : 'AVATAR • IDLE';
}

setInterval(tick, 1500);
tick();

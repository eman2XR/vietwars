// A live voice conversation with the editors through the Gemini Live API. The browser talks to Gemini directly; the
// key is kept on this device only (Settings). The model is told what is on screen, and the transcript is sent to the
// repository as a GitHub issue so the editors can use it as feedback.

import { store } from './store.js';
import { queueTalk, flush } from './sync.js';
import { stop as stopClips } from './audio.js';

const HOST = 'generativelanguage.googleapis.com';
const SOCKET = `wss://${HOST}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`;

const RULES = `You are one of the editors of Học tiếng Việt, a small personal magazine that teaches Northern (Hà Nội) Vietnamese to one English-speaking adult, an upper beginner, whose goal is dinner-table conversation and street talk. You are talking with them live, by voice.
- Answer in English, briefly (two or three sentences), unless they ask for more. Say Vietnamese words and phrases slowly and clearly, with a Hà Nội accent.
- Northern words and pronunciation only (bát not chén, vâng for yes, nghìn not ngàn, quả not trái, lợn not heo).
- Build on the words they already know. When you use a new word, say what it means.
- If a question on screen is waiting for an answer, give a hint first and the answer only if they ask for it.
- If they want practice, play a short scene (a seller, a waiter, a grandmother at the table) using their words.
- If you are not sure of a fact, say so. Never invent one.
- If they comment on the lessons or the site, thank them: the editors read every conversation.`;

let contextFn = () => 'the magazine';
export function setTalkContext(fn) {
  contextFn = fn;
}

export function talkKey() {
  return store.settings().geminiKey || '';
}

// Returns the newest model that supports live conversation, or throws with a readable message.
export async function findModel(key) {
  let res;
  try {
    res = await fetch(`https://${HOST}/v1beta/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  } catch {
    throw new Error('Gemini could not be reached');
  }
  if (!res.ok) throw new Error(res.status === 400 || res.status === 403 ? 'Gemini did not accept this key' : `Gemini answered ${res.status}`);
  const models = ((await res.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes('bidiGenerateContent'));
  if (!models.length) throw new Error('This key has no live-conversation model');
  const rank = (m) => (/native-audio/.test(m.name) ? 2 : 0) + (/preview/.test(m.name) ? 0 : 1);
  models.sort((a, b) => rank(b) - rank(a) || b.name.localeCompare(a.name));
  return models[0].name.replace(/^models\//, '');
}

function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Averages microphone samples down to 16 kHz, 16-bit, as Gemini expects.
function toPcm16(samples, rate) {
  const step = rate / 16000;
  const out = new Int16Array(Math.floor(samples.length / step));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.floor(i * step); j < Math.floor((i + 1) * step) && j < samples.length; j++, n++) sum += samples[j];
    const v = Math.max(-1, Math.min(1, n ? sum / n : 0));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return new Uint8Array(out.buffer);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Opens the conversation sheet. Call it from a tap, so the microphone and audio can start.
export function openTalk() {
  if (document.querySelector('.talk-sheet')) return;
  stopClips();
  const key = talkKey();
  const context = contextFn();
  const sheet = document.createElement('div');
  sheet.className = 'talk-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Ask a question');
  sheet.innerHTML = `
    <div class="talk-head"><div class="label">Ask a question</div><span class="talk-status">Connecting...</span></div>
    <p class="talk-about hint">About: ${esc(context.split('\n')[0])}</p>
    <div class="talk-log" aria-live="polite"></div>
    <form class="talk-form" autocomplete="off">
      <input name="t" type="text" enterkeyhint="send" placeholder="Speak, or type here" aria-label="Type a question">
      <button type="submit" class="btn small">Send</button>
    </form>
    <button type="button" class="btn primary talk-end">End</button>`;
  document.body.appendChild(sheet);
  const status = sheet.querySelector('.talk-status');
  const log = sheet.querySelector('.talk-log');
  const turns = [];
  const talkId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let live = null;
  let ended = false;

  // Keeps the transcript in the outbox as it grows, so a reload or a closed tab does not lose it.
  function persist(open) {
    const said = turns.filter((t) => t.text.trim());
    if (said.length) queueTalk({ talkId, context, model: live?.model || null, turns: said.map(({ who, text }) => ({ who, text: text.trim() })), startedAt: live?.startedAt || new Date().toISOString(), open });
  }
  const onHide = () => persist(false);
  window.addEventListener('pagehide', onHide);

  function say(who, text) {
    if (!text) return;
    const last = turns[turns.length - 1];
    if (last && last.who === who && !last.done) last.text += text;
    else turns.push({ who, text, done: false });
    const t = turns[turns.length - 1];
    let el = log.lastElementChild;
    if (!el || el.dataset.i !== String(turns.length - 1)) {
      el = document.createElement('p');
      el.className = `talk-line ${who}`;
      el.dataset.i = String(turns.length - 1);
      log.appendChild(el);
    }
    el.innerHTML = `<b>${who === 'you' ? 'You' : 'Editor'}</b> ${esc(t.text.trim())}`;
    log.scrollTop = log.scrollHeight;
  }
  const closeTurns = () => {
    turns.forEach((t) => (t.done = true));
    if (!ended) persist(true);
  };

  async function end() {
    if (ended) return;
    ended = true;
    live?.close();
    sheet.remove();
    window.removeEventListener('pagehide', onHide);
    persist(false);
    flush();
  }
  sheet.querySelector('.talk-end').addEventListener('click', end);
  sheet.addEventListener('keydown', (ev) => ev.key === 'Escape' && end());
  sheet.querySelector('.talk-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = ev.target.t.value.trim();
    if (!text || !live?.ready) return;
    ev.target.t.value = '';
    closeTurns();
    say('you', text);
    closeTurns();
    live.text(text);
  });

  if (!key) {
    status.textContent = 'Needs a key';
    log.innerHTML = '<p class="hint">Add your Gemini key in Settings, under Ask a question.</p>';
    return end;
  }
  connect(key, `${RULES}\n\nWhat is on screen and what the learner knows:\n${context}`, {
    status: (s) => (status.textContent = s),
    heard: (t) => say('you', t),
    spoke: (t) => say('editor', t),
    turnDone: closeTurns,
    note: (msg) => log.insertAdjacentHTML('beforeend', `<p class="hint">${esc(msg)}</p>`),
    failed: (msg) => {
      status.textContent = 'Not connected';
      log.insertAdjacentHTML('beforeend', `<p class="hint">${esc(msg)}</p>`);
    },
  }).then((l) => {
    live = l;
    if (ended) l?.close();
  });
  return end;
}

async function connect(key, instruction, on) {
  let model;
  try {
    model = store.settings().geminiModel || (await findModel(key));
  } catch (err) {
    on.failed(err.message);
    return null;
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume();
  let playAt = 0;
  const playing = new Set();
  let mic = null;
  const ws = new WebSocket(`${SOCKET}?key=${encodeURIComponent(key)}`);
  const live = {
    model,
    startedAt: new Date().toISOString(),
    ready: false,
    text(t) {
      ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: t }] }], turnComplete: true } }));
    },
    close() {
      mic?.getTracks().forEach((t) => t.stop());
      playing.forEach((s) => s.stop());
      if (ws.readyState <= 1) ws.close();
      ctx.close();
    },
  };

  function playPcm(b64) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
    const buf = ctx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    playAt = Math.max(playAt, ctx.currentTime + 0.05);
    src.start(playAt);
    playAt += buf.duration;
    playing.add(src);
    src.onended = () => playing.delete(src);
  }

  async function startMic() {
    on.status('Allow the microphone, or type');
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      await ctx.audioWorklet.addModule('js/pcm-capture.js');
      const node = new AudioWorkletNode(ctx, 'vw-capture');
      ctx.createMediaStreamSource(mic).connect(node);
      let chunks = [];
      let count = 0;
      node.port.onmessage = (ev) => {
        chunks.push(ev.data);
        count += ev.data.length;
        if (count < ctx.sampleRate / 10 || ws.readyState !== 1) return;
        const all = new Float32Array(count);
        let at = 0;
        for (const c of chunks) {
          all.set(c, at);
          at += c.length;
        }
        chunks = [];
        count = 0;
        ws.send(JSON.stringify({ realtimeInput: { audio: { data: base64(toPcm16(all, ctx.sampleRate)), mimeType: 'audio/pcm;rate=16000' } } }));
      };
      on.status('Listening');
    } catch {
      on.note('The microphone is off for this site, so type instead (or allow the microphone in Settings).');
      on.status('Type your question');
    }
  }

  ws.onopen = () => {
    ws.send(JSON.stringify({ setup: { model: `models/${model}`, generationConfig: { responseModalities: ['AUDIO'] }, systemInstruction: { parts: [{ text: instruction }] }, inputAudioTranscription: {}, outputAudioTranscription: {} } }));
  };
  ws.onmessage = async (ev) => {
    let msg;
    try {
      msg = JSON.parse(typeof ev.data === 'string' ? ev.data : await ev.data.text());
    } catch {
      return;
    }
    if (msg.setupComplete) {
      live.ready = true;
      startMic();
      return;
    }
    const sc = msg.serverContent;
    if (!sc) return;
    if (sc.inputTranscription?.text) on.heard(sc.inputTranscription.text);
    if (sc.outputTranscription?.text) on.spoke(sc.outputTranscription.text);
    for (const p of sc.modelTurn?.parts || []) {
      if (p.inlineData?.data) {
        playPcm(p.inlineData.data);
        on.status('Speaking');
      }
    }
    if (sc.interrupted) {
      playing.forEach((s) => s.stop());
      playAt = 0;
    }
    if (sc.turnComplete) {
      on.turnDone();
      on.status(mic ? 'Listening' : 'Type your question');
    }
  };
  ws.onclose = (ev) => {
    if (!live.ready) on.failed(ev.reason || 'Gemini closed the connection. Check the key in Settings.');
    else on.status('Ended');
  };
  return live;
}

// Plays the pre-generated clip for a Vietnamese string, falling back to the device's own Vietnamese voice.

import { nfc } from './vi.js';

let clips = {};
const player = typeof Audio === 'undefined' ? null : new Audio();
if (player) player.preload = 'auto';

export async function loadAudio() {
  try {
    const res = await fetch('audio/index.json');
    clips = res.ok ? await res.json() : {};
  } catch {
    clips = {};
  }
}

const blobs = {};

// Fetches clips into memory ahead of time, so playback starts instantly and works offline.
export async function preload(texts) {
  const ids = [...new Set(texts.map((t) => clips[nfc(t).trim()]).filter((id) => id && !blobs[id]))];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`audio/${id}.m4a`);
        if (res.ok) blobs[id] = URL.createObjectURL(await res.blob());
      } catch {
        /* Falls back to streaming the file when played. */
      }
    }),
  );
}

export function hasClip(text) {
  return Boolean(clips[nfc(text).trim()]);
}

function speak(text, slow) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'vi-VN';
  u.rate = slow ? 0.6 : 0.9;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('vi'));
  if (voice) u.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

let sequence = 0;

export function play(text, { slow = false } = {}) {
  if (!player) return;
  sequence += 1;
  player.onended = null;
  const id = clips[nfc(text).trim()];
  if (!id) {
    speak(text, slow);
    return;
  }
  player.pause();
  player.src = blobs[id] || `audio/${id}.m4a`;
  player.playbackRate = slow ? 0.65 : 1;
  player.preservesPitch = true;
  player.webkitPreservesPitch = true;
  const p = player.play();
  if (p && p.catch) p.catch(() => {});
}

// Plays the lines of a conversation one after another, with a short pause between speakers. Any other play stops it.
export function playAll(texts, gap = 450) {
  if (!player || !texts.length) return;
  sequence += 1;
  const run = sequence;
  const next = (i) => {
    if (run !== sequence || i >= texts.length) return;
    const id = clips[nfc(texts[i]).trim()];
    if (!id) {
      speak(texts[i], false);
      setTimeout(() => next(i + 1), 600 + texts[i].length * 90 + gap);
      return;
    }
    player.pause();
    player.src = blobs[id] || `audio/${id}.m4a`;
    player.playbackRate = 1;
    player.onended = () => {
      player.onended = null;
      setTimeout(() => next(i + 1), gap);
    };
    const p = player.play();
    if (p && p.catch) p.catch(() => {});
  };
  next(0);
}

export function stop() {
  if (!player) return;
  sequence += 1;
  player.onended = null;
  player.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

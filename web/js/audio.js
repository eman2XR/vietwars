// Plays the pre-generated clip for a Vietnamese string, falling back to the device's own Vietnamese voice.

import { nfc } from './vi.js';

let clips = {};
const player = new Audio();
player.preload = 'auto';

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

export function play(text, { slow = false } = {}) {
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

export function stop() {
  player.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

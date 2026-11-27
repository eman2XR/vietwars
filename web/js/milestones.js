// Word-count milestones: which have been reached, the next one, the current rank, and which words of a milestone's
// saying the learner already knows.

import { nfc, tokens } from './vi.js';

export function milestoneState(count, list) {
  const sorted = [...list].sort((a, b) => a.words - b.words);
  const earned = sorted.filter((m) => count >= m.words);
  const next = sorted.find((m) => count < m.words) || null;
  const rank = [...earned].reverse().find((m) => m.rank) || null;
  const nextRank = sorted.find((m) => m.rank && count < m.words) || null;
  const prev = earned.length ? earned[earned.length - 1].words : 0;
  return {
    earned,
    next,
    rank,
    nextRank,
    toNext: next ? next.words - count : 0,
    progress: next ? Math.max(0, Math.min(1, (count - prev) / (next.words - prev))) : 1,
  };
}

// The saying's syllables, each marked known when it (or the two-syllable word it starts or ends) is a word the
// learner has met or knows.
export function sayingWords(text, knownWords) {
  const known = new Set([...knownWords].map((w) => nfc(w).toLowerCase()));
  const parts = nfc(text).split(/\s+/).filter(Boolean);
  const plain = parts.map((p) => tokens(p)[0] || '');
  const flags = plain.map((p) => known.has(p));
  for (let i = 0; i < plain.length - 1; i++) {
    if (known.has(`${plain[i]} ${plain[i + 1]}`)) flags[i] = flags[i + 1] = true;
  }
  return parts.map((p, i) => ({ text: p, known: flags[i] }));
}

// The milestone each finished result first reached, replaying word counts in finishing order.
export function milestoneDates(counts, list) {
  const dates = {};
  for (const { at, count } of counts) {
    for (const m of list) if (count >= m.words && !dates[m.words]) dates[m.words] = at;
  }
  return dates;
}

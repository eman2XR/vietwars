// Adapting the review desk to what the learner actually struggles with: pairs of words they have taken for each other,
// and real-life lines from earlier issues that tripped them up.

import { nfc } from './vi.js';

// Pairs of words taken for each other, from every answer so far: in listening a meaning picked for another word's
// sound, in reverse a word picked for another word's meaning. Most frequent and most recent first.
export function confusions(history, words) {
  const byMeaning = new Map();
  for (const w of words.values()) if (!byMeaning.has(w.en)) byMeaning.set(w.en, w);
  const pairs = new Map();
  for (const r of history) {
    for (const e of r.events || []) {
      if (e.ok !== false || e.warmup || e.combo || e.mixup || !e.w || !e.a) continue;
      if (e.t !== 'listen' && e.t !== 'reverse') continue;
      const target = words.get(nfc(e.w));
      const other = e.t === 'listen' ? byMeaning.get(e.a) : words.get(nfc(e.a));
      if (!target || !other || nfc(other.vi) === nfc(target.vi)) continue;
      const key = [nfc(target.vi), nfc(other.vi)].sort().join('|');
      const p = pairs.get(key) || { a: target, b: other, count: 0, last: '' };
      p.count += 1;
      if (String(r.finishedAt) > p.last) p.last = String(r.finishedAt);
      pairs.set(key, p);
    }
  }
  return [...pairs.values()].sort((x, y) => y.count - x.count || y.last.localeCompare(x.last));
}

// Up to `max` mix-ups worth practising in a review: a pair where one of the words is due, or one confused in the
// last week. Known words are left out.
export function mixupsFor(history, words, due, { known = new Set(), max = 3, now = Date.now() } = {}) {
  const dueSet = new Set(due.map((w) => nfc(w.vi)));
  const week = now - 7 * 86400000;
  return confusions(history, words)
    .filter((p) => !known.has(nfc(p.a.vi)) && !known.has(nfc(p.b.vi)))
    .filter((p) => dueSet.has(nfc(p.a.vi)) || dueSet.has(nfc(p.b.vi)) || Date.parse(p.last) > week)
    .slice(0, max);
}

// Real-life lines from issues already played, for a review: first the ones missed most (and not answered right
// since), then price lines, never one shown in the last review.
export function realLifeFor(history, lessons, { max = 3, random = Math.random } = {}) {
  const played = new Set(history.filter((r) => r.kind === 'lesson' && !r.partial).map((r) => r.lessonId));
  const lastReview = [...history].reverse().find((r) => r.kind === 'review');
  const shownLast = new Set((lastReview?.events || []).filter((e) => e.t === 'situation' || e.t === 'say').map((e) => e.w));
  const score = new Map();
  for (const r of history) {
    for (const e of r.events || []) {
      if (e.t !== 'situation' && e.t !== 'say') continue;
      score.set(e.w, (score.get(e.w) || 0) + (e.ok === false || e.g === 'wrong' ? 3 : -2));
    }
  }
  const lines = lessons
    .filter((l) => played.has(l.id))
    .flatMap((l) => l.situations || [])
    .filter((s) => !shownLast.has(s.say ? s.say : s.vi));
  const isPrice = (s) => Boolean(s.digits) || (s.options || []).some((o) => /₫/.test(o)) || /\d/.test(s.say || '');
  const ranked = lines
    .map((s) => ({ s, v: (score.get(s.say ? s.say : s.vi) || 0) + (isPrice(s) ? 1.5 : 0) + random() }))
    .sort((a, b) => b.v - a.v);
  return ranked.slice(0, max).map((x) => x.s);
}

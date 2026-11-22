// The review deck: which words come back for review, and when. Built the same way on every device and on the editors'
// Mac (scripts/reviews.mjs), by replaying finished results in the order they were finished.

import { nfc } from './vi.js';
import { schedule, outcomeFor } from './srs.js';

// Typed answers that prove a word is known when the learner also tapped "I know it".
export const VERIFIED = new Set(['perfect', 'tone', 'marks', 'sound']);

// Updates the deck from one finished result. provenKnown (words proved known) is updated in place.
export function deckFromResult(deck, result, { siteKnown = [], provenKnown = [], lessonOf = () => undefined } = {}) {
  if (result.partial) return;
  const now = Date.parse(result.finishedAt) || Date.now();
  const known = new Set([...siteKnown.map(nfc), ...provenKnown.map(nfc)]);
  for (const w of result.words || []) {
    const verified = w.known && VERIFIED.has(w.firstTry?.type);
    if (verified && !provenKnown.includes(w.vi)) provenKnown.push(w.vi);
    if (known.has(nfc(w.vi)) || verified) {
      delete deck[w.vi];
      continue;
    }
    const card = deck[w.vi] || { lesson: lessonOf(w.vi) };
    const outcome = result.kind === 'review' ? (w.share >= 1 ? 'good' : 'again') : outcomeFor(w.share || 0);
    deck[w.vi] = schedule(card, outcome, now);
  }
  for (const m of result.warmup || []) {
    if (!m.ok && !known.has(nfc(m.vi)) && !deck[m.vi]) deck[m.vi] = schedule({ lesson: result.lessonId }, 'again', now);
  }
}

// Replays every finished result in order and returns the deck.
export function buildDeck(results, options = {}) {
  const deck = {};
  const provenKnown = [...(options.provenKnown || [])];
  const ordered = [...results].sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)));
  for (const r of ordered) deckFromResult(deck, r, { ...options, provenKnown });
  return deck;
}

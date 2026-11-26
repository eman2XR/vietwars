// Leitner-style spaced repetition: each correct review moves a word to a longer interval.

export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60, 120];
const DAY = 86400000;
const SLACK = 3 * 3600000;

export function schedule(card, outcome, now = Date.now()) {
  const last = INTERVAL_DAYS.length - 1;
  let box = card?.box ?? 0;
  if (outcome === 'again') box = 0;
  else if (outcome === 'good') box = Math.min(box + 1, last);
  else if (outcome === 'easy') box = Math.min(box + 2, last);
  // A missed word is practised again before the session ends, so it comes back the next day, not minutes later.
  const due = now + Math.max(1, INTERVAL_DAYS[box]) * DAY - SLACK;
  return { ...card, box, due, reviewed: now };
}

// Maps how well a word went in a lesson (share of first-try correct answers) to its first review.
export function outcomeFor(share) {
  if (share >= 1) return 'easy';
  if (share >= 0.6) return 'good';
  return 'again';
}

export function dueWords(deck, now = Date.now()) {
  return Object.entries(deck)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([vi]) => vi);
}

export function nextDue(deck) {
  const times = Object.values(deck).map((c) => c.due);
  return times.length ? Math.min(...times) : null;
}

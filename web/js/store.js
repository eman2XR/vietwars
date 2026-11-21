// Local storage for progress, the review deck, results history, the outbox and settings.

const KEYS = {
  progress: 'vw-progress',
  deck: 'vw-deck',
  history: 'vw-history',
  outbox: 'vw-outbox',
  settings: 'vw-settings',
};
const HISTORY_LIMIT = 200;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function localDay(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const store = {
  progress() {
    return load(KEYS.progress, { xp: 0, days: [], lessons: {}, words: {}, speedBest: 0 });
  },
  saveProgress(p) {
    save(KEYS.progress, p);
  },
  deck() {
    return load(KEYS.deck, {});
  },
  saveDeck(d) {
    save(KEYS.deck, d);
  },
  history() {
    return load(KEYS.history, []);
  },
  addHistory(result) {
    const h = load(KEYS.history, []);
    h.push(result);
    save(KEYS.history, h.slice(-HISTORY_LIMIT));
  },
  outbox() {
    return load(KEYS.outbox, []);
  },
  saveOutbox(o) {
    save(KEYS.outbox, o);
  },
  settings() {
    return load(KEYS.settings, {});
  },
  saveSettings(s) {
    save(KEYS.settings, s);
  },
  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      progress: this.progress(),
      deck: this.deck(),
      history: this.history(),
      outbox: this.outbox(),
    };
  },
  reset() {
    for (const k of [KEYS.progress, KEYS.deck, KEYS.history, KEYS.outbox]) localStorage.removeItem(k);
  },
};

export function streak(days, today = localDay()) {
  const set = new Set(days);
  const d = new Date(`${today}T12:00:00`);
  if (!set.has(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(localDay(d.getTime()))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

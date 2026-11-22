// Review reminders: works out which words are due from every saved result, exactly as the devices do (web/js/deck.js),
// and sends one notification a day when some are due.
//   node scripts/reviews.mjs          the words due now, and when the next ones come due
//   node scripts/reviews.mjs notify   send a reminder if words are due and none was sent today

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildDeck } from '../web/js/deck.js';
import { dueWords, nextDue } from '../web/js/srs.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STATE = `${ROOT}.push/state.json`;

function loadResults() {
  const dir = `${ROOT}learner/results`;
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))) : [];
}

export function dueNow(now = Date.now()) {
  const siteKnown = JSON.parse(readFileSync(`${ROOT}web/lessons/known.json`, 'utf8')).words || [];
  const deck = buildDeck(loadResults(), { siteKnown });
  return { due: dueWords(deck, now), next: nextDue(deck), size: Object.keys(deck).length };
}

function localDay(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function notify() {
  const { due } = dueNow();
  if (!due.length) return console.log('no words due');
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
  const today = localDay(Date.now());
  if (state.reviewDay === today) return console.log(`${due.length} due; a reminder was already sent today`);
  const { sendAll } = await import('./push.mjs');
  const shown = due.slice(0, 4).join(', ') + (due.length > 4 ? ', ...' : '');
  const sent = await sendAll({ title: due.length === 1 ? '1 word to review' : `${due.length} words to review`, body: `A couple of minutes now keeps them: ${shown}`, url: '#/review', tag: 'review' });
  if (sent) {
    mkdirSync(`${ROOT}.push`, { recursive: true });
    writeFileSync(STATE, `${JSON.stringify({ ...state, reviewDay: today, reviewCount: due.length }, null, 1)}\n`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const proxied = process.env.HTTPS_PROXY || process.env.https_proxy;
if (isMain && proxied && !process.env.NODE_USE_ENV_PROXY && process.argv[2] === 'notify') {
  // Node's fetch ignores proxy settings unless NODE_USE_ENV_PROXY is set; run again with it.
  const run = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(run.status ?? 1);
} else if (isMain) {
  if (process.argv[2] === 'notify') {
    notify().catch((err) => {
      console.error(`error: ${err.message}`);
      process.exit(1);
    });
  } else {
    const { due, next, size } = dueNow();
    console.log(`${due.length} of ${size} word(s) due now${due.length ? `: ${due.join(', ')}` : ''}; next due ${next ? new Date(next).toLocaleString() : 'none'}`);
  }
}

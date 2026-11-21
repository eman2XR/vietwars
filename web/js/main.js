// App entry: loads lessons, routes between screens, applies the visual style and saves each finished session.

import { colorize, escapeHTML as esc, nfc } from './vi.js';
import { loadAudio, play, preload } from './audio.js';
import { store, localDay, streak } from './store.js';
import { schedule, outcomeFor, dueWords, nextDue, INTERVAL_DAYS } from './srs.js';
import { lessonSteps, reviewSteps, runSession } from './lesson.js';
import { queue, flush, testToken, pullResults, REPO } from './sync.js';
import { sprite } from './sprites.js';
import { picture } from './pictures.js';

const APP_VERSION = '2';
const REVIEW_LIMIT = 20;
const VERIFIED = new Set(['perfect', 'tone', 'marks', 'sound']);
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const testMode = params.has('test');

export const STYLES = [
  { id: 'paper', name: 'Paper', vi: 'Giấy', note: 'Warm paper; follows light and dark mode' },
  { id: 'night', name: 'Neon night', vi: 'Đêm', note: 'Dark arcade glow' },
  { id: 'lacquer', name: 'Lacquer', vi: 'Sơn mài', note: 'Black, vermilion and gold' },
  { id: 'street', name: 'Street poster', vi: 'Phố', note: 'Bold yellow and black' },
  { id: 'comic', name: 'Comic', vi: 'Truyện tranh', note: 'Ink outlines and halftone dots' },
  { id: 'jade', name: 'Jade', vi: 'Ngọc', note: 'Calm greens, soft and round' },
  { id: 'arcade', name: 'Pixel arcade', vi: 'Trò chơi', note: 'Chunky 8-bit panels' },
  { id: 'silk', name: 'Silk', vi: 'Lụa', note: 'Quiet, airy and serif' },
];

let LESSONS = [];
let GAME = { callouts: {} };
const WORDS = new Map();
let KNOWN = new Set();
let SITE_KNOWN = [];
let endSession = null;

const GEAR =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>';

function currentStyle() {
  const preview = params.get('style');
  if (preview && STYLES.some((s) => s.id === preview)) return preview;
  return store.settings().style || 'paper';
}

function applyStyle(id = currentStyle()) {
  document.documentElement.dataset.style = id;
  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', bg));
  });
}

async function getJSON(path, fallback) {
  try {
    const res = await fetch(path);
    return res.ok ? await res.json() : fallback;
  } catch {
    return fallback;
  }
}

async function loadLessons() {
  const index = await getJSON('lessons/index.json', { lessons: [] });
  LESSONS = (await Promise.all(index.lessons.map((l) => getJSON(`lessons/${l.file}`, null)))).filter(Boolean);
  GAME = await getJSON('lessons/game.json', { callouts: {} });
  SITE_KNOWN = ((await getJSON('lessons/known.json', { words: [] })).words || []).map(nfc);
  for (const lesson of LESSONS) {
    for (const w of lesson.words) {
      const key = nfc(w.vi);
      if (!WORDS.has(key) || WORDS.get(key).warmup) WORDS.set(key, { ...w, lessonId: lesson.id });
    }
    for (const w of lesson.warmup || []) {
      const key = nfc(w.vi);
      if (!WORDS.has(key)) WORDS.set(key, { ...w, lessonId: lesson.id, warmup: true });
    }
  }
  refreshKnown();
}

function refreshKnown() {
  KNOWN = new Set([...SITE_KNOWN, ...(store.progress().known || []).map(nfc)]);
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function device() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'other';
}

function relative(t) {
  const m = Math.round((t - Date.now()) / 60000);
  if (m < 60) return `in ${Math.max(1, m)} minute${m === 1 ? '' : 's'}`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? '' : 's'}`;
}

function foeLines(foe) {
  if (!foe) return [];
  return [...(foe.taunts || []), foe.win, foe.lose].filter(Boolean).map((l) => l.vi);
}

function buildResult(kind, lesson, out) {
  const ev = out.events;
  return {
    schema: 2,
    resultId: uuid(),
    kind,
    lessonId: lesson ? lesson.id : 'review',
    lessonTitle: lesson ? lesson.title : 'Review',
    appVersion: APP_VERSION,
    style: currentStyle(),
    device: device(),
    startedAt: out.startedAt,
    finishedAt: out.finishedAt,
    durationSec: out.durationSec,
    summary: {
      firstTryAccuracy: out.summary.firstTryAccuracy,
      exercises: out.summary.exercises,
      xp: out.xp,
      speedScore: out.speed.score,
      speedAnswered: out.speed.answered,
      speedCorrect: out.speed.correct,
      bestCombo: out.speed.bestCombo,
    },
    battle: out.battle,
    words: out.summary.perWord.map((w) => ({ ...w, known: out.known.includes(w.vi) })),
    warmup: ev.filter((e) => e.warmup).map((e) => ({ vi: e.w, ok: e.ok, ms: e.ms })),
    toneConfusions: ev.filter((e) => e.t === 'spell' && !e.ok && !e.ambush).map((e) => ({ target: e.w, chose: e.a })),
    meaningConfusions: ev.filter((e) => (e.t === 'listen' || e.t === 'speed') && !e.ok && !e.warmup).map((e) => ({ target: e.w, chose: e.a, t: e.t })),
    typed: ev.filter((e) => e.t === 'type').map((e) => ({ target: e.w, answer: e.a, grade: e.g, hints: e.hints, keys: e.keys, dictation: e.dictation, retry: e.retry })),
    feedback: out.feedback,
    events: ev.map(({ t, w, ok, g, a, ms, retry, warmup, ambush, dictation, timeout }) => ({ t, w, ok, g, a, ms, retry, warmup, ambush, dictation, timeout })),
  };
}

function freshProgress() {
  return { xp: 0, days: [], lessons: {}, words: {}, speedBest: 0, known: [] };
}

// Applies one finished session to progress and the review deck, as of the time it finished. Replaying every result in order rebuilds the same state on any device.
function applyResult(p, deck, result) {
  const now = Date.parse(result.finishedAt) || Date.now();
  p.known = p.known || [];
  const known = new Set([...SITE_KNOWN, ...p.known.map(nfc)]);
  p.xp += result.summary?.xp || 0;
  const day = localDay(now);
  if (!p.days.includes(day)) p.days.push(day);
  p.days = p.days.sort().slice(-400);
  p.speedBest = Math.max(p.speedBest || 0, result.summary?.speedScore || 0);
  if (result.kind === 'lesson') {
    const l = p.lessons[result.lessonId] || { attempts: 0, best: 0 };
    l.attempts += 1;
    l.best = Math.max(l.best, result.summary?.firstTryAccuracy || 0);
    l.last = result.finishedAt;
    if (result.battle?.won) l.won = true;
    const order = ['C', 'B', 'A', 'S'];
    const r = result.battle?.rank;
    if (r && (!l.rank || order.indexOf(r) > order.indexOf(l.rank))) l.rank = r;
    p.lessons[result.lessonId] = l;
  }
  for (const w of result.words || []) {
    const s = p.words[w.vi] || { seen: 0, credit: 0 };
    s.seen += 1;
    s.credit = Math.round((s.credit + (w.share || 0)) * 100) / 100;
    s.last = result.finishedAt;
    p.words[w.vi] = s;
    const verified = w.known && VERIFIED.has(w.firstTry?.type);
    if (verified && !p.known.includes(w.vi)) p.known.push(w.vi);
    if (known.has(nfc(w.vi)) || verified) {
      delete deck[w.vi];
      continue;
    }
    const card = deck[w.vi] || { lesson: WORDS.get(nfc(w.vi))?.lessonId };
    const outcome = result.kind === 'review' ? (w.share >= 1 ? 'good' : 'again') : outcomeFor(w.share || 0);
    deck[w.vi] = schedule(card, outcome, now);
  }
  for (const m of result.warmup || []) {
    if (!m.ok && !known.has(nfc(m.vi)) && !deck[m.vi]) deck[m.vi] = schedule({ lesson: result.lessonId }, 'again', now);
  }
}

function saveResult(result) {
  const p = store.progress();
  const deck = store.deck();
  applyResult(p, deck, result);
  store.saveProgress(p);
  store.saveDeck(deck);
  store.addHistory(result);
  refreshKnown();
  queue(result);
}

function rebuild(results) {
  const p = freshProgress();
  const deck = {};
  for (const r of results) applyResult(p, deck, r);
  store.saveProgress(p);
  store.saveDeck(deck);
  store.saveHistory(results);
  refreshKnown();
}

let syncing = null;

// Merges the results every device has posted to GitHub with this device's own, and rebuilds progress if anything new arrived.
function syncNow() {
  if (syncing) return syncing;
  syncing = (async () => {
    let remote;
    try {
      remote = await pullResults();
    } catch (e) {
      return { error: e.message || 'No connection' };
    }
    const local = store.history();
    const byId = new Map();
    for (const r of [...local, ...remote]) if (r?.resultId && !byId.has(r.resultId)) byId.set(r.resultId, r);
    const merged = [...byId.values()].sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)));
    const mine = new Set(local.map((r) => r.resultId));
    const added = merged.filter((r) => !mine.has(r.resultId)).length;
    if (added) rebuild(merged);
    store.saveSettings({ ...store.settings(), syncedAt: new Date().toISOString() });
    return { added, total: merged.length };
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

async function syncAndRefresh() {
  const r = await syncNow();
  const route = (location.hash || '#/').split('/')[1] || '';
  if (r.added && !document.body.classList.contains('in-session') && ['', 'words'].includes(route)) render();
  return r;
}

function startSession(kind, lesson) {
  let steps;
  let words;
  let foe;
  let warmup = [];
  if (kind === 'lesson') {
    const review = (lesson.review || []).map((vi) => WORDS.get(nfc(vi))).filter((w) => w && !KNOWN.has(nfc(w.vi)));
    warmup = lesson.warmup || [];
    steps = lessonSteps(lesson, { review, warmup });
    words = [...lesson.words, ...review];
    foe = lesson.foe;
  } else {
    const due = dueWords(store.deck())
      .filter((vi) => !KNOWN.has(vi))
      .slice(0, REVIEW_LIMIT)
      .map((vi) => WORDS.get(vi))
      .filter(Boolean);
    if (!due.length) {
      location.hash = '#/';
      return;
    }
    steps = reviewSteps(due, [...WORDS.values()]);
    words = due;
    foe = GAME.reviewFoe;
  }
  const powerups = [...WORDS.values()].filter((w) => w.picture?.kind === 'icon' && w.picture.name !== 'yum');
  preload([
    ...words.map((w) => w.vi),
    ...words.flatMap((w) => (w.contrast || []).map((c) => c.vi)),
    ...(lesson?.combos || []).map((c) => c.vi),
    ...(lesson?.grammar?.examples || []).map((x) => x.vi),
    ...warmup.map((w) => w.vi),
    ...foeLines(foe),
    ...powerups.map((w) => w.vi),
  ]);
  document.body.classList.add('in-session');
  endSession = runSession(
    app,
    { steps, words, lesson, testMode, foe, game: GAME, powerups, boss: kind === 'lesson', jumpTo: testMode ? params.get('jump') : null },
    (out) => {
      const result = buildResult(kind, lesson, out);
      saveResult(result);
      showDone(result);
    },
    () => {
      endSession = null;
      location.hash = '#/';
    },
  );
}

function showDone(result) {
  endSession = null;
  document.body.classList.remove('in-session');
  history.replaceState(null, '', `${location.pathname}${location.search}#/`);
  const nd = nextDue(store.deck());
  const b = result.battle;
  app.innerHTML = `
    <div class="page done-page">
      <h1 class="title">Saved</h1>
      <p class="lead">${esc(result.lessonTitle)}: ${Math.round(result.summary.firstTryAccuracy * 100)}% on the first try, ${result.summary.xp} XP${b ? `, rank ${esc(b.rank)}${b.won ? ', foe defeated' : ''}` : ''}.</p>
      <p class="send-status" data-state="sending">Sending your results to the lesson planner...</p>
      ${nd ? `<p class="hint">Your next review is ${esc(relative(nd))}. Reviews space each word out a little more every time you remember it.</p>` : ''}
      <div class="actions"><button class="btn primary" data-act="home">Back to the campaign</button></div>
    </div>`;
  app.querySelector('[data-act=home]').addEventListener('click', home);
  const status = app.querySelector('.send-status');
  flush().then((r) => {
    if (r.left === 0) {
      status.dataset.state = 'sent';
      status.textContent = 'Sent. Your next lesson will be built from these results.';
    } else {
      status.dataset.state = 'queued';
      status.innerHTML = `${esc(r.error || 'Not sent yet')}. Your results are saved on this device and will be sent later. <a href="#/settings">Settings</a>`;
    }
  });
}

function lessonState(i, p) {
  const lp = p.lessons[LESSONS[i].id];
  if (lp?.won) return 'won';
  if (lp?.attempts) return 'played';
  if (i > 0 && !p.lessons[LESSONS[i - 1].id]?.attempts) return 'locked';
  return 'open';
}

function home() {
  const p = store.progress();
  const deck = store.deck();
  const live = Object.fromEntries(Object.entries(deck).filter(([vi]) => !KNOWN.has(vi) && WORDS.has(vi)));
  const due = dueWords(live);
  const nd = nextDue(live);
  const outbox = store.outbox().length;
  const learned = Object.keys(live).length + KNOWN.size;
  const states = LESSONS.map((l, i) => lessonState(i, p));
  let nextIdx = states.indexOf('open');
  if (nextIdx < 0) nextIdx = states.indexOf('played');
  const nextLesson = nextIdx >= 0 ? LESSONS[nextIdx] : null;
  const wins = Object.values(p.lessons).filter((l) => l.won).length;
  const ghost = GAME.reviewFoe;

  let reviewHTML;
  if (due.length) reviewHTML = `<div class="review-text"><h2>Review</h2><p>${due.length} word${due.length === 1 ? '' : 's'} to bring back before ${esc(ghost?.en || 'you forget them')} takes them.</p></div><a class="btn primary small" href="#/review">Start review</a>`;
  else if (nd) reviewHTML = `<div class="review-text"><h2>Review</h2><p>All caught up. Next review ${esc(relative(nd))}.</p></div>`;
  else reviewHTML = '<div class="review-text"><h2>Review</h2><p>Words you learn come back here at growing intervals, just before you would forget them.</p></div>';

  app.innerHTML = `
    <div class="page home">
      <header class="home-head">
        <div class="brand">
          <h1>Viet Wars</h1>
          <p class="sub">Học tiếng Việt: Northern Vietnamese, as spoken in Hà Nội</p>
        </div>
        <a class="icon-btn" href="#/settings" aria-label="Settings">${GEAR}</a>
      </header>
      ${
        nextLesson
          ? `<a class="hero" href="#/lesson/${esc(nextLesson.id)}">
          <div class="hero-art">${sprite(nextLesson.foe?.art)}</div>
          <div class="hero-body">
            <div class="label">${states[nextIdx] === 'played' ? 'Rematch' : 'Next battle'}: lesson ${esc(nextLesson.number)}</div>
            <h2>${esc(nextLesson.title)}</h2>
            ${nextLesson.foe ? `<div class="hero-foe"><span class="vi">${colorize(nextLesson.foe.name)}</span>, ${esc(nextLesson.foe.en)}</div>` : ''}
            <p>${nextLesson.words.length} new words${nextLesson.warmup?.length ? `, ${/^(8|11|18)/.test(String(nextLesson.warmup.length)) ? 'an' : 'a'} ${nextLesson.warmup.length}-word warm-up` : ''}</p>
            <span class="btn primary">Fight</span>
          </div>
        </a>`
          : ''
      }
      ${
        store.settings().seen !== APP_VERSION
          ? `<section class="news panel">
          <h2>New in Viet Wars</h2>
          <p>Every lesson is now a battle against a villain, with ambushes, power-ups and a boss round. Typing has on-screen tone keys, every word has a picture, and the words you already know are gone for good. There are eight looks to choose from.</p>
          <div class="row"><a class="btn small" href="#/settings">Choose a look</a><button class="btn ghost small" data-act="seen">Got it</button></div>
        </section>`
          : ''
      }
      <div class="stats home-stats">
        <div><b>${streak(p.days)}</b><span>day streak</span></div>
        <div><b>${learned}</b><span>words</span></div>
        <div><b>${wins}</b><span>wins</span></div>
        <div><b>${p.xp}</b><span>XP</span></div>
      </div>
      <section class="review-card ${due.length ? 'is-due' : ''}">
        <div class="review-art">${sprite(ghost?.art)}</div>
        ${reviewHTML}
      </section>
      ${outbox ? `<div class="outbox-note">${outbox} result${outbox === 1 ? '' : 's'} not sent yet. <a href="#/settings">Send</a></div>` : ''}
      <h2 class="section-title">Campaign</h2>
      <div class="campaign">
        ${LESSONS.map((l, i) => {
          const st = states[i];
          const lp = p.lessons[l.id];
          const foeName = l.foe ? esc(l.foe.name) : 'the foe';
          const status = {
            won: `Defeated ${foeName}${lp?.rank ? `, rank ${esc(lp.rank)}` : ''}`,
            played: `${foeName} got away. Best ${Math.round((lp?.best || 0) * 100)}%`,
            open: i === nextIdx ? 'Next battle' : 'Ready',
            locked: `Play lesson ${i} first`,
          }[st];
          const inner = `
            <div class="node-art">${sprite(l.foe?.art)}</div>
            <div class="node-body">
              <div class="node-num">Lesson ${esc(l.number)}</div>
              <h3>${esc(l.title)}</h3>
              <div class="vi node-vi">${colorize(l.vi)}</div>
              <p>${status}</p>
            </div>`;
          return st === 'locked'
            ? `<div class="node status-locked">${inner}</div>`
            : `<a class="node status-${st}${i === nextIdx ? ' is-next' : ''}" href="#/lesson/${esc(l.id)}">${inner}</a>`;
        }).join('')}
        <div class="node status-coming"><div class="node-art">${sprite('shadow')}</div><div class="node-body"><div class="node-num">Next</div><h3>Built from your results</h3><p>After each battle, the next lesson is planned from how you did.</p></div></div>
      </div>
      <div class="row links"><a class="text-link" href="#/words">Your words</a><a class="text-link" href="#/settings">Change the look</a></div>
    </div>`;
}

document.addEventListener('click', (ev) => {
  if (ev.target.closest('[data-act=seen]')) {
    store.saveSettings({ ...store.settings(), seen: APP_VERSION });
    ev.target.closest('.news')?.remove();
  }
});

function wordsPage() {
  const deck = store.deck();
  const row = (w, extra) =>
    `<button class="word-row" data-say="${esc(w.vi)}">${w.picture ? `<span class="pic-wrap tiny">${picture(w.picture)}</span>` : '<span class="pic-wrap tiny"></span>'}<span class="vi">${colorize(w.vi)}</span><span class="en">${esc(w.en)}</span>${extra}</button>`;
  const sections = LESSONS.map((l) => {
    const items = [...l.words, ...(l.warmup || [])].filter((w) => deck[nfc(w.vi)] && !KNOWN.has(nfc(w.vi)));
    if (!items.length) return '';
    return `<h2 class="section-title">${esc(l.title)}</h2><div class="word-list">${items
      .map((w) => {
        const c = deck[nfc(w.vi)];
        const level = Math.round((c.box / (INTERVAL_DAYS.length - 1)) * 100);
        return row(w, `<span class="meter" aria-label="Strength ${c.box} of ${INTERVAL_DAYS.length - 1}"><span class="meter-fill" data-level="${level}"></span></span><small>${c.due <= Date.now() ? 'due now' : esc(relative(c.due))}</small>`);
      })
      .join('')}</div>`;
  }).join('');
  const known = [...KNOWN].map((vi) => WORDS.get(vi) || { vi, en: '' });
  app.innerHTML = `<div class="page"><a class="back" href="#/">Campaign</a><h1 class="title">Your words</h1><p class="lead">Tap a word to hear it. The bar grows each time you remember it in a review.</p>${sections || '<p class="hint">Finish a lesson to start your review deck.</p>'}${
    known.length ? `<h2 class="section-title">Words you already know</h2><p class="hint">These are never reviewed or taught again.</p><div class="word-list">${known.map((w) => row(w, '<small>known</small>')).join('')}</div>` : ''
  }</div>`;
  app.querySelectorAll('.meter-fill').forEach((el) => {
    el.style.width = `${Math.max(8, Number(el.dataset.level))}%`;
  });
}

function stylePreview(s) {
  return `<button type="button" class="style-card ${currentStyle() === s.id ? 'on' : ''}" data-style="${s.id}" data-pick="${s.id}">
    <div class="style-sample">
      <div class="style-top"><span class="style-foe">${sprite('mosquito')}</span><span class="style-hp"><i></i></span></div>
      <div class="vi style-word">${colorize('phở bò')}</div>
      <div class="style-btn">Fight</div>
    </div>
    <div class="style-name"><b>${esc(s.name)}</b> <span class="vi">${colorize(s.vi)}</span><small>${esc(s.note)}</small></div>
  </button>`;
}

function settingsPage() {
  const s = store.settings();
  const outbox = store.outbox().length;
  const previewing = params.get('style');
  app.innerHTML = `
    <div class="page settings">
      <a class="back" href="#/">Campaign</a>
      <h1 class="title">Settings</h1>
      <section class="panel">
        <h2>Look</h2>
        <p>Pick a style. It changes the whole app on this device.${previewing ? ' You are previewing a style from the address bar.' : ''}</p>
        <div class="style-grid">${STYLES.map(stylePreview).join('')}</div>
      </section>
      <section class="panel">
        <h2>Sync between devices</h2>
        <p>Your progress comes from the results every device has sent to GitHub, so your iPhone, iPad and Mac show the same lessons, wins and reviews. It syncs when the app opens and when you come back to it. Each device needs the token below to send its own results.</p>
        <p class="sync-status hint">${s.syncedAt ? `Last synced ${esc(new Date(s.syncedAt).toLocaleString())}.` : 'Not synced yet.'} ${store.history().length} session${store.history().length === 1 ? '' : 's'} on this device.</p>
        <button class="btn small" data-act="sync">Sync now</button>
      </section>
      <section class="panel">
        <h2>Send results to the lesson planner</h2>
        <p>After each session your results are sent to <b>${esc(REPO)}</b> as a GitHub issue. The planning agents read them to write your next lesson. This needs a GitHub token on each device, because the Home Screen app keeps its own storage.</p>
        <ol class="steps">
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub's new fine-grained token page</a>.</li>
          <li>Repository access: <b>Only select repositories</b>, then <b>vietwars</b>.</li>
          <li>Permissions: <b>Issues</b>, set to <b>Read and write</b>. Nothing else.</li>
          <li>Generate it, copy it and paste it here.</li>
        </ol>
        <form class="token-form">
          <input name="token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_..." value="${esc(s.token || '')}" aria-label="GitHub token">
          <div class="row"><button class="btn primary small" type="submit">Save and test</button>${s.token ? '<button class="btn ghost small" type="button" data-act="forget">Remove</button>' : ''}</div>
          <p class="form-status"></p>
        </form>
        <p>${outbox ? `${outbox} result${outbox === 1 ? '' : 's'} waiting to send.` : 'Nothing waiting to send.'}</p>
        <div class="row">${outbox ? '<button class="btn small" data-act="send">Send now</button>' : ''}<button class="btn ghost small" data-act="copy">Copy all my data</button></div>
        <p class="copy-status hint"></p>
      </section>
      <section class="panel">
        <h2>Start over</h2>
        <p>Deletes progress, reviews and saved results on this device. Results already sent stay in GitHub.</p>
        <button class="btn danger small" data-act="reset">Reset progress</button>
      </section>
      <p class="hint">Version ${APP_VERSION}</p>
    </div>`;
  const form = app.querySelector('.token-form');
  const status = app.querySelector('.form-status');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const token = form.token.value.trim();
    store.saveSettings({ ...store.settings(), token });
    status.textContent = 'Testing...';
    const err = await testToken(token);
    status.textContent = err ? `Saved, but the test failed: ${err}.` : 'Saved. The token works.';
    if (!err && store.outbox().length) {
      const r = await flush();
      status.textContent += r.sent ? ` Sent ${r.sent} waiting result${r.sent === 1 ? '' : 's'}.` : '';
    }
  });
  app.querySelector('.settings').addEventListener('click', async (ev) => {
    const card = ev.target.closest('[data-pick]');
    if (card) {
      store.saveSettings({ ...store.settings(), style: card.dataset.pick });
      if (params.get('style')) {
        params.delete('style');
        history.replaceState(null, '', `${location.pathname}${params.toString() ? `?${params}` : ''}#/settings`);
      }
      applyStyle(card.dataset.pick);
      app.querySelectorAll('.style-card').forEach((c) => c.classList.toggle('on', c === card));
      return;
    }
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'sync') {
      const el = app.querySelector('.sync-status');
      el.textContent = 'Syncing...';
      const r = await syncNow();
      el.textContent = r.error
        ? `Could not sync: ${r.error}.`
        : `Synced. ${r.total} session${r.total === 1 ? '' : 's'} in total${r.added ? `, ${r.added} new from other devices` : ''}.`;
      return;
    }
    if (act === 'forget') {
      const { token, ...rest } = store.settings();
      store.saveSettings(rest);
      settingsPage();
    } else if (act === 'send') {
      const r = await flush();
      alert(r.left ? `Sent ${r.sent}. Not sent: ${r.left} (${r.error}).` : `Sent ${r.sent}.`);
      settingsPage();
    } else if (act === 'copy') {
      const text = JSON.stringify(store.exportAll(), null, 1);
      try {
        await navigator.clipboard.writeText(text);
        app.querySelector('.copy-status').textContent = 'Copied. You can paste it into a message or a Claude session.';
      } catch {
        app.querySelector('.copy-status').textContent = 'Copying is not allowed here.';
      }
    } else if (act === 'reset') {
      if (confirm('Delete all progress on this device?')) {
        store.reset();
        refreshKnown();
        location.hash = '#/';
      }
    }
  });
}

function render() {
  const hash = location.hash || '#/';
  const [, route, arg] = hash.split('/');
  if (endSession) {
    endSession();
    endSession = null;
  }
  document.body.classList.remove('in-session');
  if (route === 'lesson') {
    const lesson = LESSONS.find((l) => l.id === arg);
    if (lesson) return startSession('lesson', lesson);
  }
  if (route === 'review') return startSession('review');
  if (route === 'words') return wordsPage();
  if (route === 'settings') return settingsPage();
  return home();
}

document.addEventListener('click', (ev) => {
  const say = ev.target.closest('[data-say]');
  if (say && !document.body.classList.contains('in-session')) play(say.dataset.say);
});

async function boot() {
  applyStyle();
  await Promise.all([loadLessons(), loadAudio()]);
  window.addEventListener('hashchange', render);
  render();
  if (store.outbox().length) flush().then(() => syncAndRefresh());
  else syncAndRefresh();
  document.addEventListener('visibilitychange', () => {
    const last = Date.parse(store.settings().syncedAt || 0) || 0;
    if (document.visibilityState === 'visible' && Date.now() - last > 2 * 60000) syncAndRefresh();
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !testMode) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot().catch((err) => {
  app.innerHTML = `<div class="page"><h1 class="title">Could not load</h1><p class="lead">${esc(err.message)}</p></div>`;
});

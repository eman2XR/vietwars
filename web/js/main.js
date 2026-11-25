// App entry: loads the issues, routes between screens, applies the style, saves each session and syncs progress between devices.

import { colorize, escapeHTML as esc, nfc } from './vi.js';
import { loadAudio, play, preload } from './audio.js';
import { store, localDay, streak } from './store.js';
import { dueWords, nextDue, INTERVAL_DAYS } from './srs.js';
import { deckFromResult } from './deck.js';
import { lessonSteps, reviewSteps, runSession, stampHTML } from './lesson.js';
import { queue, flush, testToken, pullResults, queueFeedback, REPO } from './sync.js';
import { picture } from './pictures.js';
import { pushSupport, currentSubscription, enablePush, disablePush, loadPushKeys } from './push.js';
import { openTalk, setTalkContext, talkKey, findModel } from './talk.js';

const APP_VERSION = '5';
const REVIEW_LIMIT = 20;
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const testMode = params.has('test');

export const STYLES = [
  { id: 'paper', name: 'Paper', vi: 'Giấy dó', note: 'The mulberry-bark paper of Đông Hồ woodblock prints. Follows light and dark mode.' },
  { id: 'ink', name: 'Ink', vi: 'Mực', note: 'Dark, for reading at night.' },
  { id: 'lacquer', name: 'Lacquer', vi: 'Sơn mài', note: 'Black, vermilion and gold, after Hà Nội lacquer painting.' },
  { id: 'indigo', name: 'Indigo', vi: 'Chàm', note: 'The indigo cloth dyed in the northern mountains.' },
  { id: 'celadon', name: 'Celadon', vi: 'Men ngọc', note: 'The jade-green glaze of Lý and Trần dynasty ceramics.' },
  { id: 'silk', name: 'Silk', vi: 'Lụa', note: 'Quiet, white and airy.' },
];

let LESSONS = [];
const WORDS = new Map();
let KNOWN = new Set();
let SITE_KNOWN = [];
let endSession = null;

const GEAR =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>';

function currentStyle() {
  const preview = params.get('style');
  if (preview && STYLES.some((s) => s.id === preview)) return preview;
  const saved = store.settings().style;
  return STYLES.some((s) => s.id === saved) ? saved : 'paper';
}

function applyStyle(id = currentStyle()) {
  document.documentElement.dataset.style = id;
  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', bg));
  });
}

// Fetches a JSON file, trying again twice if a request fails (for example while a new version of the site takes over).
async function getJSON(path, fallback, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(path);
      if (res.ok) return await res.json();
      if (res.status === 404) return fallback;
    } catch {
      /* Tried again below. */
    }
    if (i < tries - 1) await new Promise((done) => setTimeout(done, 400 * (i + 1)));
  }
  return fallback;
}

async function loadLessons() {
  const index = await getJSON('lessons/index.json', { lessons: [] });
  LESSONS = (await Promise.all(index.lessons.map((l) => getJSON(`lessons/${l.file}`, null)))).filter(Boolean);
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

function shortDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const RESUME_DAYS = 21;

function savedPlace(lesson) {
  if (!lesson) return null;
  try {
    const d = JSON.parse(localStorage.getItem(`vw-resume-${lesson.id}`) || 'null');
    if (!d || Date.now() - d.savedAt > RESUME_DAYS * 86400000) return null;
    return d;
  } catch {
    return null;
  }
}

function buildResult(kind, lesson, out, partial = false) {
  const ev = out.events;
  return {
    schema: 3,
    partial: partial || undefined,
    progress: partial ? out.progress : undefined,
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
      bestStreak: out.bestStreak,
      grade: out.grade,
      speedScore: out.speed.score,
      speedAnswered: out.speed.answered,
      speedCorrect: out.speed.correct,
      bestCombo: out.speed.bestCombo,
    },
    article: out.article,
    quiz: out.quiz.total ? out.quiz : null,
    situations: out.situations?.total ? out.situations : null,
    dialogues: out.dialogues?.total ? out.dialogues : null,
    timing: out.timing,
    toneMarks: out.relaxed ? 'relaxed' : 'strict',
    words: out.summary.perWord.map((w) => ({ ...w, known: out.known.includes(w.vi) })),
    warmup: ev.filter((e) => e.warmup).map((e) => ({ vi: e.w, ok: e.ok, ms: e.ms })),
    toneConfusions: ev.filter((e) => e.t === 'spell' && !e.ok).map((e) => ({ target: e.w, chose: e.a })),
    meaningConfusions: ev.filter((e) => (e.t === 'listen' || e.t === 'speed') && !e.ok && !e.warmup).map((e) => ({ target: e.w, chose: e.a, t: e.t })),
    typed: ev.filter((e) => e.t === 'type').map((e) => ({ target: e.w, answer: e.a, grade: e.g, accepted: e.ok, hints: e.hints, keys: e.keys, firstKeyMs: e.firstKeyMs, deletes: e.deletes, revealed: e.revealed, tiles: e.tiles, dictation: e.dictation, retry: e.retry })),
    feedback: out.feedback,
    events: ev.map(({ t, w, ok, g, a, ms, retry, warmup, dictation, plays, hints, firstKeyMs, deletes, revealed, tiles }) => ({ t, w, ok, g, a, ms, retry, warmup, dictation, plays, hints, firstKeyMs, deletes, revealed, tiles })),
  };
}

function freshProgress() {
  return { days: [], lessons: {}, words: {}, speedBest: 0, known: [] };
}

const GRADES = ['complete', 'merit', 'distinction'];

function gradeOf(result) {
  if (result.summary?.grade) return result.summary.grade;
  const a = result.summary?.firstTryAccuracy || 0;
  return a >= 0.9 ? 'distinction' : a >= 0.7 ? 'merit' : 'complete';
}

// Applies one finished session to progress and the review deck, as of the time it finished. Replaying every result in order rebuilds the same state on any device.
function applyResult(p, deck, result) {
  if (result.partial) return;
  const now = Date.parse(result.finishedAt) || Date.now();
  p.known = p.known || [];
  const day = localDay(now);
  if (!p.days.includes(day)) p.days.push(day);
  p.days = p.days.sort().slice(-400);
  p.speedBest = Math.max(p.speedBest || 0, result.summary?.speedScore || 0);
  if (result.kind === 'lesson') {
    const l = p.lessons[result.lessonId] || { attempts: 0, best: 0 };
    l.attempts += 1;
    l.best = Math.max(l.best, result.summary?.firstTryAccuracy || 0);
    l.last = result.finishedAt;
    l.first = l.first || result.finishedAt;
    const g = gradeOf(result);
    if (!l.grade || GRADES.indexOf(g) > GRADES.indexOf(l.grade)) l.grade = g;
    p.lessons[result.lessonId] = l;
  }
  for (const w of result.words || []) {
    const s = p.words[w.vi] || { seen: 0, credit: 0 };
    s.seen += 1;
    s.credit = Math.round((s.credit + (w.share || 0)) * 100) / 100;
    s.last = result.finishedAt;
    p.words[w.vi] = s;
  }
  deckFromResult(deck, result, { siteKnown: SITE_KNOWN, provenKnown: p.known, lessonOf: (vi) => WORDS.get(nfc(vi))?.lessonId });
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
    if (added || store.progress().xp !== undefined) rebuild(merged);
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


function resumeChoice(lesson, place) {
  document.body.classList.remove('in-session');
  app.innerHTML = `
    <div class="page resume-page">
      <a class="back" href="#/">Magazine</a>
      <div class="kicker">Issue ${esc(lesson.number)} · ${esc(lesson.feature?.kicker || lesson.theme || '')}</div>
      <h1 class="title">${esc(lesson.feature?.title || lesson.title)}</h1>
      <p class="lead">You stopped at step ${place.i + 1} of ${place.total} on ${esc(new Date(place.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }))}. Pick up where you left off, or start the issue again.</p>
      <div class="actions"><button class="btn ghost" data-act="restart">Start over</button><button class="btn primary" data-act="resume">Continue</button></div>
    </div>`;
  app.querySelector('[data-act=resume]').addEventListener('click', () => startSession('lesson', lesson, { resume: place }));
  app.querySelector('[data-act=restart]').addEventListener('click', () => {
    localStorage.removeItem(`vw-resume-${lesson.id}`);
    startSession('lesson', lesson, { fresh: true });
  });
}

function startSession(kind, lesson, opts = {}) {
  if (kind === 'lesson' && !opts.resume && !opts.fresh && !(testMode && params.get('jump'))) {
    const place = savedPlace(lesson);
    if (place) return resumeChoice(lesson, place);
  }
  let steps;
  let words;
  let warmup = [];
  if (kind === 'lesson') {
    const review = (lesson.review || []).map((vi) => WORDS.get(nfc(vi))).filter((w) => w && !KNOWN.has(nfc(w.vi)));
    warmup = lesson.warmup || [];
    steps = lessonSteps(lesson, { review, warmup });
    words = [...lesson.words, ...review];
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
  }
  preload([
    ...(lesson?.situations || []).flatMap((x) => [x.vi, x.reply?.vi, x.replyMissed?.vi].filter(Boolean)),
    ...(lesson?.dialogues || []).flatMap((d) => [...d.lines.map((l) => l.vi), d.check.answer]),
    ...words.map((w) => w.vi),
    ...words.flatMap((w) => (w.contrast || []).map((c) => c.vi)),
    ...(lesson?.combos || []).map((c) => c.vi),
    ...(lesson?.grammar?.examples || []).map((x) => x.vi),
    ...warmup.map((w) => w.vi),
  ]);
  document.body.classList.add('in-session');
  endSession = runSession(
    app,
    {
      steps,
      words,
      lesson,
      testMode,
      saveKey: kind === 'lesson' ? lesson.id : null,
      relaxed: !store.settings().strictTones,
      talk: talkKey() ? (onScreen) => talk(onScreen) : null,
      resume: opts.resume || null,
      jumpTo: testMode ? params.get('jump') : null,
    },
    (out) => {
      const result = buildResult(kind, lesson, out);
      saveResult(result);
      showDone(result);
    },
    (out) => {
      endSession = null;
      if (out && kind === 'lesson' && out.events.some((e) => e.t !== 'known')) {
        const partial = buildResult(kind, lesson, out, true);
        store.addHistory(partial);
        queue(partial);
        flush();
        store.saveSettings({ ...store.settings(), notice: `Saved. You were on step ${out.progress.step + 1} of ${out.progress.steps}; continue any time.` });
      }
      location.hash = '#/';
    },
  );
}

function showDone(result) {
  endSession = null;
  document.body.classList.remove('in-session');
  history.replaceState(null, '', `${location.pathname}${location.search}#/`);
  const nd = nextDue(store.deck());
  app.innerHTML = `
    <div class="page done-page">
      <div class="kicker">Saved</div>
      <h1 class="title">${esc(result.lessonTitle)}</h1>
      <p class="lead">${Math.round(result.summary.firstTryAccuracy * 100)}% on the first try${result.quiz ? `, ${result.quiz.correct} of ${result.quiz.total} in the quiz` : ''}.</p>
      <p class="send-status" data-state="sending">Sending your results to the editors...</p>
      ${nd ? `<p class="hint">Your next review is ${esc(relative(nd))}.</p>` : ''}
      <div class="actions"><button class="btn primary" data-act="home">Back to the magazine</button></div>
    </div>`;
  app.querySelector('[data-act=home]').addEventListener('click', home);
  const status = app.querySelector('.send-status');
  flush().then((r) => {
    if (r.left === 0) {
      status.dataset.state = 'sent';
      status.textContent = 'Sent. The next issue will be written from these results.';
    } else {
      status.dataset.state = 'queued';
      status.innerHTML = `${esc(r.error || 'Not sent yet')}. Your results are saved on this device and will be sent later. <a href="#/settings">Settings</a>`;
    }
  });
}

function lessonState(i, p) {
  const lp = p.lessons[LESSONS[i].id];
  if (lp?.attempts) return 'done';
  if (i > 0 && !p.lessons[LESSONS[i - 1].id]?.attempts) return 'locked';
  return 'open';
}

function coverArt(lesson) {
  return lesson?.cover?.picture ? picture(lesson.cover.picture) : '';
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
  let currentIdx = states.indexOf('open');
  if (currentIdx < 0) currentIdx = LESSONS.length - 1;
  const current = LESSONS[currentIdx];
  const done = states.filter((s) => s === 'done').length;
  const f = current?.feature || {};
  const meta = current ? [`${current.words.length} new words`, current.quiz?.length ? `${current.quiz.length}-question quiz` : '', 'Rush hour'].filter(Boolean).join(' · ') : '';
  const place = savedPlace(current);
  const notice = store.settings().notice;
  if (notice) store.saveSettings({ ...store.settings(), notice: null });

  let reviewHTML;
  if (due.length) reviewHTML = `<div class="review-text"><div class="label">Review desk</div><p><b>${due.length} word${due.length === 1 ? '' : 's'}</b> due today, before they fade.</p></div><a class="btn primary small" href="#/review">Review</a>`;
  else if (nd) reviewHTML = `<div class="review-text"><div class="label">Review desk</div><p>All caught up. Next review ${esc(relative(nd))}.</p></div>`;
  else reviewHTML = '<div class="review-text"><div class="label">Review desk</div><p>Words you learn come back here at growing intervals, just before you would forget them.</p></div>';

  app.innerHTML = `
    <div class="page home">
      <header class="masthead">
        <div>
          <div class="masthead-title">Học tiếng Việt</div>
          <div class="masthead-sub">Northern Vietnamese, from Hà Nội · ${LESSONS.length} issue${LESSONS.length === 1 ? '' : 's'}</div>
        </div>
        <a class="icon-btn" href="#/settings" aria-label="Settings">${GEAR}</a>
      </header>
      ${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
      ${
        store.settings().seen !== APP_VERSION
          ? `<section class="news">
          <div class="label">New: ask a question out loud</div>
          <p>Stuck on a word or a price? Tap Ask a question at the top of any issue and ask out loud: an editor answers straight away, knowing which screen you are on. Notes for the editors go on the Ask page.</p>
          <div class="row"><a class="btn small" href="#/ask">Ask a question</a><button class="btn ghost small" data-act="seen">Got it</button></div>
        </section>`
          : ''
      }
      ${
        current
          ? `<a class="cover" href="#/lesson/${esc(current.id)}">
          <figure class="cover-art">${coverArt(current)}</figure>
          <div class="cover-text">
            <div class="kicker">${states[currentIdx] === 'done' ? 'Latest issue' : 'This issue'} · No. ${esc(current.number)} · ${esc(f.kicker || current.theme || '')}</div>
            <h2 class="cover-title">${esc(f.title || current.title)}</h2>
            ${f.dek ? `<p class="dek">${esc(f.dek)}</p>` : ''}
            <p class="cover-meta"><span class="vi">${colorize(current.vi)}</span> · ${esc(current.title)} · ${esc(meta)}</p>
            <span class="btn primary">${place ? `Continue · step ${place.i + 1} of ${place.total}` : states[currentIdx] === 'done' ? 'Read again' : 'Read and practise'}</span>
          </div>
        </a>`
          : ''
      }
      <a class="ask-link" href="#/ask"><svg class="mic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg><span class="ask-link-text"><b>Ask a question</b><span>Ask out loud and hear the answer straight away, or send the editors feedback.</span></span></a>
      <div class="stats home-stats">
        <div><b>${streak(p.days)}</b><span>day streak</span></div>
        <div><b>${learned}</b><span>words</span></div>
        <div><b>${done}</b><span>stamps</span></div>
      </div>
      <section class="review-card ${due.length ? 'is-due' : ''}">${reviewHTML}</section>
      ${outbox ? `<div class="outbox-note">${outbox} result${outbox === 1 ? '' : 's'} not sent yet. <a href="#/settings">Send</a></div>` : ''}
      <h2 class="section-title">Passport</h2>
      <div class="passport">
        ${LESSONS.map((l) => {
          const lp = p.lessons[l.id];
          return `<a class="passport-slot" href="#/lesson/${esc(l.id)}" aria-label="${esc(l.title)}">${stampHTML(l, lp?.attempts ? lp.grade || 'complete' : '', lp?.first ? shortDate(lp.first) : '')}</a>`;
        }).join('')}
        <div class="passport-slot future"><div class="stamp empty"><div class="stamp-inner"><div class="stamp-num">Next</div><div class="stamp-label">Written from your results</div></div></div></div>
      </div>
      <h2 class="section-title">All issues</h2>
      <div class="issues">
        ${LESSONS.map((l, i) => {
          const st = states[i];
          const lp = p.lessons[l.id];
          const status = { done: `Read · best ${Math.round((lp?.best || 0) * 100)}%`, open: 'New', locked: `After issue ${i}` }[st];
          const inner = `
            <figure class="issue-art">${coverArt(l)}</figure>
            <div class="issue-body">
              <div class="kicker">No. ${esc(l.number)} · ${esc(l.feature?.kicker || l.theme || '')}</div>
              <h3>${esc(l.feature?.title || l.title)}</h3>
              <p><span class="vi">${colorize(l.vi)}</span> · ${esc(status)}</p>
            </div>`;
          return st === 'locked' ? `<div class="issue status-locked">${inner}</div>` : `<a class="issue status-${st}" href="#/lesson/${esc(l.id)}">${inner}</a>`;
        }).join('')}
      </div>
      <div class="row links"><a class="text-link" href="#/words">Your words</a><a class="text-link" href="#/settings">Style and settings</a></div>
    </div>`;
}

document.addEventListener('click', (ev) => {
  if (ev.target.closest('[data-act=seen]')) {
    store.saveSettings({ ...store.settings(), seen: APP_VERSION });
    ev.target.closest('.news')?.remove();
  }
});

async function askPage() {
  app.innerHTML = `
    <div class="page ask-page">
      <a class="back" href="#/">Magazine</a>
      <h1 class="title">Ask a question</h1>
      <p class="lead">Ask out loud and hear the answer straight away: how to say something, the difference between two words, why it is like that.</p>
      ${talkKey() ? '<div class="row"><button type="button" class="btn primary talk-now" data-act="talk"><svg class="mic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>Ask a question</button></div>' : '<p class="hint">Add your Gemini key in <a href="#/settings">Settings</a>, under Ask a question, to start.</p>'}
      <h2 class="section-title">Feedback for the editors</h2>
      <p>What should change? A word that kept tripping you up, an issue that dragged, something you want to learn next, anything on the site. The editors read every note before they write the next issue.</p>
      <form class="ask-form page-feedback">
        <textarea name="q" rows="3" placeholder="The prices in issue 9 were fun; more like that, please." aria-label="Your feedback"></textarea>
        <div class="row"><button type="submit" class="btn">Send</button></div>
        <p class="form-status hint"></p>
      </form>
    </div>`;
  app.querySelector('.talk-now')?.addEventListener('click', () => talk('On the Ask page, where the learner can also send written feedback to the editors.'));
  app.querySelector('.page-feedback').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = ev.target.q.value.trim();
    if (!text) return;
    queueFeedback(text, 'the Ask page');
    ev.target.q.value = '';
    const r = await flush();
    app.querySelector('.form-status').textContent = r.left ? `Saved; it will be sent when ${r.error === 'No GitHub token set' ? 'a token is set in Settings' : 'you are online'}.` : 'Sent. Thank you.';
  });
}

function wordsPage() {
  const deck = store.deck();
  const row = (w, extra) =>
    `<button class="word-row" data-say="${esc(w.vi)}">${w.picture ? `<span class="pic-wrap tiny">${picture(w.picture)}</span>` : '<span class="pic-wrap tiny"></span>'}<span class="vi">${colorize(w.vi)}</span><span class="en">${esc(w.en)}</span>${extra}${w.fact ? `<small class="word-fact">${esc(w.fact)}</small>` : ''}</button>`;
  const sections = LESSONS.map((l) => {
    const items = [...l.words, ...(l.warmup || [])].filter((w) => deck[nfc(w.vi)] && !KNOWN.has(nfc(w.vi)));
    if (!items.length) return '';
    return `<h2 class="section-title">No. ${esc(l.number)} · ${esc(l.title)}</h2><div class="word-list">${items
      .map((w) => {
        const c = deck[nfc(w.vi)];
        const level = Math.round((c.box / (INTERVAL_DAYS.length - 1)) * 100);
        return row(w, `<span class="meter" aria-label="Strength ${c.box} of ${INTERVAL_DAYS.length - 1}"><span class="meter-fill" data-level="${level}"></span></span><small>${c.due <= Date.now() ? 'due now' : esc(relative(c.due))}</small>`);
      })
      .join('')}</div>`;
  }).join('');
  const known = [...KNOWN].map((vi) => WORDS.get(vi) || { vi, en: '' });
  app.innerHTML = `<div class="page"><a class="back" href="#/">Magazine</a><h1 class="title">Your words</h1><p class="lead">Tap a word to hear it. The bar grows each time you remember it in a review.</p>${sections || '<p class="hint">Finish an issue to start your review deck.</p>'}${
    known.length ? `<h2 class="section-title">Words you already know</h2><p class="hint">These are never reviewed or taught again.</p><div class="word-list">${known.map((w) => row(w, '<small>known</small>')).join('')}</div>` : ''
  }</div>`;
  app.querySelectorAll('.meter-fill').forEach((el) => {
    el.style.width = `${Math.max(8, Number(el.dataset.level))}%`;
  });
}

function stylePreview(s) {
  return `<button type="button" class="style-card ${currentStyle() === s.id ? 'on' : ''}" data-style="${s.id}" data-pick="${s.id}">
    <div class="style-sample">
      <div class="kicker">No. 2 · Money</div>
      <div class="style-head">Copper, paper, plastic</div>
      <div class="vi style-word">${colorize('Tiền và số')}</div>
      <div class="style-btn">Read</div>
    </div>
    <div class="style-name"><b>${esc(s.name)}</b> <span class="vi">${colorize(s.vi)}</span><small>${esc(s.note)}</small></div>
  </button>`;
}

async function drawNotify(message = '') {
  const el = app.querySelector('.notify-body');
  if (!el) return;
  const support = pushSupport();
  if (support === 'homescreen') {
    el.innerHTML = '<p>On iPhone and iPad, notifications come through the Home Screen app. In Safari, tap Share, then <b>Add to Home Screen</b>. Open <b>Tiếng Việt</b> from your Home Screen and turn notifications on here. The Home Screen app keeps its own settings, so paste your GitHub token there too.</p>';
    return;
  }
  if (support !== 'ok') {
    el.innerHTML = '<p class="hint">This browser cannot show notifications from the site.</p>';
    return;
  }
  loadPushKeys().catch(() => {});
  const sub = await currentSubscription().catch(() => null);
  const denied = Notification.permission === 'denied';
  el.innerHTML = sub
    ? `<p>On for this device.</p><div class="row"><button class="btn ghost small" type="button" data-act="notify-off">Turn off</button></div><p class="notify-status hint">${esc(message)}</p>`
    : `<div class="row"><button class="btn primary small" type="button" data-act="notify-on"${denied ? ' disabled' : ''}>Notify me</button></div><p class="notify-status hint">${esc(message || (denied ? 'Notifications are blocked. Allow them for this site or app in Settings, under Notifications.' : ''))}</p>`;
}

// What the learner has met and finds hard, for a live conversation with the editors.
function learnerContext() {
  const deck = store.deck();
  const met = Object.keys(deck).map((vi) => WORDS.get(vi)).filter(Boolean);
  const weak = Object.entries(deck).filter(([, c]) => (c.box ?? 0) <= 1).map(([vi]) => vi);
  const played = LESSONS.filter((l) => store.progress().lessons?.[l.id]).map((l) => `${l.number} ${l.title}`);
  return [
    `Issues played: ${played.join('; ') || 'none yet'}.`,
    `Words the learner has met: ${met.map((w) => `${w.vi} (${w.en})`).join(', ') || 'none yet'}.`,
    `Words they already knew: ${[...KNOWN].join(', ')}.`,
    `Words still weak: ${weak.join(', ') || 'none'}.`,
  ].join('\n');
}

function talk(onScreen) {
  setTalkContext(() => `${onScreen}\n${learnerContext()}`);
  openTalk();
}

function settingsPage() {
  const s = store.settings();
  const outbox = store.outbox().length;
  const previewing = params.get('style');
  app.innerHTML = `
    <div class="page settings">
      <a class="back" href="#/">Magazine</a>
      <h1 class="title">Settings</h1>
      <section class="panel">
        <h2>Style</h2>
        <p>Each style is named after a Vietnamese material.${previewing ? ' You are previewing a style from the address bar.' : ''}</p>
        <div class="style-grid">${STYLES.map(stylePreview).join('')}</div>
      </section>
      <section class="panel">
        <h2>Tone marks when typing</h2>
        <p>Relaxed counts a typed word as right when the letters are right, and shows you the marks. Strict also wants every tone and vowel mark.</p>
        <div class="seg" data-name="tones">
          <button type="button" class="seg-btn ${s.strictTones ? '' : 'on'}" data-tones="relaxed">Relaxed</button>
          <button type="button" class="seg-btn ${s.strictTones ? 'on' : ''}" data-tones="strict">Strict</button>
        </div>
      </section>
      <section class="panel">
        <h2>Sync between devices</h2>
        <p>Your progress comes from the results every device has sent to GitHub, so your iPhone, iPad and Mac show the same issues, stamps and reviews. It syncs when the app opens and when you come back to it. Each device needs the token below to send its own results.</p>
        <p class="sync-status hint">${s.syncedAt ? `Last synced ${esc(new Date(s.syncedAt).toLocaleString())}.` : 'Not synced yet.'} ${store.history().length} session${store.history().length === 1 ? '' : 's'} on this device.</p>
        <button class="btn small" data-act="sync">Sync now</button>
      </section>
      <section class="panel">
        <h2>Send results to the editors</h2>
        <p>After each session your results are sent to <b>${esc(REPO)}</b> as a GitHub issue, and the next issue is written from them. This needs a GitHub token on each device, because the Home Screen app keeps its own storage.</p>
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
      <section class="panel talk-panel">
        <h2>Ask a question</h2>
        <p>Ask out loud during an issue (the Ask button at the top) or on the Ask page, and hear the answer straight away. It uses Google's Gemini Live with your own key, kept on this device only. The editors read each conversation's transcript to improve the issues.</p>
        <form class="gemini-form">
          <input name="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gemini API key" value="${esc(s.geminiKey || '')}" aria-label="Gemini API key">
          <div class="row"><button class="btn primary small" type="submit">Save and test</button>${s.geminiKey ? '<button class="btn ghost small" type="button" data-act="forget-gemini">Remove</button>' : ''}</div>
          <p class="gemini-status form-status">${s.geminiModel ? `Using ${esc(s.geminiModel)}.` : ''}</p>
        </form>
      </section>
      <section class="panel notify-panel">
        <h2>Notifications</h2>
        <p>Get a notification on this device when a new issue is ready, when one of your questions has an answer, and once a day when words are due for review.</p>
        <div class="notify-body"><p class="hint">Checking...</p></div>
      </section>
      <section class="panel">
        <h2>Start over</h2>
        <p>Deletes progress, reviews and saved results on this device. Results already sent stay in GitHub and come back on the next sync.</p>
        <button class="btn danger small" data-act="reset">Reset this device</button>
      </section>
      <p class="hint">Version ${APP_VERSION}</p>
    </div>`;
  drawNotify();
  app.querySelector('.gemini-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const key = ev.target.key.value.trim();
    const note = app.querySelector('.gemini-status');
    const { geminiModel, ...rest } = store.settings();
    store.saveSettings({ ...rest, geminiKey: key });
    if (!key) return settingsPage();
    note.textContent = 'Testing...';
    try {
      const model = await findModel(key);
      store.saveSettings({ ...store.settings(), geminiModel: model });
      note.textContent = `Saved. The key works (${model}).`;
    } catch (err) {
      note.textContent = `Saved, but the test failed: ${err.message}.`;
    }
  });
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
    const tones = ev.target.closest('[data-tones]');
    if (tones) {
      store.saveSettings({ ...store.settings(), strictTones: tones.dataset.tones === 'strict' });
      app.querySelectorAll('[data-tones]').forEach((b) => b.classList.toggle('on', b === tones));
      return;
    }
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
    if (act === 'notify-on') {
      const note = app.querySelector('.notify-status');
      note.textContent = 'Asking...';
      try {
        const r = await enablePush(device());
        if (!r.ok) {
          note.textContent = r.reason === 'denied' ? 'Notifications are blocked. Allow them for Tiếng Việt in the Settings app, under Notifications.' : 'Not turned on.';
          return;
        }
        const sent = await flush();
        await drawNotify(sent.left ? (store.settings().token ? 'On. The request will be sent when you are online.' : 'On. Add your GitHub token below so the request can reach the editors.') : 'On. A welcome notification arrives after the editors\' next round, a few times a day.');
      } catch (err) {
        note.textContent = `Could not turn on notifications: ${err.message}`;
      }
      return;
    }
    if (act === 'notify-off') {
      await disablePush();
      await drawNotify('Off for this device.');
      return;
    }
    if (act === 'sync') {
      const el = app.querySelector('.sync-status');
      el.textContent = 'Syncing...';
      const r = await syncNow();
      el.textContent = r.error
        ? `Could not sync: ${r.error}.`
        : `Synced. ${r.total} session${r.total === 1 ? '' : 's'} in total${r.added ? `, ${r.added} new from other devices` : ''}.`;
      return;
    }
    if (act === 'forget-gemini') {
      const { geminiKey, geminiModel, ...rest } = store.settings();
      store.saveSettings(rest);
      settingsPage();
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
      if (confirm('Delete all progress on this device? Results already sent come back on the next sync.')) {
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
  if (route === 'ask') return askPage();
  if (route === 'settings') return settingsPage();
  return home();
}

document.addEventListener('click', (ev) => {
  const say = ev.target.closest('[data-say]');
  if (say && !document.body.classList.contains('in-session')) play(say.dataset.say);
});

async function boot() {
  applyStyle();
  // A one-time setup link (#/settings?gemini=KEY) saves the Gemini key on this device and removes it from the address.
  const setup = (location.hash.match(/[?&]gemini=([^&]+)/) || [])[1];
  if (setup) {
    store.saveSettings({ ...store.settings(), geminiKey: decodeURIComponent(setup) });
    history.replaceState(null, '', `${location.pathname}${location.search}#/settings`);
  }
  await Promise.all([loadLessons(), loadAudio()]);
  window.addEventListener('hashchange', render);
  render();
  if (store.outbox().length) flush().then(() => syncAndRefresh());
  else syncAndRefresh();
  const loadedAt = Date.now();
  // While the app is on screen, pick up results from other devices every few minutes.
  setInterval(() => {
    if (document.visibilityState === 'visible' && !document.body.classList.contains('in-session') && !testMode) syncAndRefresh();
  }, 5 * 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // A tab left open for hours reloads on return, so it picks up new issues and site updates.
    if (Date.now() - loadedAt > 6 * 3600000 && !document.body.classList.contains('in-session') && !testMode) {
      location.reload();
      return;
    }
    const last = Date.parse(store.settings().syncedAt || 0) || 0;
    if (Date.now() - last > 30000) syncAndRefresh();
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !testMode) {
    // When a new version of the site takes over an open page, reload once so every file comes from that version.
    const hadWorker = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadWorker || reloaded || document.body.classList.contains('in-session')) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (ev.data?.type === 'open' && ev.data.url) {
        const target = new URL(ev.data.url, location.href);
        if (target.hash && target.hash !== location.hash) location.hash = target.hash;
        syncAndRefresh();
      }
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot().catch((err) => {
  app.innerHTML = `<div class="page"><h1 class="title">Could not load</h1><p class="lead">${esc(err.message)}</p></div>`;
});

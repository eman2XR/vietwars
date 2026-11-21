// App entry: loads lessons, routes between screens and saves each finished session.

import { colorize, escapeHTML as esc, nfc } from './vi.js';
import { loadAudio, play, preload } from './audio.js';
import { store, localDay, streak } from './store.js';
import { schedule, outcomeFor, dueWords, nextDue, INTERVAL_DAYS } from './srs.js';
import { lessonSteps, reviewSteps, runSession } from './lesson.js';
import { queue, flush, testToken, REPO } from './sync.js';

const APP_VERSION = '1';
const REVIEW_LIMIT = 20;
const app = document.getElementById('app');
const testMode = new URLSearchParams(location.search).has('test');
let LESSONS = [];
const WORDS = new Map();
let endSession = null;

const GEAR =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>';

async function loadLessons() {
  const index = await (await fetch('lessons/index.json')).json();
  LESSONS = await Promise.all(index.lessons.map(async (l) => (await fetch(`lessons/${l.file}`)).json()));
  for (const lesson of LESSONS) {
    for (const w of lesson.words) {
      const key = nfc(w.vi);
      if (!WORDS.has(key)) WORDS.set(key, { ...w, lessonId: lesson.id });
    }
  }
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

function buildResult(kind, lesson, out) {
  const ev = out.events;
  return {
    schema: 1,
    resultId: uuid(),
    kind,
    lessonId: lesson ? lesson.id : 'review',
    lessonTitle: lesson ? lesson.title : 'Review',
    appVersion: APP_VERSION,
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
    words: out.summary.perWord.map((w) => ({ ...w, known: out.known.includes(w.vi) })),
    toneConfusions: ev.filter((e) => e.t === 'spell' && !e.ok).map((e) => ({ target: e.w, chose: e.a })),
    meaningConfusions: ev.filter((e) => (e.t === 'listen' || e.t === 'speed') && !e.ok).map((e) => ({ target: e.w, chose: e.a, t: e.t })),
    typed: ev.filter((e) => e.t === 'type').map((e) => ({ target: e.w, answer: e.a, grade: e.g, hints: e.hints, retry: e.retry })),
    feedback: out.feedback,
    events: ev.map(({ t, w, ok, g, a, ms, retry }) => ({ t, w, ok, g, a, ms, retry: retry || undefined })),
  };
}

function saveResult(result) {
  const now = Date.now();
  const p = store.progress();
  p.xp += result.summary.xp;
  const today = localDay(now);
  if (!p.days.includes(today)) p.days.push(today);
  p.days = p.days.slice(-400);
  p.speedBest = Math.max(p.speedBest || 0, result.summary.speedScore || 0);
  if (result.kind === 'lesson') {
    const l = p.lessons[result.lessonId] || { attempts: 0, best: 0 };
    l.attempts += 1;
    l.best = Math.max(l.best, result.summary.firstTryAccuracy);
    l.last = result.finishedAt;
    p.lessons[result.lessonId] = l;
  }
  const deck = store.deck();
  for (const w of result.words) {
    const s = p.words[w.vi] || { seen: 0, credit: 0 };
    s.seen += 1;
    s.credit = Math.round((s.credit + w.share) * 100) / 100;
    s.last = result.finishedAt;
    p.words[w.vi] = s;
    const card = deck[w.vi] || { lesson: WORDS.get(w.vi)?.lessonId };
    const outcome = result.kind === 'review' ? (w.share >= 1 ? 'good' : 'again') : outcomeFor(w.share);
    deck[w.vi] = schedule(card, outcome, now);
  }
  store.saveProgress(p);
  store.saveDeck(deck);
  store.addHistory(result);
  queue(result);
}

function startSession(kind, lesson) {
  let steps;
  let words;
  if (kind === 'lesson') {
    const review = (lesson.review || []).map((vi) => WORDS.get(nfc(vi))).filter(Boolean);
    steps = lessonSteps(lesson, review);
    words = [...lesson.words, ...review];
  } else {
    const due = dueWords(store.deck()).slice(0, REVIEW_LIMIT).map((vi) => WORDS.get(vi)).filter(Boolean);
    if (!due.length) {
      location.hash = '#/';
      return;
    }
    steps = reviewSteps(due, [...WORDS.values()]);
    words = due;
  }
  preload([
    ...words.map((w) => w.vi),
    ...words.flatMap((w) => (w.contrast || []).map((c) => c.vi)),
    ...(lesson?.combos || []).map((c) => c.vi),
    ...(lesson?.grammar?.examples || []).map((x) => x.vi),
  ]);
  document.body.classList.add('in-session');
  endSession = runSession(
    app,
    { steps, words, lesson, testMode },
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
  history.replaceState(null, '', '#/');
  const deck = store.deck();
  const nd = nextDue(deck);
  app.innerHTML = `
    <div class="page done-page">
      <h1 class="title">Saved</h1>
      <p class="lead">${esc(result.lessonTitle)}: ${Math.round(result.summary.firstTryAccuracy * 100)}% on the first try, ${result.summary.xp} XP.</p>
      <p class="send-status" data-state="sending">Sending your results to the lesson planner...</p>
      ${nd ? `<p class="hint">Your next review is ${esc(relative(nd))}. Reviews space each word out a little more every time you remember it.</p>` : ''}
      <div class="actions"><button class="btn primary" data-act="home">Back to lessons</button></div>
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

function home() {
  const p = store.progress();
  const deck = store.deck();
  const due = dueWords(deck).filter((vi) => WORDS.has(vi));
  const nd = nextDue(deck);
  const outbox = store.outbox().length;
  const deckSize = Object.keys(deck).length;
  let reviewHTML;
  if (due.length) {
    reviewHTML = `<div><h2>Review</h2><p>${due.length} word${due.length === 1 ? '' : 's'} ready to bring back from memory.</p></div><a class="btn primary" href="#/review">Start review</a>`;
  } else if (deckSize) {
    reviewHTML = `<div><h2>Review</h2><p>All caught up. Next review ${esc(relative(nd))}.</p></div>`;
  } else {
    reviewHTML = `<div><h2>Review</h2><p>Words you learn come back here at growing intervals, just before you would forget them.</p></div>`;
  }
  app.innerHTML = `
    <div class="page home">
      <header class="home-head">
        <div><h1>Học tiếng Việt</h1><p class="sub">Northern Vietnamese, as spoken in Hà Nội</p></div>
        <a class="icon-btn" href="#/settings" aria-label="Settings">${GEAR}</a>
      </header>
      <div class="stats home-stats">
        <div><b>${streak(p.days)}</b><span>day streak</span></div>
        <div><b>${deckSize}</b><span>words</span></div>
        <div><b>${p.xp}</b><span>XP</span></div>
      </div>
      <section class="review-card ${due.length ? 'is-due' : ''}">${reviewHTML}</section>
      ${outbox ? `<div class="outbox-note">${outbox} result${outbox === 1 ? '' : 's'} not sent yet. <a href="#/settings">Send</a></div>` : ''}
      <h2 class="section-title">Lessons</h2>
      <div class="lesson-grid">
        ${LESSONS.map((l) => {
          const lp = p.lessons[l.id];
          return `<a class="lesson-card" href="#/lesson/${esc(l.id)}">
            <div class="lesson-num">${esc(l.number)}</div>
            <div class="lesson-body">
              <h3>${esc(l.title)}</h3>
              <div class="vi lesson-vi">${colorize(l.vi)}</div>
              <p>${l.words.length} words${lp ? `, best ${Math.round(lp.best * 100)}%` : ''}</p>
            </div>
            <span class="btn ${lp ? 'ghost' : 'primary'} small">${lp ? 'Practise again' : 'Start'}</span>
          </a>`;
        }).join('')}
      </div>
      ${deckSize ? '<a class="text-link" href="#/words">Your words</a>' : ''}
    </div>`;
}

function wordsPage() {
  const deck = store.deck();
  const rows = LESSONS.map((l) => {
    const items = l.words.filter((w) => deck[nfc(w.vi)]);
    if (!items.length) return '';
    return `<h2 class="section-title">${esc(l.title)}</h2><div class="word-list">${items
      .map((w) => {
        const c = deck[nfc(w.vi)];
        const level = Math.round((c.box / (INTERVAL_DAYS.length - 1)) * 100);
        return `<button class="word-row" data-say="${esc(w.vi)}"><span class="vi">${colorize(w.vi)}</span><span class="en">${esc(w.en)}</span><span class="meter" aria-label="Strength ${c.box} of ${INTERVAL_DAYS.length - 1}"><span class="meter-fill" data-level="${level}"></span></span><small>${c.due <= Date.now() ? 'due now' : esc(relative(c.due))}</small></button>`;
      })
      .join('')}</div>`;
  }).join('');
  app.innerHTML = `<div class="page"><a class="back" href="#/">Lessons</a><h1 class="title">Your words</h1><p class="lead">Tap a word to hear it. The bar grows each time you remember it in a review.</p>${rows}</div>`;
  app.querySelectorAll('.meter-fill').forEach((el) => {
    el.style.width = `${Math.max(8, Number(el.dataset.level))}%`;
  });
}

function settingsPage() {
  const s = store.settings();
  const outbox = store.outbox().length;
  app.innerHTML = `
    <div class="page settings">
      <a class="back" href="#/">Lessons</a>
      <h1 class="title">Settings</h1>
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
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
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
  await Promise.all([loadLessons(), loadAudio()]);
  window.addEventListener('hashchange', render);
  render();
  if (store.outbox().length) flush();
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !testMode) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot().catch((err) => {
  app.innerHTML = `<div class="page"><h1 class="title">Could not load</h1><p class="lead">${esc(err.message)}</p></div>`;
});

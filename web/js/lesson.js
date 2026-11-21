// Runs a lesson or review session as a battle: builds the exercise sequence, renders each step and records every answer.

import { colorize, contourSVG, tonesOf, TONES, grade, escapeHTML as esc, nfc, applyKey } from './vi.js';
import { play, stop } from './audio.js';
import { sprite, HEART } from './sprites.js';
import { picture } from './pictures.js';

const SPEAKER =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zm-2.5-8.8v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const BOUNDARIES = new Set(['stage', 'grammar', 'speedIntro', 'results', 'feedback']);
const SCORED = new Set(['listen', 'spell', 'reverse', 'type']);
const DRILLS = new Set(['listen', 'spell', 'reverse']);
const TYPE_CREDIT = { perfect: 1, tone: 0.5, marks: 0.5, sound: 0.5 };
const SPEED_SECONDS = 45;
const AMBUSH_SECONDS = 7;
const MAX_HEARTS = 5;
const TONE_KEYS = ['ngang', 'huyen', 'sac', 'hoi', 'nga', 'nang'];
const VOWEL_KEYS = ['ă', 'â', 'ê', 'ô', 'ơ', 'ư', 'đ'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function choices(target, pool, key, n = 4) {
  const seen = new Set([target[key]]);
  const rest = [];
  for (const item of shuffle(pool)) {
    if (!seen.has(item[key])) {
      seen.add(item[key]);
      rest.push(item);
    }
  }
  return shuffle([target, ...rest.slice(0, n - 1)]);
}

function sayButton(vi, label = 'Play', extra = '') {
  return `<button type="button" class="say ${extra}" data-say="${esc(vi)}" aria-label="${esc(label)}">${SPEAKER}<span>${esc(label)}</span></button>`;
}

function toneBadges(vi) {
  return `<div class="tone-badges">${tonesOf(vi)
    .map((t) => `<span class="tone-badge t-${t}">${contourSVG(t)}<span>${esc(TONES[t].name)}</span></span>`)
    .join('')}</div>`;
}

function pic(w, size = '') {
  const p = w && w.picture ? picture(w.picture) : '';
  return p ? `<div class="pic-wrap ${size}">${p}</div>` : '';
}

function line(l) {
  if (!l) return '';
  return `<div class="foe-line"><span class="vi">${colorize(l.vi)}</span>${sayButton(l.vi, 'Play', 'mini')}<small>${esc(l.en)}</small></div>`;
}

export function lessonSteps(lesson, { review = [], warmup = [] } = {}) {
  const words = lesson.words;
  const all = [...words, ...review];
  const steps = [{ type: 'intro' }];
  if (warmup.length) {
    steps.push({ type: 'stage', title: 'Warm-up', text: `${warmup.length} words you probably know. Tap the meaning; any you miss go into your reviews.` });
    shuffle(warmup).forEach((w) => steps.push({ type: 'listen', word: w, pool: warmup, warmup: true }));
  }
  chunk(words, 4).forEach((group, gi) => {
    group.forEach((w, wi) => steps.push({ type: 'meet', word: w, n: gi * 4 + wi + 1, of: words.length }));
    shuffle(group)
      .slice(0, Math.min(2, group.length))
      .forEach((w) => steps.push({ type: 'listen', word: w, pool: group.length >= 3 ? group : words }));
  });
  steps.push({ type: 'stage', title: 'Listen', text: 'Hear each word and tap what it means. Words you miss come back a little later.' });
  shuffle(all).forEach((w) => steps.push({ type: 'listen', word: w, pool: all }));
  steps.push({ type: 'stage', title: 'Tones and spelling', text: 'Pick the spelling you hear, or the Vietnamese for a picture. Watch the tone marks.' });
  shuffle(words).forEach((w) => steps.push(w.contrast?.length ? { type: 'spell', word: w } : { type: 'reverse', word: w, pool: words }));
  steps.push({ type: 'stage', title: 'From memory', text: 'Type the Vietnamese. Use the tone and vowel keys under the box for the marks.' });
  shuffle(all).forEach((w) => steps.push({ type: 'type', word: w }));
  if (lesson.grammar) steps.push({ type: 'grammar', grammar: lesson.grammar });
  if (lesson.combos?.length) {
    shuffle(lesson.combos).forEach((c) => steps.push({ type: 'listen', word: c, pool: lesson.combos, combo: true }));
  }
  steps.push({ type: 'speedIntro' }, { type: 'speed', pool: [...all, ...(lesson.combos || []), ...warmup] });
  steps.push({ type: 'results' }, { type: 'feedback' });
  return steps;
}

export function reviewSteps(words, pool) {
  const steps = [{ type: 'intro' }];
  shuffle(words).forEach((w) => steps.push({ type: 'listen', word: w, pool }));
  steps.push({ type: 'stage', title: 'From memory', text: 'Type each word: from its meaning, or from hearing it.' });
  shuffle(words).forEach((w, i) => steps.push({ type: 'type', word: w, dictation: i % 2 === 1 }));
  steps.push({ type: 'results' }, { type: 'feedback' });
  return steps;
}

function credit(e) {
  return e.t === 'type' ? TYPE_CREDIT[e.g] || 0 : e.ok ? 1 : 0;
}

function mean(xs) {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null;
}

// Summarises the recorded events into per-word results and totals. Warm-up, ambush and retry answers are not first tries.
export function summarise(events, words) {
  const firsts = events.filter((e) => SCORED.has(e.t) && !e.retry && !e.ambush && !e.warmup);
  const perWord = words.map((w) => {
    const mine = firsts.filter((e) => e.w === w.vi);
    const share = mine.length ? mine.reduce((s, e) => s + credit(e), 0) / mine.length : 0;
    const firstTry = {};
    for (const e of mine) firstTry[e.t] = e.t === 'type' ? e.g : e.ok;
    const times = events.filter((e) => e.w === w.vi && e.ms && SCORED.has(e.t)).map((e) => e.ms).sort((a, b) => a - b);
    return {
      vi: w.vi,
      en: w.en,
      share: Math.round(share * 100) / 100,
      meaning: mean(mine.filter((e) => e.t === 'listen' || e.t === 'reverse').map(credit)),
      form: mean(mine.filter((e) => e.t === 'spell' || e.t === 'type').map(credit)),
      stars: share >= 0.99 ? 3 : share >= 0.67 ? 2 : share >= 0.34 ? 1 : 0,
      firstTry,
      attempts: events.filter((e) => e.w === w.vi && SCORED.has(e.t)).length,
      msMedian: times.length ? times[Math.floor(times.length / 2)] : null,
    };
  });
  const total = firsts.reduce((s, e) => s + credit(e), 0);
  return { perWord, firstTryAccuracy: firsts.length ? Math.round((total / firsts.length) * 100) / 100 : 0, exercises: firsts.length };
}

export function runSession(root, session, onDone, onQuit) {
  const game = session.game || { callouts: {} };
  const foe = session.foe || game.reviewFoe || { name: 'Bóng', en: 'the Shadow', art: 'shadow', taunts: [] };
  const S = {
    steps: session.steps,
    i: 0,
    events: [],
    started: Date.now(),
    known: new Set(),
    xp: 0,
    speed: { answered: 0, correct: 0, score: 0, combo: 0, bestCombo: 0 },
    stepStart: Date.now(),
    answered: false,
    timer: null,
    lastEvent: -10,
    seen: {},
  };
  const B = { hearts: MAX_HEARTS, hp: 100, streak: 0, crits: 0, heartsLost: 0, knockouts: 0, ambushWon: 0, ambushLost: 0, powerups: 0, won: null };
  const words = session.words;
  const scoredWords = session.scoredWords || words;
  const boss = session.boss !== false;
  const scoredCount = Math.max(8, S.steps.filter((s) => SCORED.has(s.type)).length);
  const HIT = (boss ? 72 : 100) / scoredCount;
  const hearts = Array.from({ length: MAX_HEARTS }, () => `<span class="heart on">${HEART}</span>`).join('');

  root.innerHTML = `
    <div class="session">
      <header class="session-bar">
        <button class="icon-btn" data-act="quit" aria-label="Leave">&times;</button>
        <div class="progress" role="progressbar" aria-label="Progress"><div class="fill"></div></div>
        <div class="xp-pill"><span class="xp-num">0</span> XP</div>
      </header>
      <div class="battle-bar">
        <div class="foe-mini">${sprite(foe.art)}</div>
        <div class="foe-meter">
          <div class="foe-name"><span class="vi">${colorize(foe.name)}</span><span class="foe-hp-num">100%</span></div>
          <div class="hp"><div class="hp-fill"></div></div>
        </div>
        <div class="hearts" aria-label="Hearts">${hearts}</div>
      </div>
      <main class="stage" aria-live="polite"></main>
      <div class="callout" aria-hidden="true"></div>
      <div class="toast" role="status"></div>
    </div>`;
  const sessionEl = root.querySelector('.session');
  const stage = root.querySelector('.stage');
  const fill = root.querySelector('.fill');
  const xpNum = root.querySelector('.xp-num');
  const hpFill = root.querySelector('.hp-fill');
  const hpNum = root.querySelector('.foe-hp-num');
  const foeMini = root.querySelector('.foe-mini');
  const heartEls = [...root.querySelectorAll('.heart')];
  const calloutEl = root.querySelector('.callout');
  const toastEl = root.querySelector('.toast');
  let calloutTimer;
  let toastTimer;

  function updateBattle() {
    hpFill.style.width = `${Math.max(0, B.hp)}%`;
    hpFill.classList.toggle('low', B.hp < 30);
    hpNum.textContent = `${Math.max(0, Math.round(B.hp))}%`;
    heartEls.forEach((h, i) => h.classList.toggle('on', i < B.hearts));
  }

  function callout(key, extra = '') {
    const c = game.callouts?.[key];
    if (!c) return;
    S.seen[key] = (S.seen[key] || 0) + 1;
    calloutEl.innerHTML = `<b class="vi">${colorize(c.vi)}</b>${extra ? `<span class="dmg">${esc(extra)}</span>` : ''}${S.seen[key] <= 2 ? `<small>${esc(c.en)}</small>` : ''}`;
    calloutEl.className = `callout show c-${key}`;
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => (calloutEl.className = 'callout'), 1100);
  }

  function toast(html) {
    toastEl.innerHTML = html;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  function shakeFoe() {
    foeMini.classList.remove('hit');
    void foeMini.offsetWidth;
    foeMini.classList.add('hit');
  }

  function damage(kind) {
    const mult = { hit: 1, crit: 1.8, half: 0.5, ambush: 2.5 }[kind] || 1;
    const d = HIT * mult;
    B.hp = Math.max(0, B.hp - d);
    if (kind === 'crit') B.crits += 1;
    shakeFoe();
    updateBattle();
    return Math.max(1, Math.round(d));
  }

  function strike(step) {
    B.streak += 1;
    const kind = step.ambush ? 'ambush' : B.streak % 3 === 0 ? 'crit' : 'hit';
    const d = damage(kind);
    callout(kind === 'crit' ? 'crit' : 'hit', `-${d}`);
  }

  function hurt() {
    B.streak = 0;
    B.hearts -= 1;
    B.heartsLost += 1;
    sessionEl.classList.remove('hurt');
    void sessionEl.offsetWidth;
    sessionEl.classList.add('hurt');
    if (B.hearts <= 0) {
      B.knockouts += 1;
      B.hearts = MAX_HEARTS;
      B.hp = Math.min(100, B.hp + 12);
      callout('knockout');
    } else callout('ouch');
    updateBattle();
  }

  function addXP(n) {
    S.xp += n;
    xpNum.textContent = S.xp;
    if (n > 0) {
      root.querySelectorAll('.xp-pop').forEach((el) => el.remove());
      const pop = document.createElement('div');
      pop.className = 'xp-pop';
      pop.textContent = `+${n}`;
      root.querySelector('.session-bar').appendChild(pop);
      setTimeout(() => pop.remove(), 900);
    }
  }

  function record(e) {
    S.events.push({ ...e, ms: Date.now() - S.stepStart, at: Date.now() - S.started });
  }

  function insertRetry(step) {
    if (step.retry || step.warmup || step.ambush) return;
    let end = S.i + 1;
    while (end < S.steps.length && !BOUNDARIES.has(S.steps[end].type)) end++;
    const at = Math.min(S.i + 4, end);
    S.steps.splice(at, 0, { ...step, retry: true });
  }

  // After a correct answer, sometimes a surprise: a power-up that restores a heart, or an ambush question.
  function maybeEvent(step) {
    if (step.warmup || step.retry || step.ambush || step.combo) return;
    if (S.i - S.lastEvent < 5 || S.steps.length - S.i < 8) return;
    if (Math.random() >= (session.testMode ? 0.4 : 0.12)) return;
    S.lastEvent = S.i;
    const foods = session.powerups || [];
    if (foods.length && Math.random() < 0.5) {
      const f = pick(foods);
      B.powerups += 1;
      B.hearts = Math.min(MAX_HEARTS, B.hearts + 1);
      updateBattle();
      const c = game.callouts?.found || { vi: 'Tìm thấy', en: 'Found' };
      toast(`${pic(f, 'tiny')}<div><b class="vi">${colorize(c.vi)} ${colorize(f.vi)}!</b><small>${esc(c.en)}: ${esc(f.en)}. +1 heart</small></div>${sayButton(f.vi, 'Play', 'mini')}`);
      S.events.push({ t: 'powerup', w: f.vi, at: Date.now() - S.started });
    } else {
      const pool = words.filter((w) => !S.known.has(w.vi));
      if (!pool.length) return;
      S.steps.splice(S.i + 1, 0, { type: 'listen', word: pick(pool), pool: words, ambush: true });
    }
  }

  function next() {
    clearInterval(S.timer);
    S.i += 1;
    render();
  }

  function cleanup() {
    clearInterval(S.timer);
    clearTimeout(calloutTimer);
    clearTimeout(toastTimer);
    document.removeEventListener('keydown', onKey);
    stop();
  }

  function rank(sum) {
    const acc = sum.firstTryAccuracy;
    if (B.won && acc >= 0.9 && B.knockouts === 0) return 'S';
    if (B.won) return 'A';
    if (acc >= 0.7) return 'B';
    return 'C';
  }

  function finish(feedback) {
    cleanup();
    const sum = summarise(S.events, scoredWords);
    onDone({
      events: S.events,
      startedAt: new Date(S.started).toISOString(),
      finishedAt: new Date().toISOString(),
      durationSec: Math.round((Date.now() - S.started) / 1000),
      xp: S.xp,
      known: [...S.known],
      speed: S.speed,
      summary: sum,
      battle: {
        foe: foe.name,
        won: Boolean(B.won),
        foeHpLeft: Math.round(B.hp),
        heartsLost: B.heartsLost,
        knockouts: B.knockouts,
        crits: B.crits,
        ambushWon: B.ambushWon,
        ambushLost: B.ambushLost,
        powerups: B.powerups,
        rank: rank(sum),
      },
      feedback,
    });
  }

  function render() {
    const step = S.steps[S.i];
    S.answered = false;
    S.stepStart = Date.now();
    clearInterval(S.timer);
    const total = S.steps.filter((s) => s.type !== 'results' && s.type !== 'feedback').length;
    fill.style.width = `${Math.min(100, (S.i / total) * 100)}%`;
    stage.dataset.step = step.type;
    stage.className = `stage step-${step.type}${step.ambush ? ' is-ambush' : ''}${step.warmup ? ' is-warmup' : ''}`;
    sessionEl.classList.toggle('battle-hidden', step.type === 'results' || step.type === 'feedback');
    RENDER[step.type](step);
    window.scrollTo(0, 0);
  }

  function footer(html) {
    return `<div class="actions">${html}</div>`;
  }

  function showNext(label = 'Continue') {
    const actions = stage.querySelector('.actions');
    actions.innerHTML = `<button class="btn primary" data-act="next">${esc(label)}</button>`;
    actions.querySelector('[data-act=next]').focus({ preventScroll: true });
  }

  function answerBox(w) {
    return `<div class="answer-box">
      ${pic(w, 'small')}
      <div class="answer-text">
        <div class="answer-vi vi">${colorize(w.vi)}</div>
        <div class="answer-en">${esc(w.en)}</div>
        ${w.note ? `<div class="note">${esc(w.note)}</div>` : ''}
        <div class="row">${sayButton(w.vi, 'Hear it')}</div>
      </div>
    </div>`;
  }

  function optionButtons(opts, render, key) {
    return `<div class="options">${opts
      .map((o, i) => `<button type="button" class="opt" data-i="${i}" data-key="${esc(o[key])}"><span class="opt-n">${i + 1}</span><span class="opt-label">${render(o)}</span></button>`)
      .join('')}</div>`;
  }

  function markOptions(chosenKey, correctKey) {
    stage.querySelectorAll('.opt').forEach((b) => {
      b.disabled = true;
      if (b.dataset.key === correctKey) b.classList.add('correct');
      else if (b.dataset.key === chosenKey) b.classList.add('wrong');
    });
    stage.classList.add('answered');
  }

  function flash(ok) {
    stage.classList.remove('flash-ok', 'flash-bad');
    void stage.offsetWidth;
    stage.classList.add(ok ? 'flash-ok' : 'flash-bad');
  }

  function listenTop(vi) {
    return `<div class="listen-top"><button type="button" class="say big-say" data-say="${esc(vi)}" aria-label="Play again">${SPEAKER}</button><button type="button" class="say slow mini" data-say="${esc(vi)}" aria-label="Slow">Slow</button></div>`;
  }

  function choiceExercise(step, { prompt, top, opts, key, label, after, autoplay }) {
    const ambush = game.callouts?.ambush || { vi: 'Phục kích!', en: 'Ambush!' };
    stage.innerHTML = `
      ${step.ambush ? `<div class="ambush-banner"><b class="vi">${colorize(ambush.vi)}</b><small>${esc(ambush.en)}</small><div class="timer ambush-timer"><div class="timer-fill"></div></div></div>` : ''}
      <div class="kicker">${esc(prompt)}${step.retry ? ' <span class="again">again</span>' : ''}${step.warmup ? ' <span class="again">warm-up</span>' : ''}</div>
      ${top}
      ${optionButtons(opts, label, key)}
      <div class="feedback-slot"></div>
      ${footer('')}`;
    if (autoplay) play(step.word.vi);
    const answer = (chosen) => {
      if (S.answered) return;
      S.answered = true;
      clearInterval(S.timer);
      const ok = Boolean(chosen) && chosen[key] === step.word[key];
      record({
        t: step.type,
        w: step.word.vi,
        ok,
        a: chosen ? chosen[key] : null,
        retry: Boolean(step.retry) || undefined,
        combo: step.combo || undefined,
        warmup: step.warmup || undefined,
        ambush: step.ambush || undefined,
        timeout: chosen ? undefined : true,
      });
      markOptions(chosen ? chosen[key] : null, step.word[key]);
      flash(ok);
      if (ok) {
        strike(step);
        if (step.ambush) B.ambushWon += 1;
        addXP(step.retry ? 5 : step.ambush ? 20 : 10);
        maybeEvent(step);
      } else {
        if (step.ambush) B.ambushLost += 1;
        hurt();
        insertRetry(step);
      }
      stage.querySelector('.feedback-slot').innerHTML = after(ok, chosen);
      if (!autoplay || !ok) play(step.word.vi);
      showNext();
    };
    stage.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => answer(opts[Number(b.dataset.i)])));
    if (step.ambush) {
      const end = Date.now() + AMBUSH_SECONDS * 1000;
      const bar = stage.querySelector('.ambush-timer .timer-fill');
      S.timer = setInterval(() => {
        const left = Math.max(0, end - Date.now());
        bar.style.width = `${(left / (AMBUSH_SECONDS * 1000)) * 100}%`;
        if (left <= 0) answer(null);
      }, 100);
    }
  }

  const RENDER = {
    intro() {
      const l = session.lesson;
      const taunt = foe.taunts?.length ? pick(foe.taunts) : null;
      stage.innerHTML = `
        <div class="kicker">${l ? `Lesson ${esc(l.number)}` : 'Review'}</div>
        <h1 class="title">${esc(l ? l.title : 'Bring them back')}</h1>
        ${l ? `<div class="subtitle vi">${colorize(l.vi)}</div>` : ''}
        <div class="foe-card">
          <div class="foe-big">${sprite(foe.art)}</div>
          <div class="foe-info">
            <div class="label">Your opponent</div>
            <div class="foe-title vi">${colorize(foe.name)}</div>
            <div class="foe-en">${esc(foe.en)}</div>
            ${foe.intro ? `<p>${esc(foe.intro)}</p>` : ''}
            ${line(taunt)}
          </div>
        </div>
        ${l ? `<p class="lead">${esc(l.intro)}</p>` : ''}
        <div class="rules">
          <div><b>Right answers</b> hit ${esc(foe.en)}. Three in a row land a critical hit.</div>
          <div><b>Wrong answers</b> cost a heart. Lose all five and it heals a little.</div>
          ${boss ? '<div><b>The final round</b> is a 45-second boss fight. Win it to defeat the foe.</div>' : '<div><b>Remember them all</b> to beat it.</div>'}
        </div>
        <div class="legend compact">
          ${Object.entries(TONES)
            .map(([id, t]) => `<div class="legend-item t-${id}">${contourSVG(id, { width: 34, height: 22 })}<b>${esc(t.name)}</b></div>`)
            .join('')}
        </div>
        ${footer('<button class="btn primary" data-act="next">Fight</button>')}`;
    },

    meet(step) {
      const w = step.word;
      stage.innerHTML = `
        <div class="kicker">New word ${step.n} of ${step.of}</div>
        <div class="card meet-card">
          ${pic(w, 'large')}
          <div class="big vi">${colorize(w.vi)}</div>
          ${toneBadges(w.vi)}
          <div class="meaning">${esc(w.en)}</div>
          ${w.note ? `<div class="note">${esc(w.note)}</div>` : ''}
          <div class="row center">${sayButton(w.vi, 'Play')} ${sayButton(w.vi, 'Slow', 'slow')}</div>
          ${w.hook ? `<div class="hook"><div class="label">Memory hook</div>${esc(w.hook)}</div>` : ''}
          ${w.tip ? `<div class="tip"><div class="label">Say it</div>${esc(w.tip)}</div>` : ''}
          <p class="hint">Say it out loud twice, then play it again and compare.</p>
        </div>
        ${footer('<button class="btn ghost" data-act="known">I know it</button><button class="btn primary" data-act="next">Next</button>')}`;
      play(w.vi);
      stage.querySelector('[data-act=known]').addEventListener('click', () => {
        S.known.add(w.vi);
        record({ t: 'known', w: w.vi });
        S.steps = S.steps.filter((s, idx) => !(idx > S.i && s.word && nfc(s.word.vi) === nfc(w.vi) && DRILLS.has(s.type)));
        next();
      });
    },

    listen(step) {
      const opts = choices(step.word, step.pool, 'en');
      choiceExercise(step, {
        prompt: step.combo ? 'Put together: what does this mean?' : step.ambush ? 'Quick: what does this mean?' : 'What does this mean?',
        top: listenTop(step.word.vi),
        opts,
        key: 'en',
        label: (o) => esc(o.en),
        autoplay: true,
        after: () => answerBox(step.word),
      });
    },

    spell(step) {
      const opts = shuffle([step.word, ...step.word.contrast]);
      choiceExercise(step, {
        prompt: 'Which spelling did you hear?',
        top: listenTop(step.word.vi),
        opts,
        key: 'vi',
        label: (o) => `<span class="vi opt-vi">${colorize(o.vi)}</span>`,
        autoplay: true,
        after: () => `<div class="answer-box pairs"><div class="label">Hear the difference</div>${opts
          .map((o) => `<div class="pair ${o.vi === step.word.vi ? 'is-target' : ''}"><span class="vi pair-vi">${colorize(o.vi)}</span><span class="pair-en">${esc(o.en)}</span>${sayButton(o.vi, 'Play', 'mini')}</div>`)
          .join('')}</div>`,
      });
    },

    reverse(step) {
      const opts = choices(step.word, step.pool, 'vi');
      choiceExercise(step, {
        prompt: 'Which one is this?',
        top: `${pic(step.word, 'medium')}<div class="prompt-en">${esc(step.word.en)}</div>`,
        opts,
        key: 'vi',
        label: (o) => `<span class="vi opt-vi">${colorize(o.vi)}</span>`,
        autoplay: false,
        after: () => answerBox(step.word),
      });
    },

    type(step) {
      const w = step.word;
      const dict = Boolean(step.dictation);
      let hints = 0;
      let keys = 0;
      stage.innerHTML = `
        <div class="kicker">${dict ? 'Type what you hear' : 'Type it in Vietnamese'}${step.retry ? ' <span class="again">again</span>' : ''}</div>
        ${dict ? listenTop(w.vi) : `${pic(w, 'medium')}<div class="prompt-en">${esc(w.en)}</div>`}
        <form class="type-form" autocomplete="off">
          <input class="type-input vi" type="text" lang="vi" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Your answer">
          <div class="vkeys" aria-label="Tone and vowel keys">
            <div class="vkeys-row">${TONE_KEYS.map((t) => `<button type="button" class="vkey tone-key t-${t}" data-key="${t}" aria-label="${esc(TONES[t].name)} tone">${contourSVG(t, { width: 26, height: 16 })}<span>${esc(TONES[t].sample)}</span></button>`).join('')}</div>
            <div class="vkeys-row">${VOWEL_KEYS.map((k) => `<button type="button" class="vkey" data-key="${k}">${k}</button>`).join('')}</div>
          </div>
          <div class="hint-slot"></div>
          <div class="row center helper-row">
            <button type="button" class="btn ghost small" data-act="hint">Hint</button>
            ${dict ? '' : '<button type="button" class="btn ghost small" data-act="hear">Hear it</button>'}
          </div>
          <div class="feedback-slot"></div>
          ${footer('<button type="submit" class="btn primary" data-act="check">Check</button>')}
        </form>`;
      const input = stage.querySelector('.type-input');
      const form = stage.querySelector('.type-form');
      if (dict) play(w.vi);
      input.focus({ preventScroll: true });
      stage.querySelectorAll('.vkey').forEach((k) => {
        k.addEventListener('pointerdown', (ev) => ev.preventDefault());
        k.addEventListener('mousedown', (ev) => ev.preventDefault());
        k.addEventListener('click', () => {
          if (S.answered) return;
          const pos = document.activeElement === input && input.selectionStart != null ? input.selectionStart : input.value.length;
          const r = applyKey(input.value, pos, k.dataset.key);
          input.value = r.text;
          input.focus({ preventScroll: true });
          input.setSelectionRange(r.cursor, r.cursor);
          keys += 1;
        });
      });
      stage.querySelector('[data-act=hint]').addEventListener('click', () => {
        hints += 1;
        const shape = nfc(w.vi)
          .split(' ')
          .map((s) => s[0] + '·'.repeat(Math.max(0, [...s].length - 1)))
          .join(' ');
        const n = tonesOf(w.vi).length;
        let text;
        if (hints === 1) text = dict ? `It means: ${esc(w.en)}` : `${n} syllable${n > 1 ? 's' : ''}, starts with <b class="vi">${esc(nfc(w.vi)[0])}</b>`;
        else text = `Starts like <b class="vi">${esc(shape)}</b>; tones: ${tonesOf(w.vi).map((t) => TONES[t].name).join(', ')}`;
        stage.querySelector('.hint-slot').innerHTML = `<div class="hint">${text}</div>`;
        input.focus({ preventScroll: true });
      });
      stage.querySelector('[data-act=hear]')?.addEventListener('click', () => {
        hints += 1;
        play(w.vi);
        input.focus({ preventScroll: true });
      });
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (S.answered) {
          next();
          return;
        }
        const answer = input.value;
        const g = grade(answer, w.vi);
        if (g === 'empty') {
          input.focus();
          return;
        }
        S.answered = true;
        input.disabled = true;
        record({ t: 'type', w: w.vi, g, a: nfc(answer).trim().slice(0, 60), hints, keys, dictation: dict || undefined, retry: Boolean(step.retry) || undefined });
        const ok = g === 'perfect';
        flash(ok);
        if (ok) {
          strike(step);
          addXP(step.retry || hints ? 5 : 15);
          maybeEvent(step);
        } else if (g === 'wrong') {
          hurt();
          insertRetry(step);
        } else {
          B.streak = 0;
          callout('hit', `-${damage('half')}`);
          addXP(3);
          insertRetry(step);
        }
        const msg = {
          perfect: hints ? 'Correct, with a hint.' : 'Perfect.',
          tone: 'Right letters, wrong or missing tone. Look at the mark:',
          marks: 'Right letters. With the marks it is written:',
          sound: 'That sounds right in Hà Nội, but it is spelled:',
          wrong: 'Not quite. It is:',
        }[g];
        stage.classList.add('answered', `graded-${g}`);
        stage.querySelector('.feedback-slot').innerHTML = `<div class="verdict">${esc(msg)}</div>${answerBox(w)}`;
        play(w.vi);
        const btn = stage.querySelector('[data-act=check]');
        btn.textContent = 'Continue';
        btn.focus({ preventScroll: true });
      });
    },

    stage(step) {
      const taunt = foe.taunts?.length && Math.random() < 0.7 ? pick(foe.taunts) : null;
      stage.innerHTML = `
        <h2 class="title">${esc(step.title)}</h2>
        <p class="lead">${esc(step.text)}</p>
        ${taunt ? `<div class="taunt"><div class="foe-mini-inline">${sprite(foe.art)}</div><div class="bubble">${line(taunt)}</div></div>` : ''}
        ${footer('<button class="btn primary" data-act="next">Let\'s go</button>')}`;
    },

    grammar(step) {
      const g = step.grammar;
      stage.innerHTML = `
        <div class="kicker">One small rule</div>
        <h2 class="title">${esc(g.title)}</h2>
        <p class="lead">${esc(g.text)}</p>
        <div class="examples answer-box pairs">${(g.examples || [])
          .map((x) => `<div class="pair"><span class="vi pair-vi">${colorize(x.vi)}</span><span class="pair-en">${esc(x.en)}</span>${sayButton(x.vi, 'Play', 'mini')}</div>`)
          .join('')}</div>
        ${footer('<button class="btn primary" data-act="next">Try some</button>')}`;
    },

    speedIntro() {
      const c = game.callouts?.boss || { vi: 'Trận cuối!', en: 'Final battle!' };
      const taunt = foe.taunts?.length ? pick(foe.taunts) : null;
      stage.innerHTML = `
        <div class="boss-intro">
          <div class="foe-big angry">${sprite(foe.art)}</div>
          <h2 class="title vi">${colorize(c.vi)}</h2>
          <p class="lead">${esc(c.en)} ${session.testMode ? 4 : SPEED_SECONDS} seconds to finish ${esc(foe.en)}, who has ${Math.round(B.hp)}% left. Hear it, tap the meaning. Answers in a row hit harder.</p>
          ${line(taunt)}
        </div>
        ${footer('<button class="btn primary" data-act="next">Fight</button>')}`;
    },

    speed(step) {
      const seconds = session.testMode ? 4 : SPEED_SECONDS;
      const end = Date.now() + seconds * 1000;
      let over = false;
      stage.innerHTML = `
        <div class="speed-head"><div class="timer"><div class="timer-fill"></div></div><div class="speed-score"><span class="score">0</span> pts <span class="combo"></span></div></div>
        <div class="speed-q"></div>`;
      const timerFill = stage.querySelector('.timer-fill');
      const q = stage.querySelector('.speed-q');
      const done = () => {
        if (over) return;
        over = true;
        clearInterval(S.timer);
        stop();
        B.won = B.hp <= 0;
        if (B.won) callout('victory');
        setTimeout(next, B.won ? 900 : 0);
      };
      const ask = () => {
        const target = pick(step.pool);
        const opts = choices(target, step.pool, 'en');
        const askedAt = Date.now();
        q.innerHTML = `${listenTop(target.vi)}${optionButtons(opts, (o) => esc(o.en), 'en')}`;
        play(target.vi);
        q.querySelectorAll('.opt').forEach((b) =>
          b.addEventListener('click', () => {
            if (over) return;
            const chosen = opts[Number(b.dataset.i)];
            const ok = chosen.en === target.en;
            S.events.push({ t: 'speed', w: target.vi, ok, a: chosen.en, ms: Date.now() - askedAt, at: Date.now() - S.started });
            const sp = S.speed;
            sp.answered += 1;
            if (ok) {
              sp.correct += 1;
              sp.combo += 1;
              sp.bestCombo = Math.max(sp.bestCombo, sp.combo);
              const pts = 10 * Math.min(sp.combo, 5);
              sp.score += pts;
              addXP(Math.round(pts / 5));
              const d = 3.5 * (1 + 0.25 * (Math.min(sp.combo, 5) - 1));
              B.hp = Math.max(0, B.hp - d);
              shakeFoe();
              updateBattle();
              callout(sp.combo >= 3 ? 'crit' : 'hit', `-${Math.round(d)}`);
            } else {
              sp.combo = 0;
              hurt();
            }
            stage.querySelector('.score').textContent = sp.score;
            stage.querySelector('.combo').textContent = sp.combo > 1 ? `x${Math.min(sp.combo, 5)}` : '';
            flash(ok);
            if (B.hp <= 0) done();
            else if (Date.now() < end) ask();
          }),
        );
      };
      ask();
      S.timer = setInterval(() => {
        const left = Math.max(0, end - Date.now());
        timerFill.style.width = `${(left / (seconds * 1000)) * 100}%`;
        if (left <= 0) done();
      }, 100);
    },

    results() {
      if (B.won === null) B.won = B.hp <= 0;
      const sum = summarise(S.events, scoredWords);
      const pct = Math.round(sum.firstTryAccuracy * 100);
      const r = rank(sum);
      const stars = (n) => `<span class="stars" aria-label="${n} of 3">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(3 - n)}</span>`;
      const c = B.won ? game.callouts?.victory : game.callouts?.escaped;
      const missedWarmup = [...new Set(S.events.filter((e) => e.warmup && !e.ok).map((e) => e.w))];
      stage.innerHTML = `
        <div class="battle-result ${B.won ? 'win' : 'lose'}">
          <div class="foe-big ${B.won ? 'defeated' : ''}">${sprite(foe.art)}</div>
          <div class="battle-text">
            <div class="rank-badge rank-${r}">${r}</div>
            <h2 class="title vi">${colorize(c?.vi || (B.won ? 'Victory!' : 'It got away!'))}</h2>
            <small>${esc(c?.en || '')}</small>
            ${line(B.won ? foe.win : foe.lose)}
          </div>
        </div>
        <div class="stats">
          <div><b>${pct}%</b><span>first try</span></div>
          <div><b>${S.xp}</b><span>XP</span></div>
          <div><b>${B.crits}</b><span>critical hits</span></div>
          <div><b>${B.heartsLost}</b><span>hearts lost</span></div>
        </div>
        ${missedWarmup.length ? `<div class="note">Added to your reviews from the warm-up: <span class="vi">${missedWarmup.map((v) => colorize(v)).join(', ')}</span></div>` : ''}
        <div class="word-results">${sum.perWord
          .map((w) => `<button type="button" class="word-row" data-say="${esc(w.vi)}"><span class="vi">${colorize(w.vi)}</span><span class="en">${esc(w.en)}${S.known.has(w.vi) ? ' <span class="again">known</span>' : ''}</span>${stars(w.stars)}</button>`)
          .join('')}</div>
        ${footer('<button class="btn primary" data-act="next">Continue</button>')}`;
      const l = B.won ? foe.win : foe.lose;
      if (l?.vi) play(l.vi);
    },

    feedback() {
      const sum = summarise(S.events, scoredWords);
      const hard = new Set(sum.perWord.filter((w) => w.stars < 2 && !S.known.has(w.vi)).map((w) => w.vi));
      const seg = (name, values) =>
        `<div class="seg" data-name="${name}">${values.map((v) => `<button type="button" class="seg-btn" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
      stage.innerHTML = `
        <h2 class="title">How was it?</h2>
        <p class="lead">This shapes your next lesson.</p>
        <form class="feedback-form">
          <label class="field-label">Difficulty</label>
          ${seg('difficulty', ['Too easy', 'Just right', 'Too hard'])}
          <label class="field-label">Fun</label>
          ${seg('fun', ['Boring', 'OK', 'Good', 'Fun', 'Loved it'])}
          <label class="field-label">Hardest words</label>
          <div class="chips">${scoredWords
            .map((w) => `<button type="button" class="chip ${hard.has(w.vi) ? 'on' : ''}" data-vi="${esc(w.vi)}"><span class="vi">${colorize(w.vi)}</span></button>`)
            .join('')}</div>
          <label class="field-label" for="want-next">What would you like to learn next?</label>
          <textarea id="want-next" name="wantNext" rows="2" placeholder="For example: family words, things at the market, slang"></textarea>
          <label class="field-label" for="note">Anything else?</label>
          <textarea id="note" name="note" rows="2" placeholder="What worked, what didn't"></textarea>
          ${footer('<button type="button" class="btn ghost" data-act="skip">Skip</button><button type="submit" class="btn primary" data-act="save">Save</button>')}
        </form>`;
      const form = stage.querySelector('.feedback-form');
      form.querySelectorAll('.seg').forEach((s) =>
        s.addEventListener('click', (ev) => {
          const b = ev.target.closest('.seg-btn');
          if (!b) return;
          s.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('on', x === b));
        }),
      );
      form.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => c.classList.toggle('on')));
      const collect = () => ({
        difficulty: form.querySelector('[data-name=difficulty] .on')?.dataset.v || null,
        fun: form.querySelector('[data-name=fun] .on')?.dataset.v || null,
        hardest: [...form.querySelectorAll('.chip.on')].map((c) => c.dataset.vi),
        wantNext: form.wantNext.value.trim().slice(0, 500) || null,
        note: form.note.value.trim().slice(0, 1000) || null,
      });
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        finish(collect());
      });
      form.querySelector('[data-act=skip]').addEventListener('click', () => finish(null));
    },
  };

  function onKey(ev) {
    if (ev.target.matches('input, textarea')) return;
    const n = Number(ev.key);
    if (n >= 1 && n <= 6) {
      const opt = stage.querySelectorAll('.opt:not([disabled])')[n - 1];
      if (opt) opt.click();
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      const nb = stage.querySelector('[data-act=next]');
      if (nb) {
        ev.preventDefault();
        nb.click();
      }
    }
  }

  sessionEl.addEventListener('click', (ev) => {
    const say = ev.target.closest('[data-say]');
    if (say) {
      play(say.dataset.say, { slow: say.classList.contains('slow') });
      return;
    }
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'next') next();
    else if (act === 'quit') {
      if (confirm('Leave now? Answers from this session will not be saved.')) {
        cleanup();
        onQuit();
      }
    }
  });
  document.addEventListener('keydown', onKey);
  if (session.jumpTo) {
    const at = S.steps.findIndex((s) => s.type === session.jumpTo);
    if (at > 0) S.i = at;
  }
  updateBattle();
  render();
  return cleanup;
}

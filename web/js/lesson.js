// Runs a lesson or review session: builds the exercise sequence, renders each step and records every answer.

import { colorize, contourSVG, tonesOf, TONES, grade, escapeHTML as esc, nfc } from './vi.js';
import { play, stop } from './audio.js';

const SPEAKER =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zm-2.5-8.8v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const BOUNDARIES = new Set(['stage', 'grammar', 'speedIntro', 'results', 'feedback']);
const SCORED = new Set(['listen', 'spell', 'reverse', 'type']);
const SPEED_SECONDS = 45;

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
  return `<button class="say ${extra}" data-say="${esc(vi)}" aria-label="${esc(label)}">${SPEAKER}<span>${esc(label)}</span></button>`;
}

function toneBadges(vi) {
  return `<div class="tone-badges">${tonesOf(vi)
    .map((t) => `<span class="tone-badge t-${t}">${contourSVG(t)}<span>${esc(TONES[t].name)}</span></span>`)
    .join('')}</div>`;
}

export function lessonSteps(lesson, reviewWords = []) {
  const words = lesson.words;
  const all = [...words, ...reviewWords];
  const steps = [{ type: 'intro' }];
  chunk(words, 4).forEach((group, gi) => {
    group.forEach((w, wi) => steps.push({ type: 'meet', word: w, n: gi * 4 + wi + 1, of: words.length }));
    shuffle(group)
      .slice(0, Math.min(2, group.length))
      .forEach((w) => steps.push({ type: 'listen', word: w, pool: group.length >= 3 ? group : words }));
  });
  steps.push({ type: 'stage', title: 'Listen', text: 'Hear each word and tap what it means. Words you miss come back a little later.' });
  shuffle(all).forEach((w) => steps.push({ type: 'listen', word: w, pool: all }));
  steps.push({ type: 'stage', title: 'Tones and spelling', text: 'Pick the spelling you hear, or the Vietnamese for a meaning. Watch the tone marks.' });
  shuffle(words).forEach((w) => steps.push(w.contrast?.length ? { type: 'spell', word: w } : { type: 'reverse', word: w, pool: words }));
  steps.push({ type: 'stage', title: 'From memory', text: 'Type the Vietnamese. Tone marks count, and you still get partial credit without them.', keyboardTip: true });
  shuffle(all).forEach((w) => steps.push({ type: 'type', word: w }));
  if (lesson.grammar) steps.push({ type: 'grammar', grammar: lesson.grammar });
  if (lesson.combos?.length) {
    shuffle(lesson.combos).forEach((c) => steps.push({ type: 'listen', word: c, pool: lesson.combos, combo: true }));
  }
  steps.push({ type: 'speedIntro' }, { type: 'speed', pool: [...all, ...(lesson.combos || [])] });
  steps.push({ type: 'results' }, { type: 'feedback' });
  return steps;
}

export function reviewSteps(words, pool) {
  const steps = [{ type: 'stage', title: 'Review', text: `${words.length} word${words.length === 1 ? '' : 's'} to bring back from memory. Listen first, then type.` }];
  shuffle(words).forEach((w) => steps.push({ type: 'listen', word: w, pool }));
  steps.push({ type: 'stage', title: 'From memory', text: 'Type the Vietnamese for each meaning.', keyboardTip: true });
  shuffle(words).forEach((w) => steps.push({ type: 'type', word: w }));
  steps.push({ type: 'results' }, { type: 'feedback' });
  return steps;
}

// Summarises the recorded events into per-word results and totals.
export function summarise(events, words) {
  const firsts = events.filter((e) => SCORED.has(e.t) && !e.retry);
  const credit = (e) => (e.t === 'type' ? { perfect: 1, tone: 0.5, marks: 0.5 }[e.g] || 0 : e.ok ? 1 : 0);
  const perWord = words.map((w) => {
    const mine = firsts.filter((e) => e.w === w.vi);
    const share = mine.length ? mine.reduce((s, e) => s + credit(e), 0) / mine.length : 0;
    const firstTry = {};
    for (const e of mine) firstTry[e.t] = e.t === 'type' ? e.g : e.ok;
    const times = events.filter((e) => e.w === w.vi && e.ms).map((e) => e.ms).sort((a, b) => a - b);
    return {
      vi: w.vi,
      en: w.en,
      share: Math.round(share * 100) / 100,
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
  };
  const words = session.words;
  const scoredWords = session.scoredWords || words;

  root.innerHTML = `
    <div class="session">
      <header class="session-bar">
        <button class="icon-btn" data-act="quit" aria-label="Leave">&times;</button>
        <div class="progress" role="progressbar" aria-label="Progress"><div class="fill"></div></div>
        <div class="xp-pill"><span class="xp-num">0</span> XP</div>
      </header>
      <main class="stage" aria-live="polite"></main>
    </div>`;
  const stage = root.querySelector('.stage');
  const fill = root.querySelector('.fill');
  const xpNum = root.querySelector('.xp-num');

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
    if (step.retry) return;
    let end = S.i + 1;
    while (end < S.steps.length && !BOUNDARIES.has(S.steps[end].type)) end++;
    const at = Math.min(S.i + 4, end);
    S.steps.splice(at, 0, { ...step, retry: true });
  }

  function next() {
    S.i += 1;
    render();
  }

  function cleanup() {
    clearInterval(S.timer);
    document.removeEventListener('keydown', onKey);
    stop();
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
      feedback,
    });
  }

  function render() {
    const step = S.steps[S.i];
    S.answered = false;
    S.stepStart = Date.now();
    clearInterval(S.timer);
    const scoredSteps = S.steps.filter((s) => s.type !== 'results' && s.type !== 'feedback').length;
    fill.style.width = `${Math.min(100, (S.i / scoredSteps) * 100)}%`;
    stage.dataset.step = step.type;
    stage.className = `stage step-${step.type}`;
    RENDER[step.type](step);
    stage.scrollTop = 0;
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

  function answerBox(w, extra = '') {
    return `<div class="answer-box">
      <div class="answer-vi vi">${colorize(w.vi)}</div>
      <div class="answer-en">${esc(w.en)}</div>
      ${w.note ? `<div class="note">${esc(w.note)}</div>` : ''}
      ${extra}
      <div class="row">${sayButton(w.vi, 'Hear it')}</div>
    </div>`;
  }

  function optionButtons(opts, render, key) {
    return `<div class="options">${opts
      .map((o, i) => `<button class="opt" data-i="${i}" data-key="${esc(o[key])}"><span class="opt-n">${i + 1}</span><span class="opt-label">${render(o)}</span></button>`)
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

  function choiceExercise(step, { prompt, top, opts, key, label, after, autoplay }) {
    stage.innerHTML = `
      <div class="kicker">${esc(prompt)}${step.retry ? ' <span class="again">again</span>' : ''}</div>
      ${top}
      ${optionButtons(opts, label, key)}
      <div class="feedback-slot"></div>
      ${footer('')}`;
    if (autoplay) play(step.word.vi);
    stage.querySelectorAll('.opt').forEach((b) =>
      b.addEventListener('click', () => {
        if (S.answered) return;
        S.answered = true;
        const chosen = opts[Number(b.dataset.i)];
        const ok = chosen[key] === step.word[key];
        record({ t: step.type, w: step.word.vi, ok, a: chosen[key], retry: Boolean(step.retry), combo: step.combo || undefined });
        markOptions(chosen[key], step.word[key]);
        flash(ok);
        addXP(ok ? (step.retry ? 5 : 10) : 0);
        if (!ok) insertRetry(step);
        stage.querySelector('.feedback-slot').innerHTML = after(ok, chosen);
        if (!autoplay || !ok) play(step.word.vi);
        showNext();
      }),
    );
  }

  const RENDER = {
    intro() {
      const l = session.lesson;
      stage.innerHTML = `
        <div class="kicker">Lesson ${esc(l.number)}</div>
        <h1 class="title">${esc(l.title)}</h1>
        <div class="subtitle vi">${colorize(l.vi)}</div>
        <p class="lead">${esc(l.intro)}</p>
        <div class="legend">
          ${Object.entries(TONES)
            .map(([id, t]) => `<div class="legend-item t-${id}">${contourSVG(id)}<div><b>${esc(t.name)}</b> <span class="vi">${esc(t.sample)}</span><br><small>${esc(t.feel)}</small></div></div>`)
            .join('')}
        </div>
        <p class="hint">How it works: meet the words in groups of four, then listen, spell, type from memory, and finish with a speed round.</p>
        ${footer('<button class="btn primary" data-act="next">Start</button>')}`;
    },

    meet(step) {
      const w = step.word;
      stage.innerHTML = `
        <div class="kicker">New word ${step.n} of ${step.of}</div>
        <div class="card meet-card">
          <div class="big vi">${colorize(w.vi)}</div>
          ${toneBadges(w.vi)}
          <div class="meaning">${esc(w.en)}</div>
          ${w.note ? `<div class="note">${esc(w.note)}</div>` : ''}
          <div class="row">${sayButton(w.vi, 'Play')} ${sayButton(w.vi, 'Slow', 'slow')}</div>
          ${w.hook ? `<div class="hook"><div class="label">Memory hook</div>${esc(w.hook)}</div>` : ''}
          ${w.tip ? `<div class="tip"><div class="label">Say it</div>${esc(w.tip)}</div>` : ''}
          <p class="hint">Say it out loud twice, then play it again and compare.</p>
        </div>
        ${footer(`<button class="btn ghost" data-act="known">I know it</button><button class="btn primary" data-act="next">Next</button>`)}`;
      play(w.vi);
      stage.querySelector('[data-act=known]').addEventListener('click', () => {
        S.known.add(w.vi);
        record({ t: 'known', w: w.vi });
        next();
      });
    },

    listen(step) {
      const opts = choices(step.word, step.pool, 'en');
      choiceExercise(step, {
        prompt: step.combo ? 'Put together: what does this mean?' : 'What does this mean?',
        top: `<div class="listen-top"><button class="say big-say" data-say="${esc(step.word.vi)}" aria-label="Play again">${SPEAKER}</button><button class="say slow mini" data-say="${esc(step.word.vi)}" aria-label="Slow">Slow</button></div>`,
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
        top: `<div class="listen-top"><button class="say big-say" data-say="${esc(step.word.vi)}" aria-label="Play again">${SPEAKER}</button><button class="say slow mini" data-say="${esc(step.word.vi)}" aria-label="Slow">Slow</button></div>`,
        opts,
        key: 'vi',
        label: (o) => `<span class="vi opt-vi">${colorize(o.vi)}</span>`,
        autoplay: true,
        after: () => `<div class="answer-box"><div class="label">Hear the difference</div>${opts
          .map((o) => `<div class="pair ${o.vi === step.word.vi ? 'is-target' : ''}"><span class="vi pair-vi">${colorize(o.vi)}</span><span class="pair-en">${esc(o.en)}</span>${sayButton(o.vi, 'Play')}</div>`)
          .join('')}</div>`,
      });
    },

    reverse(step) {
      const opts = choices(step.word, step.pool, 'vi');
      choiceExercise(step, {
        prompt: 'Which one means this?',
        top: `<div class="prompt-en">${esc(step.word.en)}</div>`,
        opts,
        key: 'vi',
        label: (o) => `<span class="vi opt-vi">${colorize(o.vi)}</span>`,
        autoplay: false,
        after: () => answerBox(step.word),
      });
    },

    type(step) {
      const w = step.word;
      let hints = 0;
      stage.innerHTML = `
        <div class="kicker">Type it in Vietnamese${step.retry ? ' <span class="again">again</span>' : ''}</div>
        <div class="prompt-en">${esc(w.en)}</div>
        <form class="type-form" autocomplete="off">
          <input class="type-input vi" type="text" lang="vi" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Your answer">
          <div class="hint-slot"></div>
          <div class="row">
            <button type="button" class="btn ghost small" data-act="hint">Hint</button>
            <button type="button" class="btn ghost small" data-act="hear">Hear it</button>
          </div>
          <div class="feedback-slot"></div>
          ${footer('<button type="submit" class="btn primary" data-act="check">Check</button>')}
        </form>`;
      const input = stage.querySelector('.type-input');
      const form = stage.querySelector('.type-form');
      input.focus();
      stage.querySelector('[data-act=hint]').addEventListener('click', () => {
        hints += 1;
        const shape = nfc(w.vi)
          .split(' ')
          .map((s) => s[0] + '·'.repeat(Math.max(0, [...s].length - 1)))
          .join(' ');
        stage.querySelector('.hint-slot').innerHTML = `<div class="hint">${hints > 1 ? `Starts like <b class="vi">${esc(shape)}</b>, tones: ${tonesOf(w.vi).map((t) => TONES[t].name).join(', ')}` : `${tonesOf(w.vi).length} syllable${tonesOf(w.vi).length > 1 ? 's' : ''}, starts with <b class="vi">${esc(nfc(w.vi)[0])}</b>`}</div>`;
        input.focus();
      });
      stage.querySelector('[data-act=hear]').addEventListener('click', () => {
        hints += 1;
        play(w.vi);
        input.focus();
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
        record({ t: 'type', w: w.vi, g, a: nfc(answer).trim().slice(0, 60), hints, retry: Boolean(step.retry) });
        const ok = g === 'perfect';
        flash(ok);
        addXP(ok ? (step.retry || hints ? 5 : 10) : g === 'tone' || g === 'marks' ? 3 : 0);
        if (!ok) insertRetry(step);
        const msg = {
          perfect: hints ? 'Correct (with a hint).' : 'Perfect.',
          tone: 'Right word, wrong tone. Look at the tone mark:',
          marks: 'Right letters. With the marks it is written:',
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
      stage.innerHTML = `
        <h2 class="title">${esc(step.title)}</h2>
        <p class="lead">${esc(step.text)}</p>
        ${
          step.keyboardTip
            ? `<div class="tip"><div class="label">Typing tone marks</div>Add the Vietnamese keyboard (Settings, General, Keyboard, Keyboards, Add New Keyboard, Vietnamese, Telex). Or type Telex letters yourself: <b>s</b> rising, <b>f</b> falling, <b>r</b> dipping, <b>x</b> broken, <b>j</b> heavy, and <b>ow</b> for ơ, <b>uw</b> for ư, <b>aa</b> for â, <b>dd</b> for đ. So <b>phowr</b> is phở.</div>`
            : ''
        }
        ${footer('<button class="btn primary" data-act="next">Let\'s go</button>')}`;
    },

    grammar(step) {
      const g = step.grammar;
      stage.innerHTML = `
        <div class="kicker">One small rule</div>
        <h2 class="title">${esc(g.title)}</h2>
        <p class="lead">${esc(g.text)}</p>
        <div class="examples">${(g.examples || [])
          .map((x) => `<div class="pair"><span class="vi pair-vi">${colorize(x.vi)}</span><span class="pair-en">${esc(x.en)}</span>${sayButton(x.vi, 'Play')}</div>`)
          .join('')}</div>
        ${footer('<button class="btn primary" data-act="next">Try some</button>')}`;
    },

    speedIntro() {
      stage.innerHTML = `
        <div class="kicker">Final round</div>
        <h2 class="title">Speed round</h2>
        <p class="lead">${session.testMode ? 4 : SPEED_SECONDS} seconds. Hear it, tap the meaning. Answers in a row multiply your points.</p>
        ${footer('<button class="btn primary" data-act="next">Go</button>')}`;
    },

    speed(step) {
      const seconds = session.testMode ? 4 : SPEED_SECONDS;
      const end = Date.now() + seconds * 1000;
      stage.innerHTML = `
        <div class="speed-head"><div class="timer"><div class="timer-fill"></div></div><div class="speed-score"><span class="score">0</span> pts <span class="combo"></span></div></div>
        <div class="speed-q"></div>`;
      const timerFill = stage.querySelector('.timer-fill');
      const q = stage.querySelector('.speed-q');
      const ask = () => {
        const target = step.pool[Math.floor(Math.random() * step.pool.length)];
        const opts = choices(target, step.pool, 'en');
        const askedAt = Date.now();
        q.innerHTML = `<div class="listen-top"><button class="say big-say" data-say="${esc(target.vi)}" aria-label="Play again">${SPEAKER}</button></div>${optionButtons(opts, (o) => esc(o.en), 'en')}`;
        play(target.vi);
        q.querySelectorAll('.opt').forEach((b) =>
          b.addEventListener('click', () => {
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
            } else sp.combo = 0;
            stage.querySelector('.score').textContent = sp.score;
            stage.querySelector('.combo').textContent = sp.combo > 1 ? `x${Math.min(sp.combo, 5)}` : '';
            flash(ok);
            if (Date.now() < end) ask();
          }),
        );
      };
      ask();
      S.timer = setInterval(() => {
        const left = Math.max(0, end - Date.now());
        timerFill.style.width = `${(left / (seconds * 1000)) * 100}%`;
        if (left <= 0) {
          clearInterval(S.timer);
          stop();
          next();
        }
      }, 100);
    },

    results() {
      const sum = summarise(S.events, scoredWords);
      const pct = Math.round(sum.firstTryAccuracy * 100);
      const stars = (n) => `<span class="stars" aria-label="${n} of 3">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(3 - n)}</span>`;
      stage.innerHTML = `
        <div class="kicker">Done</div>
        <h2 class="title">${pct >= 90 ? 'Excellent' : pct >= 70 ? 'Nice work' : 'Good start'}</h2>
        <div class="stats">
          <div><b>${pct}%</b><span>first try</span></div>
          <div><b>${S.xp}</b><span>XP</span></div>
          ${S.speed.answered ? `<div><b>${S.speed.score}</b><span>speed points</span></div>` : ''}
          <div><b>${Math.max(1, Math.round((Date.now() - S.started) / 60000))}</b><span>min</span></div>
        </div>
        <div class="word-results">${sum.perWord
          .map((w) => `<div class="word-row"><span class="vi">${colorize(w.vi)}</span><span class="en">${esc(w.en)}</span>${stars(w.stars)}</div>`)
          .join('')}</div>
        ${footer('<button class="btn primary" data-act="next">Continue</button>')}`;
    },

    feedback() {
      const sum = summarise(S.events, scoredWords);
      const hard = new Set(sum.perWord.filter((w) => w.stars < 2).map((w) => w.vi));
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
          <textarea id="want-next" name="wantNext" rows="2" placeholder="For example: numbers, family words, things at the market"></textarea>
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

  const sessionEl = root.querySelector('.session');
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
  render();
  return cleanup;
}

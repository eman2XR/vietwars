// Runs a lesson (an issue of the magazine) or a review: builds the sequence, renders each step and records every answer.

import { colorize, contourSVG, tonesOf, TONES, grade, escapeHTML as esc, nfc, applyKey, withTone, tokens, stripAll } from './vi.js';
import { play, playAll, stop } from './audio.js';
import { picture } from './pictures.js';

const SPEAKER =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zm-2.5-8.8v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const BOUNDARIES = new Set(['stage', 'grammar', 'speedIntro', 'results', 'feedback']);
const SCORED = new Set(['listen', 'spell', 'reverse', 'type']);
const DRILLS = new Set(['listen', 'spell', 'reverse']);
const TYPE_CREDIT = { perfect: 1, tone: 0.5, marks: 0.5, sound: 0.5 };
const SPEED_SECONDS = 45;
const HOT_STREAK = 3;
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

// Blanks out the answer (with or without its marks) wherever a hint text contains it.
// Reads a typed price: digits with any separators, or shorthand such as 25k for 25,000.
export function digitsOf(text) {
  const t = String(text).trim().toLowerCase().replace(/\s+/g, '');
  const k = t.match(/^(\d+(?:[.,]\d+)?)k$/);
  if (k) return String(Math.round(parseFloat(k[1].replace(',', '.')) * 1000));
  return t.replace(/[^0-9]/g, '');
}

function maskWord(text, vi) {
  const target = stripMarks(nfc(vi).toLowerCase());
  const words = nfc(text).split(/(\s+)/);
  const n = target.split(' ').length;
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const span = words.slice(i, i + n * 2 - 1).join('');
    const bare = stripMarks(span.toLowerCase().replace(/[^\p{L}\s]/gu, ''));
    if (bare === target) {
      out.push(span.replace(/\p{L}+/gu, (m) => '_'.repeat([...m].length)));
      i += n * 2 - 2;
    } else out.push(words[i]);
  }
  return out.join('');
}

function stripMarks(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').normalize('NFC');
}

// Syllable tiles for a scaffolded retry: the word's syllables plus two tone variants as distractors.
function tilesFor(vi) {
  const syl = tokens(vi);
  const tones = ['ngang', 'huyen', 'sac', 'hoi', 'nga', 'nang'];
  const extra = new Set();
  for (const s of shuffle(syl)) {
    for (const t of shuffle(tones)) {
      const v = withTone(s, t);
      if (!syl.includes(v) && extra.size < 2) extra.add(v);
    }
    if (extra.size >= 2) break;
  }
  return shuffle([...syl, ...extra]);
}

export { maskWord };

export function stampHTML(lesson, grade = '', date = '') {
  const art = lesson?.stamp?.picture ? picture(lesson.stamp.picture) : '';
  return `<div class="stamp ${grade ? `grade-${grade}` : 'empty'}">
    <div class="stamp-inner">
      <div class="stamp-art">${art}</div>
      <div class="stamp-label vi">${colorize(lesson?.stamp?.label || lesson?.vi || '')}</div>
      <div class="stamp-num">No. ${esc(lesson?.number ?? '')}</div>
    </div>
    ${date ? `<div class="postmark"><span>HÀ NỘI</span><span>${esc(date)}</span></div>` : ''}
  </div>`;
}

// The story: a short intro, then beats placed through the lesson. Older lessons with only body paragraphs are split the same way.
export function storyParts(lesson) {
  const f = lesson?.feature || {};
  const intro = f.intro || (f.body || [])[0] || '';
  const beats = f.beats ? [...f.beats] : (f.body || []).slice(1).map((text) => ({ text }));
  return { intro, beats };
}

const PART_SIZE = 8;
const MAX_SPELL = 3;

// Builds an issue. More than eight new words are split into two parts, each met and practised on its own, before the shared finale.
export function lessonSteps(lesson, { review = [], warmup = [] } = {}) {
  const words = lesson.words;
  const steps = [{ type: 'feature' }];
  // Beats play in file order. A beat tied to a new word waits until that word has been met; an untied beat waits for the next part, practise or real-life screen.
  const queue = [...storyParts(lesson).beats];
  const met = new Set();
  const wordFor = (b) => (b.word ? words.find((w) => nfc(w.vi) === nfc(b.word)) : undefined);
  const looseBeat = () => (queue.length && !wordFor(queue[0]) ? queue.shift() : undefined);
  const storySteps = () => {
    const out = [];
    while (queue.length && wordFor(queue[0]) && met.has(nfc(queue[0].word))) {
      const b = queue.shift();
      out.push({ type: 'story', beat: b, word: wordFor(b) });
    }
    return out;
  };
  if (warmup.length) {
    steps.push({ type: 'stage', title: 'Warm-up', text: `${warmup.length} words you probably know. Tap the meaning; any you miss go into your reviews.` });
    shuffle(warmup).forEach((w) => steps.push({ type: 'listen', word: w, pool: warmup, warmup: true }));
  }
  const half = Math.ceil(words.length / 2);
  const parts = words.length > PART_SIZE ? [words.slice(0, half), words.slice(half)] : [words];
  let offset = 0;
  parts.forEach((part, pi) => {
    const last = pi === parts.length - 1;
    const practise = [...part, ...(last ? review : [])];
    const pool = parts.length > 1 ? [...part, ...(last ? review : []), ...(pi > 0 ? parts[0] : [])] : [...words, ...review];
    if (parts.length > 1) {
      steps.push({
        type: 'stage',
        beat: pi > 0 ? looseBeat() : undefined,
        title: `Part ${pi + 1} of ${parts.length}`,
        text: pi === 0 ? `${part.length} new words first, then ${words.length - part.length} more. You can stop at any point: close the issue and your place is kept.` : `${part.length} more words. Your place is kept whenever you stop.`,
      });
      steps.push(...storySteps());
    }
    chunk(part, 4).forEach((group, gi) => {
      group.forEach((w, wi) => steps.push({ type: 'meet', word: w, n: offset + gi * 4 + wi + 1, of: words.length }));
      shuffle(group)
        .slice(0, Math.min(2, group.length))
        .forEach((w) => steps.push({ type: 'listen', word: w, pool: group.length >= 3 ? group : pool }));
      group.forEach((w) => met.add(nfc(w.vi)));
      steps.push(...storySteps());
    });
    offset += part.length;
    steps.push({ type: 'stage', beat: looseBeat(), title: parts.length > 1 ? `Practise part ${pi + 1}` : 'Practise', text: 'Listen and pick the meaning, pick the spelling you hear, then type from memory.' });
    steps.push(...storySteps());
    shuffle(practise).forEach((w) => steps.push({ type: 'listen', word: w, pool }));
    const spellers = new Set(shuffle(part.filter((w) => w.contrast?.length)).slice(0, MAX_SPELL).map((w) => w.vi));
    shuffle(part).forEach((w) => steps.push(spellers.has(w.vi) ? { type: 'spell', word: w } : { type: 'reverse', word: w, pool: part.length >= 4 ? part : pool }));
    // Review words are only heard here; typing them from memory belongs to the spaced reviews.
    shuffle(part).forEach((w) => steps.push({ type: 'type', word: w }));
  });
  if (lesson.grammar) steps.push({ type: 'grammar', grammar: lesson.grammar });
  if (lesson.combos?.length) {
    shuffle(lesson.combos).forEach((c) => steps.push({ type: 'listen', word: c, pool: lesson.combos, combo: true }));
  }
  if (lesson.dialogues?.length) {
    steps.push({ type: 'stage', beat: looseBeat(), title: 'Conversation', text: 'A short exchange from a Hà Nội table or street. Listen first, say each line after the voice, then pick what you would say.' });
    steps.push(...storySteps());
    lesson.dialogues.forEach((d) => steps.push({ type: 'dialogue', dialogue: d, word: { vi: d.lines[0].vi, en: d.title, sit: true } }));
  }
  if (lesson.situations?.length) {
    steps.push({ type: 'stage', beat: looseBeat(), title: 'Real life', text: 'A waiter, a seller or a driver says something. Listen, then answer. Replay as often as you like.' });
    steps.push(...storySteps());
    shuffle(lesson.situations).forEach((sit) => steps.push({ type: sit.say ? 'say' : 'situation', word: sit, sit: true }));
  }
  steps.push({ type: 'speedIntro' }, { type: 'speed', pool: [...words, ...review, ...(lesson.combos || []), ...warmup] });
  steps.push({ type: 'results', beats: queue.splice(0) }, { type: 'feedback' });
  return steps;
}

export function reviewSteps(words, pool) {
  const steps = [{ type: 'reviewIntro' }];
  shuffle(words).forEach((w) => steps.push({ type: 'listen', word: w, pool }));
  steps.push({ type: 'stage', title: 'From memory', text: 'Type each word: from its meaning, or from hearing it.' });
  shuffle(words).forEach((w, i) => steps.push({ type: 'type', word: w, dictation: i % 2 === 1 }));
  steps.push({ type: 'results' }, { type: 'feedback' });
  return steps;
}

const SAY_ORDER = ['perfect', 'tone', 'marks', 'sound', 'wrong'];

// Words of address and politeness that may close a spoken line (em, anh, chị, ạ, nhé); they are optional when grading.
const POLITE_TAIL = new Set(['em', 'anh', 'chi', 'a', 'nhe']);
function dropPoliteTail(s) {
  const t = tokens(s);
  while (t.length > 1 && POLITE_TAIL.has(stripAll(t[t.length - 1]))) t.pop();
  return t.join(' ');
}

// Letters apart, counting a swap of two neighbours as one (douc for duoc).
function letterDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// A spoken line typed with every word in place but a slip of one letter in some (douc for được): the learner said it right.
function nearMiss(said, target) {
  const a = tokens(said).map((t) => stripAll(t).toLowerCase());
  const t = tokens(target).map((x) => stripAll(x).toLowerCase());
  return a.length === t.length && a.every((w, i) => w === t[i] || (t[i].length >= 3 && letterDistance(w, t[i]) <= 1));
}

// Grades a spoken line against every accepted way of saying it and keeps the closest. A polite ending (em, ạ, nhé)
// may be added or left out, and a one-letter slip in a word counts as said the way it sounds.
export function gradeSay(answer, accept) {
  const said = dropPoliteTail(answer);
  const grades = accept.map((a) => {
    const g = grade(said, dropPoliteTail(a));
    return g === 'wrong' && nearMiss(said, dropPoliteTail(a)) ? 'sound' : g;
  });
  if (grades.every((g) => g === 'empty')) return { g: 'empty', match: accept[0] };
  let best = 'wrong';
  let match = accept[0];
  grades.forEach((g, i) => {
    const r = SAY_ORDER.indexOf(g);
    if (r >= 0 && r < SAY_ORDER.indexOf(best)) {
      best = g;
      match = accept[i];
    }
  });
  return { g: best, match };
}

function credit(e) {
  if (e.t === 'type') return e.ok === true ? 1 : TYPE_CREDIT[e.g] || 0;
  return e.ok ? 1 : 0;
}

function mean(xs) {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null;
}

// Summarises the recorded events into per-word results and totals. Warm-up and retry answers are not first tries.
export function summarise(events, words) {
  const firsts = events.filter((e) => SCORED.has(e.t) && !e.retry && !e.ambush && !e.warmup);
  const perWord = words.map((w) => {
    const mine = firsts.filter((e) => e.w === w.vi);
    const share = mine.length ? mine.reduce((s, e) => s + credit(e), 0) / mine.length : 0;
    const firstTry = {};
    for (const e of mine) firstTry[e.t] = e.t === 'type' ? e.g : e.ok;
    const times = events.filter((e) => e.w === w.vi && e.ms && SCORED.has(e.t)).map((e) => e.ms).sort((a, b) => a - b);
    const all = events.filter((e) => e.w === w.vi && SCORED.has(e.t));
    return {
      vi: w.vi,
      en: w.en,
      failures: all.filter((e) => credit(e) < 1).length,
      timeSec: Math.round(all.reduce((t, e) => t + (e.ms || 0), 0) / 1000),
      replays: all.reduce((t, e) => t + (e.plays || 0), 0),
      hints: all.reduce((t, e) => t + (e.hints || 0), 0),
      revealed: all.some((e) => e.revealed),
      studySec: Math.round(events.filter((e) => e.w === w.vi && e.t === 'meet').reduce((t, e) => t + (e.ms || 0), 0) / 1000),
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

export function gradeFor(accuracy) {
  return accuracy >= 0.9 ? 'distinction' : accuracy >= 0.7 ? 'merit' : 'complete';
}

export function runSession(root, session, onDone, onQuit) {
  const lesson = session.lesson;
  const S = {
    steps: session.steps,
    i: 0,
    events: [],
    started: Date.now(),
    known: new Set(),
    streak: 0,
    bestStreak: 0,
    factsShown: [],
    met: new Set(),
    plays: 0,
    situations: { correct: 0, total: 0 },
    dialogues: { correct: 0, total: 0 },
    speed: { answered: 0, correct: 0, score: 0, combo: 0, bestCombo: 0 },
    quiz: { correct: 0, total: 0 },
    readMs: 0,
    stepStart: Date.now(),
    answered: false,
    timer: null,
  };
  const words = session.words;
  const scoredWords = session.scoredWords || words;
  const saveKey = session.saveKey ? `vw-resume-${session.saveKey}` : null;

  // Saves the session as plain data (words by their spelling), so it can be resumed later on this device.
  function snapshot() {
    if (!saveKey) return;
    const ref = (w) => (w ? w.vi : undefined);
    const data = {
      v: 1,
      savedAt: Date.now(),
      i: S.returnTo ?? S.i,
      total: S.steps.length,
      steps: S.steps.map((st) => ({ ...st, word: ref(st.word), pool: st.pool ? st.pool.map(ref) : undefined, q: st.q ? st.q.q : undefined, grammar: st.grammar ? 1 : undefined })),
      events: S.events,
      known: [...S.known],
      met: [...S.met],
      started: S.started,
      streak: S.streak,
      bestStreak: S.bestStreak,
      quiz: S.quiz,
      readMs: S.readMs,
      factsShown: S.factsShown,
      situations: S.situations,
      dialogues: S.dialogues,
      saved: S.saved || 0,
    };
    try {
      localStorage.setItem(saveKey, JSON.stringify(data));
    } catch {
      /* Storage full: the session simply cannot be resumed. */
    }
  }

  function restore(data) {
    const lookup = new Map();
    for (const st of S.steps) {
      if (st.word) lookup.set(st.word.vi, st.word);
      for (const w of st.pool || []) lookup.set(w.vi, w);
    }
    const sitLookup = new Map((lesson?.situations || []).map((x) => [x.vi, x]));
    const quizByText = new Map((lesson?.quiz || []).map((q) => [q.q, q]));
    const steps = [];
    for (const st of data.steps || []) {
      const out = { ...st };
      if (st.word !== undefined) {
        // A situation and a combo can share their Vietnamese (Xin lỗi em.), so situations are matched among situations.
        out.word = (st.sit && sitLookup.get(st.word)) || lookup.get(st.word);
        if (!out.word) continue;
      }
      if (st.pool) out.pool = st.pool.map((v) => lookup.get(v)).filter(Boolean);
      if (st.q !== undefined) {
        out.q = quizByText.get(st.q);
        if (!out.q) continue;
      }
      if (st.grammar) out.grammar = lesson?.grammar;
      steps.push(out);
    }
    if (!steps.length) return;
    S.steps = steps;
    S.i = Math.min(data.i || 0, steps.length - 1);
    if (S.steps[S.i].type === 'speed') S.i -= 1;
    S.events = data.events || [];
    S.known = new Set(data.known || []);
    S.met = new Set(data.met || []);
    S.started = data.started || Date.now();
    S.streak = data.streak || 0;
    S.bestStreak = data.bestStreak || 0;
    S.quiz = data.quiz || { correct: 0, total: 0 };
    S.readMs = data.readMs || 0;
    S.factsShown = data.factsShown || [];
    S.situations = data.situations || { correct: 0, total: 0 };
    S.dialogues = data.dialogues || { correct: 0, total: 0 };
    S.saved = data.saved || 0;
  }

  function payload(feedback) {
    const sum = summarise(S.events, scoredWords);
    return {
      events: S.events,
      startedAt: new Date(S.started).toISOString(),
      finishedAt: new Date().toISOString(),
      durationSec: Math.round((Date.now() - S.started) / 1000),
      known: [...S.known],
      speed: S.speed,
      summary: sum,
      bestStreak: S.bestStreak,
      quiz: S.quiz,
      article: lesson ? { readSec: Math.round(S.readMs / 1000), factsShown: S.factsShown.length } : null,
      grade: gradeFor(sum.firstTryAccuracy),
      progress: { step: S.i, steps: S.steps.length },
      situations: S.situations,
      dialogues: S.dialogues,
      ...(S.saved ? { savedDong: S.saved } : {}),
      timing: timing(),
      relaxed: Boolean(session.relaxed),
      feedback,
    };
  }

  root.innerHTML = `
    <div class="session">
      <header class="session-bar">
        <button class="icon-btn" data-act="quit" aria-label="Close">&times;</button>
        <button class="icon-btn back-btn" data-act="back" aria-label="Back to the last word card or story" hidden>&lsaquo;</button>
        <div class="progress" role="progressbar" aria-label="Progress"><div class="fill"></div></div>
        <div class="streak-pill" aria-live="polite"></div>
        ${session.talk ? '<button class="talk-btn" data-act="talk" aria-label="Ask a question out loud"><svg class="mic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg><span>Ask a question</span></button>' : ''}
      </header>
      <main class="stage" aria-live="polite"></main>
      <div class="fact-card" role="status"></div>
    </div>`;
  const sessionEl = root.querySelector('.session');
  // What is on screen, in more detail, for a live conversation with the editors.
  function talkContext() {
    const step = S.steps[S.i] || {};
    const w = step.word;
    const lines = [lesson ? `In issue ${lesson.number}, "${lesson.title}" (${lesson.theme || ''}), on a ${step.type || 'screen'} screen.` : `In a spaced review, on a ${step.type || 'screen'} screen.`];
    if (w && !w.sit) lines.push(`The word on screen: ${w.vi} (${w.en})${w.hook ? `. Hook: ${w.hook}` : ''}${w.note ? ` Note: ${w.note}` : ''}`);
    if (w && w.sit && !step.dialogue) lines.push(`The real-life line on screen: ${w.say ? `the learner must say ${w.say}; the model answer is ${w.vi}` : `${w.vi} (${w.en})`}. Question: ${w.ask}`);
    if (step.beat) lines.push(`The story beat on screen: ${step.beat.text}`);
    if (step.dialogue) lines.push(`The dialogue on screen, "${step.dialogue.title}": ${step.dialogue.lines.map((l) => `${l.who}: ${l.vi} (${l.en})`).join(' / ')}. Then the learner picks what to say: ${step.dialogue.check.ask}`);
    if (lesson) {
      lines.push(`This issue's new words: ${lesson.words.map((x) => `${x.vi} (${x.en})`).join(', ')}.`);
      if (lesson.grammar) lines.push(`This issue's sentence frame: ${lesson.grammar.title}`);
      if (lesson.feature) lines.push(`This issue's story: ${lesson.feature.title}. ${lesson.feature.intro}`);
    }
    return lines.join('\n');
  }
  const stage = root.querySelector('.stage');
  const fill = root.querySelector('.fill');
  const backBtn = root.querySelector('.back-btn');
  // Screens the learner can step back to and read again; questions are not replayed.
  const PEEK = new Set(['feature', 'story', 'meet', 'grammar', 'stage']);
  function prevPeek(i) {
    for (let j = i - 1; j >= 0; j--) if (PEEK.has(S.steps[j].type)) return j;
    return -1;
  }
  const streakEl = root.querySelector('.streak-pill');
  const factEl = root.querySelector('.fact-card');
  let factTimer;

  function showStreak() {
    streakEl.textContent = S.streak >= 2 ? `${S.streak} in a row` : '';
    streakEl.classList.toggle('hot', S.streak >= HOT_STREAK);
  }

  function right() {
    S.streak += 1;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    showStreak();
  }

  function wrong() {
    S.streak = 0;
    showStreak();
  }

  function record(e) {
    S.events.push({ ...e, ms: Date.now() - S.stepStart, at: Date.now() - S.started, plays: S.plays || undefined });
    snapshot();
  }

  // Time spent per phase and long pauses, from the recorded events.
  function timing() {
    const by = {};
    for (const e of S.events) {
      const phase = e.t === 'meet' || e.t === 'known' ? 'words' : e.warmup ? 'warmup' : e.t === 'speed' ? 'rush' : e.t === 'quiz' ? 'quiz' : e.t === 'situation' || e.t === 'say' ? 'reallife' : e.t === 'dialogue' ? 'conversation' : 'drills';
      by[phase] = (by[phase] || 0) + (e.ms || 0);
    }
    const gaps = [];
    for (let i = 1; i < S.events.length; i++) gaps.push((S.events[i].at || 0) - (S.events[i - 1].at || 0));
    const out = {};
    for (const [k, v] of Object.entries(by)) out[k] = Math.round(v / 1000);
    out.article = Math.round(S.readMs / 1000);
    out.pauses = gaps.filter((g) => g > 60000).length;
    out.longestPauseSec = gaps.length ? Math.round(Math.max(...gaps) / 1000) : 0;
    return out;
  }

  function insertRetry(step) {
    if (step.retry || step.warmup) return;
    let end = S.i + 1;
    while (end < S.steps.length && !BOUNDARIES.has(S.steps[end].type)) end++;
    const at = Math.min(S.i + 4, end);
    S.steps.splice(at, 0, { ...step, retry: true });
  }

  function next() {
    clearInterval(S.timer);
    const cur = S.steps[S.i];
    if (cur?.type === 'feature') S.readMs = Date.now() - S.stepStart;
    if (S.returnTo != null) {
      S.i = S.returnTo;
      S.returnTo = null;
      render();
      return;
    }
    if (cur?.type === 'story') S.events.push({ t: 'story', w: cur.word?.vi, ms: Date.now() - S.stepStart, at: Date.now() - S.started });
    if (cur?.type === 'meet') S.events.push({ t: 'meet', w: cur.word.vi, ms: Date.now() - S.stepStart, at: Date.now() - S.started, plays: S.plays || undefined });
    S.i += 1;
    render();
  }

  function cleanup() {
    clearInterval(S.timer);
    clearTimeout(factTimer);
    document.removeEventListener('keydown', onKey);
    stop();
  }

  function finish(feedback) {
    cleanup();
    if (saveKey) localStorage.removeItem(saveKey);
    onDone(payload(feedback));
  }

  function render() {
    const step = S.steps[S.i];
    S.answered = false;
    S.plays = 0;
    S.stepStart = Date.now();
    clearInterval(S.timer);
    const total = S.steps.filter((s) => s.type !== 'results' && s.type !== 'feedback').length;
    fill.style.width = `${Math.min(100, (S.i / total) * 100)}%`;
    stage.dataset.step = step.type;
    stage.className = `stage step-${step.type}${step.warmup ? ' is-warmup' : ''}`;
    if (!SCORED.has(step.type) && step.type !== 'speed') factEl.classList.remove('show');
    if (step.word && step.type !== 'meet' && !step.warmup) S.met.add(nfc(step.word.vi));
    RENDER[step.type](step);
    if (S.returnTo != null) stage.querySelectorAll('[data-act=next]').forEach((b) => (b.textContent = 'Back to where I was'));
    backBtn.hidden = prevPeek(S.i) < 0 || ['speed', 'speedIntro', 'results', 'feedback'].includes(step.type);
    window.scrollTo(0, 0);
    snapshot();
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
    stage.innerHTML = `
      <div class="kicker">${esc(prompt)}${step.retry ? ' <span class="tag">again</span>' : ''}${step.warmup ? ' <span class="tag">warm-up</span>' : ''}</div>
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
        record({ t: step.type, w: step.word.vi, ok, a: chosen[key], retry: Boolean(step.retry) || undefined, combo: step.combo || undefined, warmup: step.warmup || undefined });
        markOptions(chosen[key], step.word[key]);
        flash(ok);
        if (ok) right();
        else {
          wrong();
          insertRetry(step);
        }
        stage.querySelector('.feedback-slot').innerHTML = after(ok, chosen);
        if (!autoplay || !ok) play(step.word.vi);
        showNext();
      }),
    );
  }

  const RENDER = {
    feature() {
      const f = lesson.feature || {};
      const { intro, beats } = storyParts(lesson);
      const meta = [`${lesson.words.length} new words`, lesson.warmup?.length ? `a warm-up of ${lesson.warmup.length}` : '', lesson.situations?.length ? `${lesson.situations.length} real-life moments` : '', 'Rush hour'].filter(Boolean).join(' · ');
      stage.innerHTML = `
        <article class="feature">
          ${lesson.cover?.picture ? `<figure class="cover-art">${picture(lesson.cover.picture)}</figure>` : ''}
          <div class="kicker">Issue ${esc(lesson.number)} · ${esc(f.kicker || lesson.theme || '')}</div>
          <h1 class="feature-title">${esc(f.title || lesson.title)}</h1>
          ${f.dek ? `<p class="dek">${esc(f.dek)}</p>` : ''}
          <div class="feature-body"><p class="first">${esc(intro)}</p></div>
          ${beats.length ? `<p class="hint">The story continues as you learn the words.</p>` : ''}
          <div class="issue-meta"><div class="label">In this issue</div><p><b>${esc(lesson.title)}</b> <span class="vi">${colorize(lesson.vi)}</span><br>${esc(meta)}</p></div>
        </article>
        ${footer('<button class="btn primary" data-act="next">Begin</button>')}`;
    },

    story(step) {
      const b = step.beat;
      const w = step.word;
      stage.innerHTML = `
        <article class="story">
          <div class="kicker">${esc(lesson?.feature?.kicker || 'The story')} · continued</div>
          ${w ? `<div class="story-word"><span class="vi">${colorize(w.vi)}</span> <span class="story-gloss">${esc(w.en)}</span></div>` : ''}
          ${b.picture ? pic(b, 'medium') : ''}
          ${b.title ? `<h2 class="story-title">${esc(b.title)}</h2>` : ''}
          <p class="story-text">${esc(b.text)}</p>
        </article>
        ${footer('<button class="btn primary" data-act="next">Continue</button>')}`;
    },

    quiz(step) {
      const q = step.q;
      const opts = q.options.map((text, i) => ({ text, i }));
      stage.innerHTML = `
        <div class="kicker">Quiz · ${step.n} of ${step.of}</div>
        <h2 class="quiz-q">${esc(q.q)}</h2>
        <div class="options quiz-options">${opts.map((o) => `<button type="button" class="opt" data-i="${o.i}" data-key="${o.i}"><span class="opt-n">${String.fromCharCode(65 + o.i)}</span><span class="opt-label">${esc(o.text)}</span></button>`).join('')}</div>
        <div class="feedback-slot"></div>
        ${footer('')}`;
      stage.querySelectorAll('.opt').forEach((b) =>
        b.addEventListener('click', () => {
          if (S.answered) return;
          S.answered = true;
          const i = Number(b.dataset.i);
          const ok = i === q.answer;
          S.quiz.total += 1;
          if (ok) S.quiz.correct += 1;
          record({ t: 'quiz', w: `quiz-${step.n}`, ok, a: q.options[i] });
          markOptions(String(i), String(q.answer));
          flash(ok);
          stage.querySelector('.feedback-slot').innerHTML = `<div class="verdict ${ok ? 'ok' : 'no'}">${ok ? 'Right.' : `It is ${esc(q.options[q.answer])}.`}</div><p class="explain">${esc(q.explain || '')}</p>`;
          showNext(step.n === step.of ? 'On to the words' : 'Next question');
        }),
      );
    },

    reviewIntro() {
      stage.innerHTML = `
        <div class="kicker">Review</div>
        <h1 class="feature-title">Bring them back</h1>
        <p class="dek">${words.length} word${words.length === 1 ? '' : 's'} due today. Each one you remember waits a little longer before it comes back: one day, three, a week, a month.</p>
        ${footer('<button class="btn primary" data-act="next">Start</button>')}`;
    },

    meet(step) {
      const w = step.word;
      S.met.add(nfc(w.vi));
      stage.innerHTML = `
        <div class="kicker">New word · ${step.n} of ${step.of}</div>
        <div class="card meet-card">
          ${pic(w, 'large')}
          <div class="big vi">${colorize(w.vi)}</div>
          ${toneBadges(w.vi)}
          <div class="meaning">${esc(w.en)}</div>
          ${w.note ? `<div class="note">${esc(w.note)}</div>` : ''}
          <div class="row center">${sayButton(w.vi, 'Play')} ${sayButton(w.vi, 'Slow', 'slow')}</div>
          <div class="meet-notes">
            ${w.hook ? `<div class="hook"><div class="label">Memory hook</div>${esc(w.hook)}</div>` : ''}
            ${w.tip ? `<div class="tip"><div class="label">Say it</div>${esc(w.tip)}</div>` : ''}
          </div>
          ${w.fact ? `<aside class="did-you-know"><div class="label">Did you know</div>${esc(w.fact)}</aside>` : ''}
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
        prompt: step.combo ? 'In context: what does this mean?' : 'What does this mean?',
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
      if (step.tiles) return RENDER.tiles(step);
      const w = step.word;
      const dict = Boolean(step.dictation);
      let hints = 0;
      let keys = 0;
      stage.innerHTML = `
        <div class="kicker">${dict ? 'Type what you hear' : 'Type it in Vietnamese'}${step.retry ? ' <span class="tag">again</span>' : ''}</div>
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
      let firstKey = null;
      let deletes = 0;
      let revealed = false;
      input.addEventListener('input', (ev) => {
        if (firstKey === null) firstKey = Date.now() - S.stepStart;
        if (ev.inputType && ev.inputType.startsWith('delete')) deletes += 1;
      });
      const hintBtn = stage.querySelector('[data-act=hint]');
      hintBtn.addEventListener('click', () => {
        hints += 1;
        const skeleton = nfc(w.vi)
          .split(' ')
          .map((syl) => [...syl.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')].map((c) => (/[aeiouy]/i.test(c) ? '_' : c)).join(''))
          .join('  ');
        let text;
        if (hints === 1) text = dict ? `It means: <b>${esc(w.en)}</b>` : w.hook ? `<span class="label">Memory hook</span>${esc(maskWord(w.hook, w.vi))}` : `It starts with <b class="vi">${esc(nfc(w.vi)[0])}</b>`;
        else if (hints === 2) text = `<span class="label">Consonants</span><b class="vi skeleton">${esc(skeleton)}</b>`;
        else {
          revealed = true;
          text = `<span class="label">The answer</span><b class="vi big-hint">${colorize(w.vi)}</b> Type it in to continue.`;
          play(w.vi);
        }
        stage.querySelector('.hint-slot').innerHTML = `<div class="hint">${text}</div>`;
        hintBtn.textContent = hints === 1 ? 'Another hint' : hints === 2 ? 'Show me' : 'Shown';
        if (hints >= 3) hintBtn.disabled = true;
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
        const close = g === 'tone' || g === 'marks' || g === 'sound';
        const ok = !revealed && (g === 'perfect' || (session.relaxed && close));
        record({
          t: 'type',
          w: w.vi,
          g,
          ok,
          a: nfc(answer).trim().slice(0, 60),
          hints,
          keys,
          firstKeyMs: firstKey ?? undefined,
          deletes: deletes || undefined,
          revealed: revealed || undefined,
          dictation: dict || undefined,
          retry: Boolean(step.retry) || undefined,
        });
        flash(ok);
        if (ok) right();
        else {
          wrong();
          if (g === 'wrong' || revealed) insertRetry({ ...step, tiles: true });
        }
        const relaxedMsg = { tone: 'Right. Mind the tone mark:', marks: 'Right. With the marks it is written:', sound: 'Right, that is how it sounds in Hà Nội. It is spelled:' };
        const msg = revealed ? 'Typed from the answer. It will come back later.' : ok && close ? relaxedMsg[g] : {
          perfect: hints ? 'Correct, with a hint.' : 'Perfect.',
          tone: 'Right letters, wrong or missing tone. Look at the mark:',
          marks: 'Right letters. With the marks it is written:',
          sound: 'That sounds right in Hà Nội, but it is spelled:',
          wrong: 'Not quite. It is:',
        }[g];
        stage.classList.add('answered', `graded-${ok ? 'perfect' : g}`);
        stage.querySelector('.feedback-slot').innerHTML = `<div class="verdict">${esc(msg)}</div>${answerBox(w)}`;
        play(w.vi);
        const btn = stage.querySelector('[data-act=check]');
        btn.textContent = 'Continue';
        btn.focus({ preventScroll: true });
      });
    },

    situation(step) {
      const sit = step.word;
      const digits = !sit.options && sit.digits;
      // Options are shuffled each time, so the answer's position gives nothing away.
      const opts = sit.options ? shuffle(sit.options) : [];
      stage.innerHTML = `
        <div class="kicker">Real life${sit.who ? ` · ${esc(sit.who)}` : ''}</div>
        ${pic(sit, 'medium')}
        ${listenTop(sit.vi)}
        <h2 class="quiz-q">${esc(sit.ask)}</h2>
        ${
          digits
            ? `<form class="digits-form" autocomplete="off" novalidate><input class="type-input digits-input" type="text" inputmode="numeric" placeholder="Type the number" aria-label="Your answer"><div class="row center helper-row"><button type="button" class="btn ghost small sit-hint">Hint</button></div><div class="hint-slot"></div><div class="feedback-slot"></div>${footer('<button type="submit" class="btn primary" data-act="check">Check</button>')}</form>`
            : `<div class="options">${opts.map((o, i) => `<button type="button" class="opt" data-i="${i}" data-key="${esc(o)}"><span class="opt-n">${i + 1}</span><span class="opt-label">${esc(o)}</span></button>`).join('')}</div><div class="feedback-slot"></div>${footer('')}`
        }`;
      play(sit.vi);
      const price = sit.answer || `${String(sit.digits).replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}₫`;
      const spoken = /\p{L}/u.test(price);
      let hints = 0;
      const reveal = (ok, chosen) => {
        S.situations.total += 1;
        if (ok) S.situations.correct += 1;
        record({ t: 'situation', w: sit.vi, ok, a: chosen, ...(hints ? { hints } : {}) });
        flash(ok);
        if (ok) right();
        else wrong();
        const shown = spoken ? `<span class="vi">${colorize(price)}</span> ${sayButton(price, 'Hear it')}` : `${esc(price)}.`;
        stage.querySelector('.feedback-slot').innerHTML = `<div class="verdict ${ok ? 'ok' : 'no'}">${ok ? `Right: ${shown}` : `${spoken ? 'Better' : 'It was'}: ${shown}`}</div>
          <div class="answer-box transcript"><div class="label">What was said</div><div class="vi transcript-vi">${colorize(sit.vi)}</div><div class="transcript-en">${esc(sit.en)}</div><div class="row">${sayButton(sit.vi, 'Hear it again')} ${sayButton(sit.vi, 'Slow', 'slow')}</div>${sit.note ? `<p class="note">${esc(sit.note)}</p>` : ''}</div>`;
      };
      if (digits) {
        const form = stage.querySelector('.digits-form');
        const input = form.querySelector('input');
        input.focus({ preventScroll: true });
        form.querySelector('.sit-hint').addEventListener('click', (ev) => {
          hints += 1;
          ev.currentTarget.disabled = true;
          const said = nfc(sit.vi);
          const thousands = /\s(nghìn|triệu)/u.test(said);
          const split = thousands ? said.replace(/\s+(nghìn|triệu)/gu, ' · $1') : said;
          const how = thousands
            ? 'Split it at nghìn (thousand): the words before it count the thousands. Mười · nghìn is 10 × 1.000 = 10.000.'
            : 'No nghìn? Sellers usually leave it out, and the number still counts thousands: mười means 10.000. They often drop mươi too: hai lăm is 25.000. After trăm, one more number counts tens (trăm hai is 120.000), and rưỡi adds half of the unit before it.';
          form.querySelector('.hint-slot').innerHTML = `<div class="answer-box transcript hint-box"><div class="vi transcript-vi">${colorize(split)}</div><p class="note">${how}</p></div>`;
          input.focus({ preventScroll: true });
        });
        form.addEventListener('submit', (ev) => {
          ev.preventDefault();
          if (S.answered) {
            next();
            return;
          }
          const got = digitsOf(input.value);
          if (!got) return;
          S.answered = true;
          input.disabled = true;
          const want = String(sit.digits).replace(/[^0-9]/g, '');
          // Typing the price the way sellers say it (150 for 150.000) shows it was understood, so it counts.
          const short = want.endsWith('000') && `${got}000` === want;
          reveal(got === want || short, input.value.trim());
          if (short) stage.querySelector('.feedback-slot .verdict').insertAdjacentHTML('beforeend', ' <span class="short-note">You left out the thousands, just as sellers do.</span>');
          stage.querySelector('[data-act=check]').textContent = 'Continue';
        });
      } else {
        stage.querySelectorAll('.opt').forEach((b) =>
          b.addEventListener('click', () => {
            if (S.answered) return;
            S.answered = true;
            const chosen = opts[Number(b.dataset.i)];
            markOptions(chosen, sit.answer);
            reveal(chosen === sit.answer, chosen);
            if (spoken) play(price);
            showNext();
          }),
        );
      }
    },

    // Say the price: a price is shown and the learner types how a Hà Nội seller or buyer would say it.
    say(step) {
      const sit = step.word;
      const accept = sit.accept || [sit.vi];
      stage.innerHTML = `
        <div class="kicker">Say it${sit.who ? ` · ${esc(sit.who)}` : ''}</div>
        ${pic(sit, 'medium')}
        <div class="say-price${/[a-z]{3}/i.test(sit.say) ? ' say-cue' : ''}">${esc(sit.say)}</div>
        <h2 class="quiz-q">${esc(sit.ask)}</h2>
        <form class="type-form say-form" autocomplete="off">
          <input class="type-input vi" type="text" lang="vi" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="How you say it">
          <div class="vkeys" aria-label="Tone and vowel keys">
            <div class="vkeys-row">${TONE_KEYS.map((t) => `<button type="button" class="vkey tone-key t-${t}" data-key="${t}" aria-label="${esc(TONES[t].name)} tone">${contourSVG(t, { width: 26, height: 16 })}<span>${esc(TONES[t].sample)}</span></button>`).join('')}</div>
            <div class="vkeys-row">${VOWEL_KEYS.map((k) => `<button type="button" class="vkey" data-key="${k}">${k}</button>`).join('')}</div>
          </div>
          <div class="feedback-slot"></div>
          ${footer('<button type="submit" class="btn primary" data-act="check">Check</button>')}
        </form>`;
      const form = stage.querySelector('.say-form');
      const input = form.querySelector('.type-input');
      input.focus({ preventScroll: true });
      form.querySelectorAll('.vkey').forEach((k) =>
        k.addEventListener('click', () => {
          const pos = document.activeElement === input && input.selectionStart != null ? input.selectionStart : input.value.length;
          const r = applyKey(input.value, pos, k.dataset.key);
          input.value = r.text;
          input.focus({ preventScroll: true });
          input.setSelectionRange(r.cursor, r.cursor);
        }),
      );
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (S.answered) {
          next();
          return;
        }
        const answer = input.value;
        const { g: best, match } = gradeSay(answer, accept);
        if (best === 'empty') {
          input.focus();
          return;
        }
        S.answered = true;
        input.disabled = true;
        const close = best === 'tone' || best === 'marks' || best === 'sound';
        const ok = best === 'perfect' || (session.relaxed && close);
        S.situations.total += 1;
        if (ok) S.situations.correct += 1;
        record({ t: 'say', w: sit.say, g: best, ok, a: answer });
        if (ok && sit.saves) S.saved = (S.saved || 0) + sit.saves;
        flash(ok);
        if (ok) right();
        else wrong();
        const others = accept.filter((a) => a !== (ok ? match : accept[0])).slice(0, 2);
        form.classList.add('answered');
        stage.querySelector('.feedback-slot').innerHTML = `<div class="verdict ${ok ? 'ok' : 'no'}">${ok ? (best === 'perfect' ? 'Right:' : 'Right. With the marks:') : 'Say it like this:'} <span class="vi">${colorize(ok ? match : accept[0])}</span> ${sayButton(sit.vi, 'Hear it')}</div>${others.length ? `<p class="note">Also right: ${others.map((a) => `<span class="vi">${colorize(a)}</span>`).join(' · ')}</p>` : ''}${sit.note ? `<p class="note">${esc(sit.note)}</p>` : ''}`;
        const reply = sit.reply && (ok ? sit.reply : sit.replyMissed || sit.reply);
        if (reply) {
          stage.querySelector('.feedback-slot').insertAdjacentHTML('beforeend', `<div class="say-reply"><span class="who">${esc(reply.who || 'Seller')}</span> <span class="vi">${colorize(reply.vi)}</span> ${sayButton(reply.vi, 'Play')}<span class="en">${esc(reply.en)}</span>${ok && sit.saves ? `<span class="saved">${esc(sit.saves.toLocaleString('vi-VN'))}₫ off</span>` : ''}</div>`);
          playAll([sit.vi, reply.vi]);
        } else play(sit.vi);
        stage.querySelector('[data-act=check]').textContent = 'Continue';
        stage.querySelector('.feedback-slot').scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    },

    dialogue(step) {
      const d = step.dialogue;
      const where = d.setting === 'table' ? 'At the table' : d.setting === 'street' ? 'In the street' : '';
      const options = shuffle(d.check.options);
      stage.innerHTML = `
        <div class="kicker">Conversation${where ? ` · ${where}` : ''}</div>
        ${pic(d, 'medium')}
        <h2 class="quiz-q">${esc(d.title)}</h2>
        <div class="dialogue">${d.lines
          .map((l) => `<div class="line${l.you ? ' you' : ''}"><span class="who">${esc(l.who)}</span><button type="button" class="say mini line-say" data-say="${esc(l.vi)}" aria-label="Play this line">${SPEAKER}</button><span class="vi line-vi">${colorize(l.vi)}</span><span class="line-en" hidden>${esc(l.en)}</span></div>`)
          .join('')}</div>
        <div class="row center helper-row"><button type="button" class="btn ghost small" data-act="play-all">Play all</button><button type="button" class="btn ghost small" data-act="show-en">Show English</button></div>
        <h3 class="check-q">${esc(d.check.ask)}</h3>
        <div class="options">${options.map((o, i) => `<button type="button" class="opt" data-i="${i}" data-key="${esc(o)}"><span class="opt-n">${i + 1}</span><span class="opt-label vi">${colorize(o)}</span></button>`).join('')}</div>
        <div class="feedback-slot"></div>${footer('')}`;
      const lines = d.lines.map((l) => l.vi);
      stage.querySelector('[data-act=play-all]').addEventListener('click', () => {
        S.plays += 1;
        playAll(lines);
      });
      stage.querySelector('[data-act=show-en]').addEventListener('click', (ev) => {
        stage.querySelectorAll('.line-en').forEach((x) => (x.hidden = false));
        ev.currentTarget.disabled = true;
      });
      playAll(lines);
      stage.querySelectorAll('.opt').forEach((b) =>
        b.addEventListener('click', () => {
          if (S.answered) return;
          S.answered = true;
          const chosen = options[Number(b.dataset.i)];
          const ok = chosen === d.check.answer;
          markOptions(chosen, d.check.answer);
          S.dialogues.total += 1;
          if (ok) S.dialogues.correct += 1;
          record({ t: 'dialogue', w: d.title, ok, a: chosen });
          flash(ok);
          if (ok) right();
          else wrong();
          stage.querySelectorAll('.line-en').forEach((x) => (x.hidden = false));
          stage.querySelector('.feedback-slot').innerHTML = `<div class="verdict ${ok ? 'ok' : 'no'}">${ok ? 'Right: ' : 'Better: '}<span class="vi">${colorize(d.check.answer)}</span> ${sayButton(d.check.answer, 'Hear it')}</div>${d.check.note ? `<p class="note">${esc(d.check.note)}</p>` : ''}`;
          play(d.check.answer);
          showNext();
        }),
      );
    },

    tiles(step) {
      const w = step.word;
      const pieces = tilesFor(w.vi);
      const built = [];
      stage.innerHTML = `
        <div class="kicker">Build it from the pieces <span class="tag">again</span></div>
        ${pic(w, 'medium')}<div class="prompt-en">${esc(w.en)}</div>
        <div class="built vi" aria-live="polite">&nbsp;</div>
        <div class="tiles">${pieces.map((p, i) => `<button type="button" class="tile vi" data-i="${i}">${colorize(p)}</button>`).join('')}</div>
        <div class="row center helper-row"><button type="button" class="btn ghost small" data-act="undo">Undo</button><button type="button" class="btn ghost small" data-act="hear">Hear it</button></div>
        <div class="feedback-slot"></div>
        ${footer('<button type="button" class="btn primary" data-act="check">Check</button>')}`;
      const out = stage.querySelector('.built');
      const show = () => {
        out.innerHTML = built.length ? `<span>${colorize(built.map((i) => pieces[i]).join(' '))}</span>` : '&nbsp;';
        stage.querySelectorAll('.tile').forEach((t) => (t.disabled = built.includes(Number(t.dataset.i))));
      };
      stage.querySelectorAll('.tile').forEach((t) =>
        t.addEventListener('click', () => {
          if (S.answered) return;
          built.push(Number(t.dataset.i));
          play(pieces[Number(t.dataset.i)]);
          show();
        }),
      );
      stage.querySelector('[data-act=undo]').addEventListener('click', () => {
        built.pop();
        show();
      });
      stage.querySelector('[data-act=hear]').addEventListener('click', () => play(w.vi));
      stage.querySelector('[data-act=check]').addEventListener('click', () => {
        if (S.answered) {
          next();
          return;
        }
        if (!built.length) return;
        S.answered = true;
        const answer = built.map((i) => pieces[i]).join(' ');
        const g = grade(answer, w.vi);
        record({ t: 'type', w: w.vi, g, a: answer, tiles: true, retry: true });
        const ok = g === 'perfect';
        flash(ok);
        if (ok) right();
        else wrong();
        stage.classList.add('answered', `graded-${ok ? 'perfect' : 'wrong'}`);
        stage.querySelector('.feedback-slot').innerHTML = `<div class="verdict">${ok ? 'Perfect.' : 'Not quite. It is:'}</div>${answerBox(w)}`;
        play(w.vi);
        stage.querySelector('[data-act=check]').textContent = 'Continue';
      });
    },

    stage(step) {
      stage.innerHTML = `
        ${step.beat ? `<article class="story inline"><div class="kicker">${esc(lesson?.feature?.kicker || 'The story')} · continued</div>${step.beat.picture ? pic(step.beat, 'medium') : ''}${step.beat.title ? `<h2 class="story-title">${esc(step.beat.title)}</h2>` : ''}<p class="story-text">${esc(step.beat.text)}</p></article>` : ''}
        <div class="kicker">${lesson ? `Issue ${esc(lesson.number)}` : 'Review'}</div>
        <h2 class="title">${esc(step.title)}</h2>
        <p class="lead">${esc(step.text)}</p>
        ${footer('<button class="btn primary" data-act="next">Continue</button>')}`;
    },

    grammar(step) {
      const g = step.grammar;
      stage.innerHTML = `
        <div class="kicker">Grammar note</div>
        <h2 class="title">${esc(g.title)}</h2>
        <p class="lead">${esc(g.text)}</p>
        <div class="examples answer-box pairs">${(g.examples || [])
          .map((x) => `<div class="pair"><span class="vi pair-vi">${colorize(x.vi)}</span><span class="pair-en">${esc(x.en)}</span>${sayButton(x.vi, 'Play', 'mini')}</div>`)
          .join('')}</div>
        ${footer('<button class="btn primary" data-act="next">Try some</button>')}`;
    },

    speedIntro() {
      stage.innerHTML = `
        <div class="kicker">Last round</div>
        <h2 class="title vi">${colorize('Giờ cao điểm')}</h2>
        <p class="dek">Rush hour. ${session.testMode ? 4 : SPEED_SECONDS} seconds, everything from this issue, as fast as Hà Nội traffic. Answers in a row score double, triple, up to five times.</p>
        ${footer('<button class="btn primary" data-act="next">Go</button>')}`;
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
        next();
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
              sp.score += 10 * Math.min(sp.combo, 5);
            } else sp.combo = 0;
            stage.querySelector('.score').textContent = sp.score;
            stage.querySelector('.combo').textContent = sp.combo > 1 ? `×${Math.min(sp.combo, 5)}` : '';
            flash(ok);
            if (Date.now() < end) ask();
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

    results(step) {
      const sum = summarise(S.events, scoredWords);
      const pct = Math.round(sum.firstTryAccuracy * 100);
      const g = gradeFor(sum.firstTryAccuracy);
      const label = { distinction: 'With distinction', merit: 'With merit', complete: 'Complete' }[g];
      const dots = (n) => `<span class="mastery" aria-label="${n} of 3">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(3 - n)}</span>`;
      const missedWarmup = [...new Set(S.events.filter((e) => e.warmup && !e.ok).map((e) => e.w))];
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      stage.innerHTML = `
        <div class="results-head">
          ${lesson ? stampHTML(lesson, g, today) : ''}
          <div>
            <div class="kicker">${lesson ? `Issue ${esc(lesson.number)} complete` : 'Review complete'}</div>
            <h2 class="title">${esc(label)}</h2>
            <p class="lead">${lesson ? 'A new stamp for your passport.' : 'Each word you remembered now waits longer before it comes back.'}</p>
          </div>
        </div>
        <div class="stats">
          <div><b>${pct}%</b><span>first try</span></div>
          <div><b>${S.bestStreak}</b><span>best streak</span></div>
          ${S.quiz.total ? `<div><b>${S.quiz.correct}/${S.quiz.total}</b><span>quiz</span></div>` : ''}
          ${S.situations.total ? `<div><b>${S.situations.correct}/${S.situations.total}</b><span>real life</span></div>` : ''}
          ${S.dialogues.total ? `<div><b>${S.dialogues.correct}/${S.dialogues.total}</b><span>talk</span></div>` : ''}
          ${S.speed.answered ? `<div><b>${S.speed.score}</b><span>rush hour</span></div>` : ''}
          ${S.saved ? `<div><b>${esc(S.saved.toLocaleString('vi-VN'))}₫</b><span>haggled off</span></div>` : ''}
        </div>
        ${missedWarmup.length ? `<div class="note">Added to your reviews from the warm-up: <span class="vi">${missedWarmup.map((v) => colorize(v)).join(', ')}</span></div>` : ''}
        <div class="word-results">${sum.perWord
          .map((w) => `<button type="button" class="word-row" data-say="${esc(w.vi)}"><span class="vi">${colorize(w.vi)}</span><span class="en">${esc(w.en)}${S.known.has(w.vi) ? ' <span class="tag">known</span>' : ''}</span>${dots(w.stars)}</button>`)
          .join('')}</div>
        ${(step.beats || []).map((b) => `<article class="story inline"><div class="kicker">${esc(lesson?.feature?.kicker || 'The story')} · to finish</div>${b.picture ? pic(b, 'medium') : ''}${b.title ? `<h2 class="story-title">${esc(b.title)}</h2>` : ''}<p class="story-text">${esc(b.text)}</p></article>`).join('')}
        ${lesson?.challenge ? `<aside class="challenge"><div class="label">${esc(lesson.challenge.title || 'Challenge')}</div>${esc(lesson.challenge.text)}</aside>` : ''}
        ${lesson?.feature?.sources?.length ? `<details class="sources"><summary>Sources for this issue</summary><ul>${lesson.feature.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join('')}</ul></details>` : ''}
        ${footer('<button class="btn primary" data-act="next">Continue</button>')}`;
    },

    feedback() {
      const sum = summarise(S.events, scoredWords);
      const hard = new Set(sum.perWord.filter((w) => w.stars < 2 && !S.known.has(w.vi)).map((w) => w.vi));
      const seg = (name, values) =>
        `<div class="seg" data-name="${name}">${values.map((v) => `<button type="button" class="seg-btn" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
      stage.innerHTML = `
        <h2 class="title">How was this issue?</h2>
        <p class="lead">Your answers shape the next one.</p>
        <form class="feedback-form">
          <label class="field-label">Difficulty</label>
          ${seg('difficulty', ['Too easy', 'Just right', 'Too hard'])}
          <label class="field-label">Fun</label>
          ${seg('fun', ['Boring', 'OK', 'Good', 'Fun', 'Loved it'])}
          ${lesson ? `<label class="field-label">The article</label>${seg('article', ['Skipped it', 'OK', 'Interesting', 'Loved it'])}` : ''}
          <label class="field-label">Hardest words</label>
          <div class="chips">${scoredWords
            .map((w) => `<button type="button" class="chip ${hard.has(w.vi) ? 'on' : ''}" data-vi="${esc(w.vi)}"><span class="vi">${colorize(w.vi)}</span></button>`)
            .join('')}</div>
          <label class="field-label" for="want-next">What would you like next: words, history, culture?</label>
          <textarea id="want-next" name="wantNext" rows="2" placeholder="For example: family words, Tết, the Old Quarter, slang"></textarea>
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
        article: form.querySelector('[data-name=article] .on')?.dataset.v || null,
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
    if (ev.target.matches('input, textarea') || document.querySelector('.talk-sheet')) return;
    const k = ev.key.toLowerCase();
    const n = Number(k) || (k.length === 1 && k >= 'a' && k <= 'd' && stage.dataset.step === 'quiz' ? k.charCodeAt(0) - 96 : 0);
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
    if (ev.target.closest('.fact-close')) {
      factEl.classList.remove('show');
      return;
    }
    const say = ev.target.closest('[data-say]');
    if (say) {
      if (!S.answered) S.plays += 1;
      play(say.dataset.say, { slow: say.classList.contains('slow') });
      return;
    }
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'talk') {
      session.talk(talkContext());
      return;
    }
    if (act === 'back') {
      const to = prevPeek(S.i);
      if (to < 0) return;
      clearInterval(S.timer);
      if (S.returnTo == null) S.returnTo = S.answered ? S.i + 1 : S.i;
      S.i = to;
      render();
      return;
    }
    if (act === 'next') next();
    else if (act === 'quit') {
      if (saveKey) {
        snapshot();
        cleanup();
        onQuit(payload(null));
      } else if (confirm('Leave now? Answers from this review will not be saved.')) {
        cleanup();
        onQuit(null);
      }
    }
  });
  document.addEventListener('keydown', onKey);
  if (session.resume) restore(session.resume);
  if (session.jumpTo) {
    const at = S.steps.findIndex((s) => s.type === session.jumpTo);
    if (at > 0) S.i = at;
  }
  showStreak();
  render();
  return cleanup;
}

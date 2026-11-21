// Prints how issues play: answers before rush hour and where each story beat lands.
//   node scripts/plan.mjs              every issue, as text
//   node scripts/plan.mjs lesson-03    one issue
//   node scripts/plan.mjs --json ...   the same as JSON (used by check_lessons.py)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonSteps } from '../web/js/lesson.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(`${root}${p}`, 'utf8'));
const args = process.argv.slice(2);
const json = args.includes('--json');
const ids = args.filter((a) => !a.startsWith('--'));

const index = read('web/lessons/index.json').lessons;
const known = new Set(read('web/lessons/known.json').words.map((w) => w.normalize('NFC')));
const lessons = index.map((e) => read(`web/lessons/${e.file}`));
const words = new Map();
for (const l of lessons) for (const w of l.words) words.set(w.vi.normalize('NFC'), w);

const ANSWERS = new Set(['listen', 'spell', 'reverse', 'type', 'situation']);

function plan(lesson) {
  const review = (lesson.review || []).map((v) => words.get(v.normalize('NFC'))).filter((w) => w && !known.has(w.vi.normalize('NFC')));
  const steps = lessonSteps(lesson, { review, warmup: lesson.warmup || [] });
  const beats = lesson.feature?.beats || [];
  const placed = beats.map((b, i) => {
    const at = steps.findIndex((s) => s.beat === b || (s.beats || []).includes(b));
    const s = steps[at];
    const where = !s ? 'dropped' : s.type === 'story' ? `after meeting ${s.word.vi}` : s.type === 'stage' ? `on "${s.title}"` : 'on the results page';
    const answered = steps.slice(0, Math.max(at, 0)).filter((x) => ANSWERS.has(x.type)).length;
    return { beat: i, word: b.word || null, where, step: at + 1, answersBefore: answered };
  });
  const order = placed.map((p) => p.step);
  return {
    id: lesson.id,
    newWords: lesson.words.length,
    reviewWords: review.length,
    answers: steps.filter((s) => ANSWERS.has(s.type)).length,
    steps: steps.length,
    beats: placed,
    inOrder: order.every((v, i) => i === 0 || v >= order[i - 1]),
  };
}

const chosen = ids.length ? lessons.filter((l) => ids.includes(l.id)) : lessons;
const out = chosen.map(plan);
if (json) console.log(JSON.stringify(out, null, 1));
else {
  for (const p of out) {
    console.log(`${p.id}: ${p.newWords} new and ${p.reviewWords} review words, ${p.answers} answers before rush hour, ${p.steps} screens`);
    for (const b of p.beats) console.log(`  beat ${b.beat + 1}${b.word ? ` (${b.word})` : ''}: ${b.where}, after ${b.answersBefore} answers`);
    if (!p.inOrder) console.log('  the story plays out of order');
  }
}

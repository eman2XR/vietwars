import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lessonSteps, reviewSteps, summarise, gradeFor, stampHTML } from '../web/js/lesson.js';
import { picture, PICTURE_KINDS } from '../web/js/pictures.js';

const index = JSON.parse(readFileSync(new URL('../web/lessons/index.json', import.meta.url)));
const lessons = index.lessons.map((l) => JSON.parse(readFileSync(new URL(`../web/lessons/${l.file}`, import.meta.url))));

test('every lesson builds a full issue', () => {
  for (const lesson of lessons) {
    const review = [{ vi: 'xx', en: 'review word' }];
    const steps = lessonSteps(lesson, { review, warmup: lesson.warmup || [] });
    const types = steps.map((s) => s.type);
    assert.equal(types[0], 'feature');
    assert.deepEqual(types.slice(-4), ['speedIntro', 'speed', 'results', 'feedback']);
    for (const w of lesson.words) {
      for (const t of ['meet', 'listen', 'type']) {
        assert.ok(steps.some((s) => s.type === t && s.word.vi === w.vi), `${lesson.id} ${w.vi} has no ${t} step`);
      }
    }
    assert.ok(!steps.some((s) => s.type === 'meet' && s.word.vi === 'xx'), 'review words are not introduced again');
    assert.ok(steps.some((s) => s.type === 'listen' && s.word.vi === 'xx'), 'review words are heard');
    assert.ok(!steps.some((s) => s.type === 'type' && s.word.vi === 'xx'), 'review words are typed in the spaced reviews, not in issues');
    assert.equal(steps.filter((s) => s.warmup).length, (lesson.warmup || []).length);
    for (const s of steps.filter((x) => x.type === 'listen' || x.type === 'reverse')) {
      assert.ok(s.pool.some((p) => p.vi === s.word.vi), 'the answer is in its own option pool');
    }
  }
});

test('every lesson picture, cover and stamp draws', () => {
  for (const lesson of lessons) {
    const specs = [...lesson.words.map((w) => [w.vi, w.picture]), ['cover', lesson.cover?.picture], ['stamp', lesson.stamp?.picture]];
    for (const [name, spec] of specs) {
      if (!spec) continue;
      assert.ok(PICTURE_KINDS.includes(spec.kind), `${lesson.id} ${name}: unknown picture kind ${spec.kind}`);
      assert.ok(picture(spec).startsWith('<svg'), `${lesson.id} ${name}: picture did not draw`);
    }
    assert.ok(stampHTML(lesson, 'merit', '21 Nov 2026').includes('postmark'));
  }
});

test('story beats follow the words they are about', () => {
  for (const lesson of lessons) {
    const steps = lessonSteps(lesson, { warmup: lesson.warmup || [] });
    for (const b of lesson.feature?.beats || []) {
      const at = steps.findIndex((s) => s.type === 'story' && s.beat === b);
      if (b.word) {
        assert.ok(at > 0, `${lesson.id}: beat for ${b.word} was not placed`);
        const met = steps.findIndex((s) => s.type === 'meet' && s.word.vi === b.word);
        assert.ok(met >= 0 && met < at, `${lesson.id}: beat for ${b.word} comes before the word`);
      } else {
        assert.ok(steps.some((s) => s.beat === b || (s.beats || []).includes(b)), `${lesson.id}: a story beat was dropped`);
      }
    }
    const shown = steps.flatMap((s) => (s.beat ? [s.beat] : s.beats || []));
    assert.deepEqual(shown, lesson.feature?.beats || [], `${lesson.id}: the story must play in file order, each beat once`);
    assert.ok(!steps.some((s) => s.type === 'quiz'), `${lesson.id}: quizzes are retired`);
  }
});

test('grades follow first-try accuracy', () => {
  assert.equal(gradeFor(0.95), 'distinction');
  assert.equal(gradeFor(0.75), 'merit');
  assert.equal(gradeFor(0.4), 'complete');
});

test('reviews alternate typing from meaning and from hearing', () => {
  const words = [{ vi: 'a', en: 'A' }, { vi: 'b', en: 'B' }, { vi: 'c', en: 'C' }];
  const steps = reviewSteps(words, words);
  assert.equal(steps[0].type, 'reviewIntro');
  const typed = steps.filter((s) => s.type === 'type');
  assert.equal(typed.length, 3);
  assert.ok(typed.some((s) => s.dictation) && typed.some((s) => !s.dictation));
});

test('warm-up and retry answers are not counted as first tries', () => {
  const words = [{ vi: 'trăm', en: 'hundred' }];
  const events = [
    { t: 'listen', w: 'trăm', ok: true },
    { t: 'listen', w: 'trăm', ok: false, retry: true },
    { t: 'quiz', w: 'quiz-1', ok: false },
    { t: 'listen', w: 'một', ok: false, warmup: true },
    { t: 'type', w: 'trăm', g: 'tone' },
    { t: 'spell', w: 'trăm', ok: false },
  ];
  const s = summarise(events, words);
  assert.equal(s.exercises, 3);
  assert.equal(s.perWord[0].meaning, 1);
  assert.equal(s.perWord[0].form, 0.25);
  assert.equal(s.perWord[0].share, 0.5);
});

import { maskWord } from '../web/js/lesson.js';

test('hints never show the answer', () => {
  assert.equal(maskWord('Ten cows say mười and sigh: Mười!', 'mười'), 'Ten cows say ____ and sigh: ____!');
  assert.equal(maskWord('You ask bao nhiêu, keeping it flat.', 'bao nhiêu'), 'You ask ___ _____, keeping it flat.');
  assert.equal(maskWord('No answer here.', 'phở'), 'No answer here.');
});

import { digitsOf } from '../web/js/lesson.js';

test('typed prices accept separators and k shorthand', () => {
  assert.equal(digitsOf('25000'), '25000');
  assert.equal(digitsOf('25.000'), '25000');
  assert.equal(digitsOf('25,000 '), '25000');
  assert.equal(digitsOf('25k'), '25000');
  assert.equal(digitsOf('105K'), '105000');
  assert.equal(digitsOf('1.5k'), '1500');
  assert.equal(digitsOf(''), '');
});

test('a conversation plays after the combos and before real life, with its answer among the options', () => {
  const base = lessons[lessons.length - 1];
  const dialogue = {
    title: 'Dinner',
    setting: 'table',
    lines: [{ who: 'Bà', vi: 'Ăn đi cháu!', en: 'Eat up!' }, { who: 'Anh', vi: 'Vâng ạ.', en: 'Yes.', you: true }],
    check: { ask: 'You are full.', options: ['Cháu no rồi ạ.', 'Cháu đói.'], answer: 'Cháu no rồi ạ.' },
  };
  const lesson = { ...base, dialogues: [dialogue] };
  const steps = lessonSteps(lesson, { warmup: lesson.warmup || [] });
  const at = steps.findIndex((s) => s.type === 'dialogue');
  assert.ok(at > 0, 'the dialogue is placed');
  const lastCombo = steps.map((s) => s.combo).lastIndexOf(true);
  const firstSituation = steps.findIndex((s) => s.type === 'situation');
  assert.ok(lastCombo < at, 'after the combos');
  if (firstSituation >= 0) assert.ok(at < firstSituation, 'before real life');
  assert.ok(steps[at].dialogue.check.options.includes(steps[at].dialogue.check.answer));
  assert.equal(steps[at - 1].type === 'stage' || steps[at - 1].type === 'story', true, 'introduced by the Conversation screen');
});

import { buildDeck } from '../web/js/deck.js';

test('the review deck replays results in order, the same on every device', () => {
  const at = '2026-11-22T10:00:00.000Z';
  const later = '2026-11-23T10:00:00.000Z';
  const results = [
    { kind: 'review', finishedAt: later, words: [{ vi: 'trăm', share: 1 }] },
    { kind: 'lesson', lessonId: 'lesson-02', finishedAt: at, words: [{ vi: 'trăm', share: 1 }, { vi: 'nghìn', share: 0.5 }, { vi: 'phở', share: 0 }], warmup: [{ vi: 'ba', ok: false }] },
    { kind: 'lesson', lessonId: 'lesson-02', finishedAt: at, partial: true, words: [{ vi: 'mươi', share: 0 }] },
  ];
  const deck = buildDeck(results, { siteKnown: ['phở'] });
  assert.deepEqual(Object.keys(deck).sort(), ['ba', 'nghìn', 'trăm'], 'known and partial words stay out');
  assert.equal(deck['nghìn'].box, 0, 'a missed word comes back soon');
  assert.equal(deck['trăm'].box, 3, 'easy in the lesson (box 2), then good in the review a day later (box 3)');
  assert.equal(deck['ba'].box, 0, 'a missed warm-up word joins the deck');
});

import { gradeSay } from '../web/js/lesson.js';

test('a spoken price counts in any accepted form, and the closest form is shown', () => {
  const accept = ['hai mươi lăm nghìn', 'hai lăm nghìn', 'hai nhăm'];
  assert.deepEqual(gradeSay('hai lăm nghìn', accept), { g: 'perfect', match: 'hai lăm nghìn' });
  assert.equal(gradeSay('hai nham', accept).g, 'marks');
  assert.equal(gradeSay('hai nham', accept).match, 'hai nhăm');
  assert.equal(gradeSay('ba mươi', accept).g, 'wrong');
  assert.equal(gradeSay('  ', accept).g, 'empty');
  assert.equal(gradeSay('Hai mươi được không em?', ['Hai mươi được không?']).g, 'perfect', 'a polite ending is optional');
  assert.equal(gradeSay('Hai mươi được không?', ['Hai mươi được không em ạ?']).g, 'perfect');
  assert.equal(gradeSay('hai muoi duoc khong a', ['Hai mươi được không?']).g, 'marks');
  assert.equal(gradeSay('hai lam douc khong', ['Hai lăm được không?']).g, 'sound', 'a one-letter slip is said right');
  assert.equal(gradeSay('hai muoi douc khong', ['Hai mươi một nải được không?']).g, 'wrong', 'a missing word is not');
});

test('a say question becomes its own step in real life', () => {
  const base = lessons[lessons.length - 1];
  const say = { say: '25.000₫', vi: 'hai lăm nghìn', accept: ['hai lăm nghìn'], en: '25,000 dong', ask: 'How do you say it?' };
  const steps = lessonSteps({ ...base, situations: [...(base.situations || []).filter((s) => !s.say), say] }, { warmup: base.warmup || [] });
  assert.equal(steps.filter((s) => s.type === 'say').length, 1);
  assert.equal(steps.find((s) => s.type === 'say').word, say);
});

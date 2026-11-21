import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lessonSteps, reviewSteps, summarise } from '../web/js/lesson.js';
import { picture, PICTURE_KINDS } from '../web/js/pictures.js';
import { SPRITES } from '../web/js/sprites.js';

const index = JSON.parse(readFileSync(new URL('../web/lessons/index.json', import.meta.url)));
const lessons = index.lessons.map((l) => JSON.parse(readFileSync(new URL(`../web/lessons/${l.file}`, import.meta.url))));

test('every lesson builds a full battle', () => {
  for (const lesson of lessons) {
    const review = [{ vi: 'xx', en: 'review word' }];
    const steps = lessonSteps(lesson, { review, warmup: lesson.warmup || [] });
    const types = steps.map((s) => s.type);
    assert.equal(types[0], 'intro');
    assert.deepEqual(types.slice(-4), ['speedIntro', 'speed', 'results', 'feedback']);
    for (const w of lesson.words) {
      for (const t of ['meet', 'listen', 'type']) {
        assert.ok(steps.some((s) => s.type === t && s.word.vi === w.vi), `${lesson.id} ${w.vi} has no ${t} step`);
      }
    }
    assert.ok(!steps.some((s) => s.type === 'meet' && s.word.vi === 'xx'), 'review words are not introduced again');
    assert.ok(steps.some((s) => s.type === 'type' && s.word.vi === 'xx'), 'review words are typed');
    assert.equal(steps.filter((s) => s.warmup).length, (lesson.warmup || []).length);
    for (const s of steps.filter((x) => x.type === 'listen' || x.type === 'reverse')) {
      assert.ok(s.pool.some((p) => p.vi === s.word.vi), 'the answer is in its own option pool');
    }
  }
});

test('every lesson picture and foe drawing exists', () => {
  for (const lesson of lessons) {
    for (const w of lesson.words) {
      if (w.picture) {
        assert.ok(PICTURE_KINDS.includes(w.picture.kind), `${w.vi}: unknown picture kind ${w.picture.kind}`);
        assert.ok(picture(w.picture).startsWith('<svg'), `${w.vi}: picture did not draw`);
      }
    }
    if (lesson.foe) assert.ok(SPRITES[lesson.foe.art], `${lesson.id}: no drawing called ${lesson.foe.art}`);
  }
});

test('reviews alternate typing from meaning and from hearing', () => {
  const words = [{ vi: 'a', en: 'A' }, { vi: 'b', en: 'B' }, { vi: 'c', en: 'C' }];
  const steps = reviewSteps(words, words);
  const typed = steps.filter((s) => s.type === 'type');
  assert.equal(typed.length, 3);
  assert.ok(typed.some((s) => s.dictation) && typed.some((s) => !s.dictation));
});

test('warm-up, ambush and retry answers are not counted as first tries', () => {
  const words = [{ vi: 'trăm', en: 'hundred' }];
  const events = [
    { t: 'listen', w: 'trăm', ok: true },
    { t: 'listen', w: 'trăm', ok: false, retry: true },
    { t: 'listen', w: 'trăm', ok: false, ambush: true },
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

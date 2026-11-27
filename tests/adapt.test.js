import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { milestoneState, sayingWords, milestoneDates } from '../web/js/milestones.js';
import { confusions, mixupsFor, realLifeFor } from '../web/js/adapt.js';
import { reviewSteps, summarise } from '../web/js/lesson.js';

const MILESTONES = JSON.parse(readFileSync(new URL('../web/milestones.json', import.meta.url))).milestones;

test('milestones: the current rank, the next milestone and the progress towards it', () => {
  const s = milestoneState(92, MILESTONES);
  assert.deepEqual(s.earned.map((m) => m.words), [25, 50, 75]);
  assert.equal(s.rank.rank.vi, 'Sĩ tử', 'a milestone without a rank keeps the rank before it');
  assert.equal(s.next.words, 100);
  assert.equal(s.toNext, 8);
  assert.ok(s.progress > 0.6 && s.progress < 0.7);
  assert.equal(milestoneState(5, MILESTONES).rank, null);
  assert.equal(milestoneState(5000, MILESTONES).next, null);
  const words = MILESTONES.map((m) => m.words);
  assert.deepEqual(words, [...words].sort((a, b) => a - b), 'milestones rise');
});

test('a saying marks the words the learner knows, keeping its punctuation', () => {
  const parts = sayingWords('Trăm nghe không bằng một thấy.', ['trăm', 'không', 'một']);
  assert.deepEqual(parts.map((p) => p.known), [true, false, true, false, true, false]);
  assert.equal(parts[5].text, 'thấy.');
  const two = sayingWords('Ăn bánh mì đi.', ['bánh mì']);
  assert.deepEqual(two.map((p) => p.known), [false, true, true, false], 'a two-syllable word counts');
});

test('milestone dates come from the first result that reached them', () => {
  const dates = milestoneDates([{ at: 'd1', count: 20 }, { at: 'd2', count: 60 }, { at: 'd3', count: 80 }], MILESTONES);
  assert.deepEqual(dates, { 25: 'd2', 50: 'd2', 75: 'd3' });
});

const W = new Map([
  ['nấu', { vi: 'nấu', en: 'to cook' }],
  ['muốn', { vi: 'muốn', en: 'to want (to)' }],
  ['đói', { vi: 'đói', en: 'hungry' }],
  ['đẹp', { vi: 'đẹp', en: 'beautiful' }],
]);

test('mix-ups come from wrong meanings picked in listening and reverse, most frequent first', () => {
  const history = [
    { finishedAt: '2026-11-26T10:00:00Z', events: [{ t: 'listen', w: 'đói', ok: false, a: 'beautiful' }] },
    {
      finishedAt: '2026-11-27T10:00:00Z',
      events: [
        { t: 'listen', w: 'nấu', ok: false, a: 'to want (to)' },
        { t: 'reverse', w: 'muốn', ok: false, a: 'nấu' },
        { t: 'listen', w: 'nấu', ok: false, a: 'to want (to)', mixup: true, retry: true },
        { t: 'listen', w: 'đẹp', ok: true, a: 'beautiful' },
        { t: 'type', w: 'muốn', ok: false, a: 'nau' },
      ],
    },
  ];
  const pairs = confusions(history, W);
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].count, 2, 'nấu and muốn, both ways, counted as one pair; practice answers are left out');
  assert.deepEqual([pairs[0].a.vi, pairs[0].b.vi].sort(), ['muốn', 'nấu']);
  const due = [W.get('đẹp')];
  const now = Date.parse('2026-12-20T00:00:00Z');
  assert.deepEqual(mixupsFor(history, W, due, { now }).map((p) => p.a.vi), ['đói'], 'old pairs only when a word is due');
  assert.equal(mixupsFor(history, W, due, { now, known: new Set(['đẹp']) }).length, 0, 'known words are left out');
});

test('real life in a review: lines from played issues, missed ones first, none from the last review', () => {
  const lessons = [
    { id: 'a', situations: [{ vi: 'Ba nghìn.', options: ['3.000₫', '30.000₫'], answer: '3.000₫' }, { vi: 'Chào anh!', options: ['Hello', 'Bye'], answer: 'Hello' }, { vi: 'Hết rồi.', options: ['x', 'y'], answer: 'x' }] },
    { id: 'b', situations: [{ vi: 'Not played.', options: ['1', '2'], answer: '1' }] },
  ];
  const history = [
    { kind: 'lesson', lessonId: 'a', events: [{ t: 'situation', w: 'Hết rồi.', ok: false }, { t: 'situation', w: 'Chào anh!', ok: true }] },
    { kind: 'review', events: [{ t: 'situation', w: 'Ba nghìn.', ok: true }] },
  ];
  const picked = realLifeFor(history, lessons, { max: 2, random: () => 0 });
  assert.deepEqual(picked.map((s) => s.vi), ['Hết rồi.', 'Chào anh!']);
});

test('a review with mix-ups and real life: mix-up answers are practice, not first tries', () => {
  const due = [W.get('nấu'), W.get('đói')];
  const sit = { vi: 'Ba nghìn.', options: ['3.000₫', '30.000₫'], answer: '3.000₫' };
  const steps = reviewSteps(due, [...W.values()], { mixups: [{ a: W.get('nấu'), b: W.get('muốn') }], realLife: [sit] });
  const types = steps.map((s) => s.type);
  assert.ok(types.includes('mixup'));
  assert.equal(steps.filter((s) => s.mixup).length, 2);
  assert.ok(steps.filter((s) => s.mixup).every((s) => s.pool.length === 2));
  assert.equal(types.filter((t) => t === 'situation').length, 1);
  assert.deepEqual(types.slice(-2), ['results', 'feedback']);
  const { perWord } = summarise(
    [
      { t: 'listen', w: 'nấu', ok: true },
      { t: 'listen', w: 'nấu', ok: false, retry: true, mixup: true },
    ],
    due,
  );
  assert.equal(perWord.find((w) => w.vi === "nấu").share, 1);
});

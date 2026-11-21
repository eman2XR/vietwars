import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grade, syllableTone, tonesOf, telex, colorize, stripAll } from '../web/js/vi.js';
import { schedule, outcomeFor, dueWords, INTERVAL_DAYS } from '../web/js/srs.js';

test('detects each tone from its mark', () => {
  assert.deepEqual(tonesOf('ma mà má mả mã mạ'), ['ngang', 'huyen', 'sac', 'hoi', 'nga', 'nang']);
  assert.equal(syllableTone('nước'), 'sac');
  assert.equal(syllableTone('phở'), 'hoi');
  assert.equal(syllableTone('cơm'), 'ngang');
});

test('decomposed input is read the same as composed input', () => {
  assert.equal(grade('phở'.normalize('NFD'), 'phở'), 'perfect');
});

test('grades typed answers', () => {
  assert.equal(grade('phở', 'phở'), 'perfect');
  assert.equal(grade('  Phở ', 'phở'), 'perfect');
  assert.equal(grade('phờ', 'phở'), 'tone');
  assert.equal(grade('phố', 'phở'), 'marks');
  assert.equal(grade('pho', 'phở'), 'marks');
  assert.equal(grade('bun', 'bún'), 'tone');
  assert.equal(grade('cá', 'gà'), 'wrong');
  assert.equal(grade('', 'gà'), 'empty');
  assert.equal(grade('banh mi', 'bánh mì'), 'tone');
  assert.equal(grade('banhmi', 'bánh mì'), 'marks');
  assert.equal(grade('Ngon quá!', 'Ngon quá!'), 'perfect');
  assert.equal(grade('ngon qua', 'Ngon quá!'), 'tone');
});

test('accepts Telex typing', () => {
  assert.deepEqual(telex('phowr'), { base: 'phơ', tone: 'hoi' });
  assert.equal(grade('phowr', 'phở'), 'perfect');
  assert.equal(grade('nuwowcs', 'nước'), 'perfect');
  assert.equal(grade('banhs mif', 'bánh mì'), 'perfect');
  assert.equal(grade('caf phee', 'cà phê'), 'perfect');
  assert.equal(grade('raau', 'rau'), 'marks');
  assert.equal(grade('raau', 'râu'), 'perfect');
  assert.equal(grade('traf', 'trà'), 'perfect');
  assert.equal(grade('tras', 'trà'), 'tone');
});

test('colours syllables by tone and escapes text', () => {
  assert.equal(colorize('cà phê'), '<span class="t-huyen">cà</span> <span class="t-ngang">phê</span>');
  assert.equal(colorize('Ngon quá!'), '<span class="t-ngang">Ngon</span> <span class="t-sac">quá</span>!');
  assert.ok(!colorize('<b>').includes('<b>'));
  assert.equal(stripAll('đường'), 'duong');
});

test('spaced repetition moves words along the intervals', () => {
  const now = Date.UTC(2026, 10, 20, 12);
  const day = 86400000;
  let card = schedule({}, 'good', now);
  assert.equal(card.box, 1);
  assert.ok(card.due > now + day / 2 && card.due <= now + day);
  card = schedule(card, 'easy', now);
  assert.equal(card.box, 3);
  card = schedule(card, 'again', now);
  assert.equal(card.box, 0);
  assert.ok(card.due <= now + 15 * 60000);
  for (let i = 0; i < 20; i++) card = schedule(card, 'good', now);
  assert.equal(card.box, INTERVAL_DAYS.length - 1);
  assert.equal(outcomeFor(1), 'easy');
  assert.equal(outcomeFor(0.75), 'good');
  assert.equal(outcomeFor(0.4), 'again');
  assert.deepEqual(dueWords({ a: { due: now - 1 }, b: { due: now + day }, c: { due: now - 5 } }, now), ['c', 'a']);
});

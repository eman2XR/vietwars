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
  assert.equal(grade('cha', 'trà'), 'sound');
  assert.equal(grade('zau', 'rau'), 'wrong');
  assert.equal(grade('dau', 'rau'), 'sound');
  assert.equal(grade('xáu', 'sáu'), 'sound');
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

import { withTone, applyKey } from '../web/js/vi.js';

test('places tone marks on the right vowel', () => {
  const cases = [
    ['pho', 'hoi', 'phỏ'], ['phơ', 'hoi', 'phở'], ['nươc', 'sac', 'nước'], ['hai', 'hoi', 'hải'],
    ['mua', 'sac', 'múa'], ['qua', 'sac', 'quá'], ['gia', 'huyen', 'già'], ['toan', 'sac', 'toán'],
    ['nưa', 'nga', 'nữa'], ['nưa', 'hoi', 'nửa'], ['mot', 'nang', 'mọt'], ['môt', 'nang', 'một'],
    ['khuyên', 'sac', 'khuyến'], ['ngoai', 'huyen', 'ngoài'], ['bay', 'hoi', 'bảy'], ['phở', 'ngang', 'phơ'],
    ['muôi', 'nga', 'muỗi'], ['nhiêu', 'ngang', 'nhiêu'], ['hoa', 'huyen', 'hoà'],
  ];
  for (const [base, tone, want] of cases) assert.equal(withTone(base, tone), want, `${base} + ${tone}`);
});

test('on-screen keys change the syllable before the cursor', () => {
  let s = applyKey('pho', 3, 'ơ');
  assert.deepEqual(s, { text: 'phơ', cursor: 3 });
  s = applyKey(s.text, s.cursor, 'hoi');
  assert.equal(s.text, 'phở');
  s = applyKey(s.text, s.cursor, 'ơ');
  assert.equal(s.text, 'phỏ');
  assert.equal(applyKey('ca phe', 6, 'ê').text, 'ca phê');
  assert.equal(applyKey('ca phê', 2, 'huyen').text, 'cà phê');
  assert.equal(applyKey('nuoc', 4, 'ư').text, 'nưoc');
  assert.equal(applyKey('nưoc', 4, 'ơ').text, 'nươc');
  assert.equal(applyKey('nươc', 4, 'sac').text, 'nước');
  assert.equal(applyKey('dong', 4, 'đ').text, 'đong');
  assert.equal(applyKey('', 0, 'ư').text, 'ư');
  assert.equal(applyKey('', 0, 'sac').text, '');
});

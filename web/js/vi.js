// Vietnamese text helpers: tones, colouring and grading of typed answers.

const TONE_MARKS = {
  '\u0300': 'huyen',
  '\u0301': 'sac',
  '\u0309': 'hoi',
  '\u0303': 'nga',
  '\u0323': 'nang',
};
const TONE_MARK_RE = /[\u0300\u0301\u0309\u0303\u0323]/g;

// Contours use the Chao scale (1 low to 5 high) over normalised time; null marks the glottal break.
export const TONES = {
  ngang: { name: 'ngang', mark: 'no mark', feel: 'level', sample: 'a', contour: [[0, 3.3], [1, 3.3]] },
  huyen: { name: 'huyền', mark: 'grave', feel: 'low falling', sample: 'à', contour: [[0, 2.4], [1, 1.4]] },
  sac: { name: 'sắc', mark: 'acute', feel: 'rising', sample: 'á', contour: [[0, 3.2], [0.35, 3.3], [1, 4.9]] },
  hoi: { name: 'hỏi', mark: 'hook', feel: 'dipping', sample: 'ả', contour: [[0, 2.8], [0.55, 1.3], [0.85, 1.4], [1, 2.1]] },
  nga: { name: 'ngã', mark: 'tilde', feel: 'broken rising', sample: 'ã', contour: [[0, 3], [0.42, 3.3], null, [0.58, 3.6], [1, 5]] },
  nang: { name: 'nặng', mark: 'dot below', feel: 'heavy drop', sample: 'ạ', contour: [[0, 2.3], [0.55, 1.2]], stop: true },
};

export function nfc(s) {
  return String(s ?? '').normalize('NFC');
}

export function syllableTone(syl) {
  for (const ch of nfc(syl).normalize('NFD')) {
    if (TONE_MARKS[ch]) return TONE_MARKS[ch];
  }
  return 'ngang';
}

export function stripTone(s) {
  return nfc(s).normalize('NFD').replace(TONE_MARK_RE, '').normalize('NFC');
}

export function stripAll(s) {
  return nfc(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

export function tokens(s) {
  return nfc(s)
    .toLowerCase()
    .replace(/[.,!?;:"“”'’()…\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function tonesOf(s) {
  return tokens(s).map(syllableTone);
}

const TELEX_TONES = { s: 'sac', f: 'huyen', r: 'hoi', x: 'nga', j: 'nang' };

// Reads a plain ASCII token as Telex (for example "phowr" is "phở") and returns its base letters and tone.
export function telex(tok) {
  let t = tok;
  let tone = 'ngang';
  const last = t[t.length - 1];
  if (t.length > 1 && TELEX_TONES[last] && /[aeiouy]/.test(t.slice(0, -1))) {
    tone = TELEX_TONES[last];
    t = t.slice(0, -1);
  }
  t = t
    .replace(/dd/g, 'đ')
    .replace(/aa/g, 'â')
    .replace(/aw/g, 'ă')
    .replace(/ee/g, 'ê')
    .replace(/oo/g, 'ô')
    .replace(/uow/g, 'ươ')
    .replace(/ow/g, 'ơ')
    .replace(/uw/g, 'ư')
    .replace(/w/g, 'ư');
  return { base: t, tone };
}

function readings(tok) {
  const direct = { base: stripTone(tok), tone: syllableTone(tok) };
  if (/^[a-z]+$/.test(tok)) return [direct, telex(tok)];
  return [direct];
}

const RANK = { perfect: 3, tone: 2, marks: 1, wrong: 0 };

function gradeSyllable(answerTok, targetTok) {
  const target = { base: stripTone(targetTok), tone: syllableTone(targetTok) };
  let best = 'wrong';
  for (const r of readings(answerTok)) {
    let g = 'wrong';
    if (r.base === target.base && r.tone === target.tone) g = 'perfect';
    else if (r.base === target.base) g = 'tone';
    else if (stripAll(r.base) === stripAll(target.base)) g = 'marks';
    if (RANK[g] > RANK[best]) best = g;
  }
  return best;
}

// Grades a typed answer: perfect, tone (right letters and vowels, wrong tone), marks (right letters, missing or wrong marks), wrong or empty.
export function grade(answer, target) {
  const a = tokens(answer);
  const t = tokens(target);
  if (!a.length) return 'empty';
  if (a.length !== t.length) {
    return stripAll(a.join('')) === stripAll(t.join('')) ? 'marks' : 'wrong';
  }
  let worst = 'perfect';
  for (let i = 0; i < t.length; i++) {
    const g = gradeSyllable(a[i], t[i]);
    if (RANK[g] < RANK[worst]) worst = g;
  }
  return worst;
}

export function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Wraps each syllable in a span coloured by its tone.
export function colorize(s) {
  return nfc(s)
    .split(/(\s+)/)
    .map((part) => {
      if (!part.trim()) return part;
      const m = part.match(/^([^\p{L}]*)([\p{L}]+)([^\p{L}]*)$/u);
      if (!m) return escapeHTML(part);
      return `${escapeHTML(m[1])}<span class="t-${syllableTone(m[2])}">${escapeHTML(m[2])}</span>${escapeHTML(m[3])}`;
    })
    .join('');
}

export function contourSVG(tone, { width = 44, height = 26 } = {}) {
  const info = TONES[tone] || TONES.ngang;
  const pad = 3;
  const x = (v) => pad + v * (width - 2 * pad);
  const y = (v) => height - pad - ((v - 1) / 4) * (height - 2 * pad);
  const segments = [];
  let current = [];
  for (const p of info.contour) {
    if (p === null) {
      segments.push(current);
      current = [];
    } else {
      current.push(`${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`);
    }
  }
  segments.push(current);
  const paths = segments
    .filter((s) => s.length)
    .map((s) => `<polyline points="${s.join(' ')}" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('');
  let stop = '';
  if (info.stop) {
    const lastPt = info.contour[info.contour.length - 1];
    const sx = x(lastPt[0]) + 3;
    stop = `<line x1="${sx}" y1="${y(lastPt[1]) - 5}" x2="${sx}" y2="${y(lastPt[1]) + 5}" stroke-width="3" stroke-linecap="round"/>`;
  }
  const guide = `<line class="guide" x1="${pad}" y1="${y(3)}" x2="${width - pad}" y2="${y(3)}" stroke-width="1" stroke-dasharray="2 3"/>`;
  return `<svg class="contour t-${tone}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${guide}${paths}${stop}</svg>`;
}

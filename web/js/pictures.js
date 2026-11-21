// Pictures for words, diagrams and covers, drawn as inked editorial illustrations: a flat colour field, an irregular
// paper cut-out behind the subject, and bold ink lines with a slight dip-pen tremor. Colours come from the active style
// (see the --pic-* variables in style.css), so every picture works in all six styles and in dark mode.

const W = 120;
const H = 90;
let uid = 0;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// A seeded random generator, so each drawing comes out the same every time.
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const n1 = (v) => String(Math.round(v * 10) / 10);

// An irregular closed shape around an ellipse: the paper cut-out behind a subject.
export function blob(cx, cy, rx, ry, seed = 1, points = 9, jitter = 0.09) {
  const rnd = seeded(seed);
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
    const k = 1 + (rnd() * 2 - 1) * jitter;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    d += ` C${n1(p1[0] + (p2[0] - p0[0]) / 6)} ${n1(p1[1] + (p2[1] - p0[1]) / 6)} ${n1(p2[0] - (p3[0] - p1[0]) / 6)} ${n1(p2[1] - (p3[1] - p1[1]) / 6)} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return `${d} Z`;
}

// The dip-pen tremor: a fine noise that nudges every ink line a little.
function tremor(id, w, h, freq, scale) {
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="-12" y="-12" width="${w + 24}" height="${h + 24}"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${(uid % 7) + 2}" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
}

// A word picture: field, paper cut-out, inked drawing, then anything that must stay crisp (dots, numbers).
function card(ink, { tone = 'warm', paper, seed = 1, crisp = '' } = {}) {
  const id = `vw-ink-${++uid}`;
  const cut = paper === false ? '' : `<path class="k-carrier" d="${paper || blob(60, 46, 44, 33, seed)}"/>`;
  return `<svg class="pic ink-pic k-${tone}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${tremor(id, W, H, 0.09, 1.7)}</defs><rect class="k-field" x="0.5" y="0.5" width="119" height="89" rx="8"/>${cut}<g class="k-ink" stroke-width="2.5" filter="url(#${id})">${ink}</g>${crisp}</svg>`;
}

const steam = (xs, y, w = 1.8) => `<g stroke-width="${w}">${xs.map((x) => `<path d="M${x} ${y} c-4 -5 3 -8 0 -13 c-3 -5 3 -8 1 -12"/>`).join('')}</g>`;

const ICONS = {
  bowl: {
    tone: 'warm',
    seed: 3,
    ink: `${steam([44, 56], 31)}
      <path d="M70 40 L101 9"/><path d="M76 42 L106 14"/>
      <path class="k-tint" d="M23 44 C38 37 82 37 97 44 C82 50 38 50 23 44 Z"/>
      <path stroke-width="1.7" d="M37 43 q3 -3 7 -1 M58 41 q4 -2 7 0 M76 43 q3 -2 6 0"/>
      <path class="k-paper" d="M22 45 C24 62 40 73 60 73 C80 73 96 62 98 45 C82 51 38 51 22 45 Z"/>
      <path stroke-width="1.7" d="M32 58 C46 63 74 63 88 58"/>
      <path class="k-paper" d="M49 73 L47 79 H73 L71 73"/>`,
  },
  ricebowl: {
    tone: 'earth',
    seed: 5,
    ink: `<path class="k-paper" d="M27 45 C29 31 43 23 60 23 C77 23 91 31 93 45 Z"/>
      <g stroke-width="1.5"><path d="M45 33 l3 -1 M56 29 l3 1 M66 33 l3 -1 M51 40 l3 1 M73 39 l3 -1 M40 41 l3 -1 M61 37 l3 0 M80 42 l2 -1"/></g>
      <path class="k-tint" d="M21 45 C23 62 40 73 60 73 C80 73 97 62 99 45 Z"/>
      <path d="M19 45 H101"/>
      <path stroke-width="1.7" d="M30 56 C45 61 75 61 90 56"/>
      <path class="k-paper" d="M49 73 L47 79 H73 L71 73"/>`,
  },
  noodles: {
    tone: 'warm',
    seed: 7,
    ink: `<path class="k-paper" d="M12 58 C12 47 108 47 108 58 C108 69 12 69 12 58 Z"/>
      <path stroke-width="1.6" d="M24 58 C24 51 96 51 96 58"/>
      ${[[40, 54], [60, 51], [80, 54]].map(([x, y]) => `<path stroke-width="1.6" d="M${x - 11} ${y} C${x - 11} ${y - 7} ${x + 11} ${y - 7} ${x + 11} ${y} C${x + 11} ${y + 5} ${x - 9} ${y + 5} ${x - 9} ${y - 1} C${x - 9} ${y - 6} ${x + 8} ${y - 6} ${x + 8} ${y - 1} C${x + 8} ${y + 3} ${x - 6} ${y + 3} ${x - 6} ${y - 1}"/>`).join('')}
      <path class="k-tint" d="M86 41 C90 31 100 27 108 29 C106 38 98 43 86 41 Z"/><path stroke-width="1.4" d="M89 40 L104 31"/>`,
  },
  baguette: {
    tone: 'earth',
    seed: 9,
    ink: `<path class="k-tint" d="M13 62 C11 50 33 37 66 29 C92 23 109 29 107 40 C105 51 81 58 53 66 C31 72 15 72 13 62 Z"/>
      <g stroke-width="2"><path d="M36 50 q7 -5 14 -3"/><path d="M56 43 q7 -5 14 -3"/><path d="M76 37 q7 -5 14 -3"/></g>
      <path stroke-width="1.8" d="M24 66 C44 62 72 54 96 46"/>
      <path class="k-paper" stroke-width="1.5" d="M40 63 q2 -7 8 -6 q-1 6 -8 6 Z M62 57 q3 -7 9 -5 q-2 6 -9 5 Z M80 51 q3 -6 8 -4 q-2 5 -8 4 Z"/>`,
  },
  chicken: {
    tone: 'warm',
    seed: 11,
    ink: `<path class="k-tint" d="M80 21 q1 -6 5 -4 q2 -6 6 -1 q4 -3 5 3 q-8 3 -16 2 Z"/>
      <path d="M33 49 C23 42 19 31 23 22 M33 53 C23 50 15 45 13 37 M35 46 C29 37 30 27 35 21"/>
      <path class="k-paper" d="M31 51 C30 37 45 31 60 35 C67 24 76 19 84 22 C92 25 92 37 86 43 C92 56 81 69 61 69 C44 69 32 63 31 51 Z"/>
      <path class="k-paper" d="M90 29 L98 32 L90 35"/>
      <path class="k-tint" stroke-width="1.6" d="M88 37 q3 6 -1 8 q-3 -2 -2 -8"/>
      <path d="M47 50 C53 58 65 58 71 50"/>
      <path d="M54 69 L52 80 M47 83 L52 80 L57 83 M67 69 L68 80 M63 83 L68 80 L73 83"/>`,
    crisp: '<circle class="k-dot" cx="84" cy="28" r="1.9"/>',
  },
  cow: {
    tone: 'earth',
    seed: 13,
    ink: `<path d="M42 24 C34 22 30 16 31 9 M78 24 C86 22 90 16 89 9"/>
      <path class="k-paper" d="M40 31 C30 28 23 31 21 36 C29 39 35 38 40 36 Z M80 31 C90 28 97 31 99 36 C91 39 85 38 80 36 Z"/>
      <path class="k-paper" d="M41 22 C47 18 73 18 79 22 C82 32 82 44 81 52 C80 63 72 70 60 70 C48 70 40 63 39 52 C38 44 38 32 41 22 Z"/>
      <path class="k-dot" d="M63 21 C70 20 75 25 73 31 C71 36 64 35 62 30 C61 27 61 23 63 21 Z"/>
      <path class="k-tint" d="M44 55 C44 47 76 47 76 55 C76 64 44 64 44 55 Z"/>`,
    crisp: '<circle class="k-dot" cx="53" cy="56" r="2.2"/><circle class="k-dot" cx="67" cy="56" r="2.2"/><circle class="k-dot" cx="50" cy="38" r="2.3"/><circle class="k-dot" cx="70" cy="38" r="2.3"/>',
  },
  fish: {
    tone: 'cool',
    seed: 15,
    ink: `<path class="k-tint" d="M31 46 L14 33 C18 41 18 51 14 59 Z"/>
      <path class="k-paper" d="M30 46 C40 32 72 28 92 44 C72 61 40 60 30 46 Z"/>
      <path class="k-paper" d="M52 33 C56 25 65 25 69 31"/>
      <path stroke-width="1.8" d="M74 37 C70 42 70 50 74 55"/>
      <g stroke-width="1.5"><path d="M47 44 q3 3 6 0 M56 48 q3 3 6 0 M47 52 q3 3 6 0 M56 40 q3 3 6 0"/></g>
      <circle stroke-width="1.5" cx="101" cy="35" r="2.2"/><circle stroke-width="1.5" cx="106" cy="27" r="1.6"/>`,
    crisp: '<circle class="k-dot" cx="83" cy="42" r="2"/>',
  },
  greens: {
    tone: 'leaf',
    seed: 17,
    ink: `<path d="M60 82 C60 68 58 56 54 44"/><path d="M60 82 C62 66 70 52 82 40"/><path d="M60 82 C58 70 46 58 34 50"/>
      <path class="k-tint" d="M54 44 C44 36 46 20 56 13 C64 23 64 36 54 44 Z"/>
      <path class="k-tint" d="M82 40 C80 28 92 18 104 20 C102 32 94 40 82 40 Z"/>
      <path class="k-tint" d="M34 50 C22 48 14 38 16 28 C28 28 36 38 34 50 Z"/>
      <g stroke-width="1.4"><path d="M55 40 L56 20"/><path d="M85 38 L100 23"/><path d="M32 47 L19 31"/></g>
      <path class="k-paper" stroke-width="2" d="M53 70 C57 73 63 73 67 70 L67 75 C63 78 57 78 53 75 Z"/>`,
  },
  water: {
    tone: 'cool',
    seed: 19,
    ink: `<path class="k-tint" d="M43 52 C51 55 69 49 77 52 L74 81 L46 81 Z"/>
      <path d="M39 34 L45 82 L75 82 L81 34"/>
      <path d="M39 34 C47 37 73 37 81 34"/>
      <path stroke-width="1.8" d="M43 52 C51 55 69 49 77 52"/>
      <path class="k-paper" d="M60 5 C60 5 51 16 51 22 C51 27 55 31 60 31 C65 31 69 27 69 22 C69 16 60 5 60 5 Z"/>
      <path stroke-width="1.5" d="M56 18 q-2 4 0 7"/>`,
  },
  tea: {
    tone: 'leaf',
    seed: 21,
    ink: `${steam([48, 60, 72], 35)}
      <path class="k-paper" d="M20 75 C28 81 92 81 100 75 C92 69 28 69 20 75 Z"/>
      <path class="k-paper" d="M37 43 C37 61 46 70 60 70 C74 70 83 61 83 43 Z"/>
      <path class="k-tint" d="M37 43 C44 39 76 39 83 43 C76 47 44 47 37 43 Z"/>
      <path stroke-width="1.6" d="M44 55 q4 4 8 0 q4 -4 8 0 q4 4 8 0"/>`,
  },
  phin: {
    tone: 'earth',
    seed: 23,
    ink: `<path class="k-paper" d="M41 46 L43 84 L77 84 L79 46 Z"/>
      <path class="k-shade" stroke-width="1.6" d="M42 58 L43 76 C54 73 66 79 77 76 L78 58 Z"/>
      <path stroke-width="1.6" d="M60 47 V53"/>
      <path d="M31 45 C45 42 75 42 89 45"/>
      <path class="k-tint" d="M44 44 L46 24 L74 24 L76 44 Z"/>
      <path class="k-paper" d="M41 24 C47 17 73 17 79 24 Z"/>
      <path d="M57 15 C58 12 62 12 63 15"/>`,
  },
  noodlelift: {
    tone: 'warm',
    seed: 25,
    ink: `${steam([30, 92], 40)}
      <path d="M54 22 L82 4"/><path d="M58 26 L88 9"/>
      <g stroke-width="1.8"><path d="M55 24 C51 34 59 40 54 50 C51 56 55 60 53 64"/><path d="M58 25 C55 35 63 41 59 51 C57 57 60 61 58 65"/><path d="M61 26 C60 36 67 42 64 52 C62 58 65 62 63 66"/></g>
      <path class="k-tint" d="M22 56 C38 50 82 50 98 56 C82 62 38 62 22 56 Z"/>
      <path class="k-paper" d="M21 57 C23 73 40 82 60 82 C80 82 97 73 99 57 C82 63 38 63 21 57 Z"/>`,
  },
  yum: {
    tone: 'warm',
    seed: 27,
    ink: `<path class="k-tint" d="M60 13 C80 13 94 27 94 46 C94 65 80 79 60 79 C40 79 26 65 26 46 C26 27 40 13 60 13 Z"/>
      <path d="M44 41 q5 -6 10 0 M66 41 q5 -6 10 0"/>
      <path class="k-paper" d="M44 52 C48 66 72 66 76 52 Z"/>
      <path class="k-shade" stroke-width="1.6" d="M53 61 C55 56 65 56 67 61 C63 64 57 64 53 61 Z"/>
      <path stroke-width="2" d="M103 18 v10 M98 23 h10 M17 60 v8 M13 64 h8"/>`,
  },
};

function icon(name) {
  const i = ICONS[name];
  return i ? card(i.ink, i) : '';
}

// Counting dots: solid ink dots in rows of five (or ten), each a little different, like dots made with a pen.
function dots(n) {
  const cols = n <= 5 ? n : n <= 10 ? 5 : 10;
  const rows = Math.ceil(n / cols);
  const gap = n <= 10 ? 16 : n <= 30 ? 10.5 : 7.4;
  const r = n <= 10 ? 5.6 : n <= 30 ? 3.9 : 2.6;
  const w = (cols - 1) * gap;
  const h = (rows - 1) * gap;
  const x0 = 60 - w / 2;
  const y0 = 46 - h / 2;
  const rnd = seeded(100 + n);
  let out = '';
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i % cols) * gap + (rnd() - 0.5) * 1.2;
    const cy = y0 + Math.floor(i / cols) * gap + (rnd() - 0.5) * 1.2;
    out += `<circle class="k-dot" cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r * (0.92 + rnd() * 0.16))}"/>`;
  }
  const paper = blob(60, 46, Math.max(22, w / 2 + 16), Math.max(18, h / 2 + 15), 40 + n, 9, 0.08);
  return card('', { tone: 'earth', paper, crisp: out });
}

function blocks() {
  let out = '';
  for (let t = 0; t < 10; t++) {
    const x = 10 + (t % 5) * 20.4;
    const y = 22 + Math.floor(t / 5) * 25;
    out += `<path class="k-tint" stroke-width="1.8" d="M${x} ${y} h17 v17 h-17 Z"/><path stroke-width="1" d="M${x + 4.2} ${y} v17 M${x + 8.5} ${y} v17 M${x + 12.8} ${y} v17 M${x} ${y + 4.2} h17 M${x} ${y + 8.5} h17 M${x} ${y + 12.8} h17"/>`;
  }
  return card(out, { tone: 'earth', paper: blob(60, 46, 54, 34, 51, 10, 0.06) });
}

function fit(label, width, max) {
  return Math.min(max, width / (Math.max(1, [...label].length) * 0.62));
}

function textAt(label, x, y, size, cls = '') {
  return `<text class="k-text ${cls}" x="${n1(x)}" y="${n1(y + size * 0.34)}" font-size="${n1(size)}" text-anchor="middle">${esc(label)}</text>`;
}

function big(label) {
  const size = fit(label, 92, 28);
  return card('<path class="k-paper" d="M10 25 C40 22 80 22 110 25 C112 39 112 53 110 67 C80 70 40 70 10 67 C8 53 8 39 10 25 Z"/>', {
    tone: 'earth',
    paper: false,
    crisp: textAt(label, 60, 46, size),
  });
}

function notes() {
  const note = (x, y, r, cls, label) =>
    `<g transform="rotate(${r} ${x + 34} ${y + 18})"><path class="${cls}" d="M${x} ${y} h68 v36 h-68 Z"/><path stroke-width="1.4" d="M${x + 5} ${y + 5} h58 v26 h-58 Z"/><circle stroke-width="1.6" cx="${x + 19}" cy="${y + 18}" r="7"/>${label ? `<path stroke-width="1.4" d="M${x + 15} ${y + 18} q4 -6 8 0 q-4 5 -8 0"/>` : ''}</g>`;
  const front = `<g transform="rotate(7 72 40)">${textAt('100.000', 86, 49, 9.5, 'k-note')}</g>`;
  return card(note(12, 36, -15, 'k-shade', false) + note(24, 28, -4, 'k-tint', false) + note(38, 22, 7, 'k-paper', true), { tone: 'cool', seed: 61, crisp: front });
}

function coin(label) {
  const text = label || '₫';
  return card('<circle class="k-tint" cx="60" cy="45" r="32"/><circle stroke-width="1.6" cx="60" cy="45" r="25"/>', {
    tone: 'earth',
    seed: 71,
    crisp: textAt(text, 60, 45, fit(text, 40, 22)),
  });
}

function tag(label, mood) {
  const tone = mood === 'high' ? 'warm' : mood === 'low' ? 'leaf' : 'earth';
  const arrow = mood === 'high' ? '<path stroke-width="3" d="M108 72 V26 M99 35 l9 -9 l9 9"/>' : mood === 'low' ? '<path stroke-width="3" d="M108 24 V70 M99 61 l9 9 l9 -9"/>' : '';
  const size = fit(label, 54, 21);
  return card(`<path d="M20 45 C14 40 10 30 14 20"/><path class="k-paper" d="M5 45 L25 22 H96 V68 H25 Z"/><circle stroke-width="1.8" cx="20" cy="45" r="4"/>${arrow}`, {
    tone,
    paper: false,
    crisp: textAt(label, 61, 45, size),
  });
}

function question(n) {
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle class="k-dot" cx="${22 + i * 16}" cy="54" r="${5.6 - i * 0.2}"/>`;
  return card('<path stroke-width="3.2" d="M84 36 C84 26 103 26 103 37 C103 45 94 46 94 54"/>', { tone: 'cool', seed: 81, crisp: `${out}<circle class="k-dot" cx="94" cy="63" r="2.6"/>` });
}

function digits(label, mark) {
  const chars = [...label];
  const w = 26;
  const x0 = 60 - (chars.length * w) / 2;
  let ink = '';
  let crisp = '';
  chars.forEach((c, i) => {
    const x = x0 + i * w;
    ink += `<path class="${i === mark ? 'k-tint' : 'k-paper'}" stroke-width="2" d="M${x + 2} 22 h${w - 4} v38 h-${w - 4} Z"/>`;
    crisp += textAt(c, x + w / 2, 41, 21);
  });
  if (mark != null && mark >= 0) ink += `<path stroke-width="2.6" d="M${x0 + mark * w + w / 2} 66 v13 M${x0 + mark * w + w / 2 - 5} 71 l5 -5 l5 5"/>`;
  return card(ink, { tone: 'earth', paper: blob(60, 44, Math.max(30, (chars.length * w) / 2 + 12), 30, 91), crisp });
}

function halves(n) {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  const count = whole + (half ? 1 : 0);
  const gap = 32;
  const x0 = 60 - ((count - 1) * gap) / 2;
  let out = '';
  for (let i = 0; i < whole; i++) out += `<circle class="k-tint" cx="${x0 + i * gap}" cy="45" r="13"/>`;
  if (half) {
    const cx = x0 + whole * gap;
    out += `<path class="k-tint" d="M${cx} 32 A13 13 0 0 0 ${cx} 58 Z"/><circle cx="${cx}" cy="45" r="13"/>`;
  }
  return card(out, { tone: 'warm', paper: blob(60, 45, Math.max(26, ((count - 1) * gap) / 2 + 22), 26, 101) });
}

function plus(n) {
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle class="k-paper" stroke-width="2" cx="${18 + i * 19}" cy="45" r="7.5"/>`;
  const px = 18 + n * 19;
  out += `<path stroke-width="3" d="M${px} 39 v12 M${px - 6} 45 h12"/><circle class="k-tint" cx="${px + 21}" cy="45" r="9.5"/>`;
  return card(out, { tone: 'warm', seed: 111 });
}

function compare() {
  return card('<path class="k-paper" d="M27 82 V47 H51 V82"/><path class="k-tint" d="M68 82 V15 H92 V82"/><path d="M14 82 H106"/><path stroke-width="2.6" d="M38 36 L54 20 M54 20 h-10 M54 20 v10"/>', { tone: 'warm', seed: 121 });
}

function halfCircle() {
  return card('<circle class="k-paper" cx="60" cy="45" r="30"/><path class="k-tint" d="M60 15 A30 30 0 0 0 60 75 Z"/><path stroke-width="1.8" stroke-dasharray="4 5" d="M60 8 V82"/>', { tone: 'warm', seed: 131 });
}

// Covers, 400 by 250: one subject each, on a paper cut-out over a full-bleed field.
const SCENES = {
  phoStall: {
    tone: 'warm',
    paper: blob(205, 132, 160, 100, 11, 11, 0.07),
    ink: `<g stroke-width="3">${[128, 162, 196].map((x, i) => `<path d="M${x} ${110 - i * 3} c-9 -12 6 -20 0 -32 c-6 -12 7 -20 2 -30"/>`).join('')}</g>
      <path d="M236 92 L352 14"/><path d="M248 98 L362 26"/>
      <g stroke-width="3"><path d="M238 94 C230 108 246 116 236 130 C232 136 236 140 234 146"/><path d="M244 97 C238 111 254 119 244 133 C240 139 244 143 242 149"/><path d="M250 99 C246 113 262 121 252 135 C248 141 252 145 250 151"/></g>
      <path class="k-tint" d="M88 140 C130 122 270 122 312 140 C270 158 130 158 88 140 Z"/>
      <path class="k-shade" stroke-width="3" d="M262 139 C270 131 290 131 296 139 C288 145 270 146 262 139 Z"/>
      <path class="k-shade" stroke-width="3" d="M112 140 C120 133 138 132 146 139 C138 145 120 146 112 140 Z"/>
      <g stroke-width="3"><path d="M160 136 q8 -7 17 -2"/><path d="M188 143 q8 -6 16 -1"/><path d="M212 132 q7 -6 15 -1"/></g>
      <path class="k-paper" d="M86 141 C90 186 140 214 200 214 C260 214 310 186 314 141 C270 160 130 160 86 141 Z"/>
      <path stroke-width="3" d="M106 168 C150 182 250 182 294 168"/>
      <path stroke-width="2.6" d="M134 190 q7 7 14 0 q7 -7 14 0 q7 7 14 0 q7 -7 14 0 q7 7 14 0 q7 -7 14 0 q7 7 14 0 q7 -7 14 0 q7 7 14 0"/>
      <path class="k-paper" d="M168 213 L162 230 H238 L232 213"/>`,
  },
  market: {
    tone: 'earth',
    paper: 'M34 98 L366 96 L368 216 L32 218 Z M124 98 L126 62 L200 36 L276 62 L276 98 Z',
    ink: `<path d="M32 218 L34 98 L366 96 L368 216"/><path d="M124 98 L126 62 L200 36 L276 62 L276 98"/><path d="M26 98 H374"/>
      <path class="k-tint" stroke-width="3" d="M130 62 H270 V88 H130 Z"/>
      ${[[52, 44], [110, 44], [168, 64], [246, 44], [304, 44]].map(([x, w]) => `<path class="k-shade" d="M${x} 217 V${w > 50 ? 150 : 160} C${x} ${w > 50 ? 116 : 134} ${x + w} ${w > 50 ? 116 : 134} ${x + w} ${w > 50 ? 150 : 160} V217"/>`).join('')}
      <g stroke-width="2.6">${[56, 114, 250, 308].map((x) => `<path d="M${x + 6} 108 h24 v14 h-24 Z"/>`).join('')}</g>
      <path d="M6 219 H394"/>
      <path d="M140 176 Q200 166 260 176"/>
      <path stroke-width="2.6" d="M150 175 L143 196 M150 175 L158 196 M250 175 L243 196 M250 175 L258 196"/>
      <path class="k-paper" d="M136 196 H165 L160 212 H141 Z"/><path class="k-paper" d="M236 196 H265 L260 212 H241 Z"/>
      <path class="k-paper" d="M190 170 L210 170 L214 208 L186 208 Z"/><path d="M194 208 V218 M206 208 V218"/>
      <path class="k-tint" d="M180 170 L200 148 L220 170 Z"/>`,
    crisp: `<text class="k-text k-sign" x="200" y="79" text-anchor="middle">CHỢ ĐỒNG XUÂN</text>${[[143, 193], [151, 191], [158, 193], [243, 193], [251, 191], [258, 193]].map(([x, y]) => `<circle class="k-dot" cx="${x}" cy="${y}" r="3.6"/>`).join('')}`,
  },
  legend: {
    tone: 'cool',
    paper: `M-6 236 L72 108 L104 146 L156 52 L236 178 L262 236 Z ${blob(316, 46, 58, 20, 5, 8, 0.12)}`,
    ink: `<path d="M-6 236 L72 108 L104 146 L156 52 L236 178"/>
      <g stroke-width="3"><path d="M156 52 L144 96 L152 104 L140 140"/><path d="M72 108 L66 146 L74 156"/><path d="M156 52 L172 92"/></g>
      <g stroke-width="2.6"><path d="M110 196 l7 -14 l7 14 M128 206 l7 -14 l7 14 M92 212 l7 -14 l7 14 M150 214 l7 -14 l7 14"/></g>
      <path d="${blob(316, 46, 58, 20, 5, 8, 0.12)}"/>
      <g stroke-width="3">${[282, 302, 322, 342].map((x) => `<path d="M${x} 76 l-10 26"/>`).join('')}</g>
      <g stroke-width="2.4"><path d="M170 76 L182 70 M178 96 L192 88 M186 116 L200 108 M196 136 L210 128 M206 156 L220 148"/></g>
      <path class="k-paper" d="M206 252 C216 222 246 214 262 204 C276 194 270 176 286 170 C302 164 312 180 326 174 C342 166 336 150 354 146 C372 142 380 162 398 158 L406 252 Z"/>
      <g stroke-width="3.2">${[[262, 204], [326, 174], [354, 146]].map(([x, y]) => `<path d="M${x} ${y} c10 -14 26 -6 20 6 c-4 6 -12 4 -10 -2"/>`).join('')}</g>
      <g stroke-width="2.6">${[[236, 234], [290, 216], [346, 196], [318, 238], [372, 222]].map(([x, y]) => `<path d="M${x} ${y} c8 -10 20 -4 16 4"/>`).join('')}</g>
      <path stroke-width="2.4" d="M226 246 C250 240 270 248 296 243 M300 232 C322 226 340 234 362 229"/>`,
  },
};

function scene(name) {
  const s = SCENES[name];
  if (!s) return '';
  const id = `vw-ink-${++uid}`;
  return `<svg class="pic scene ink-pic k-${s.tone}" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${tremor(id, 400, 250, 0.028, 3.4)}</defs><rect class="k-field" x="0" y="0" width="400" height="250"/><path class="k-carrier" d="${s.paper}"/><g class="k-ink" stroke-width="4.2" filter="url(#${id})">${s.ink}</g>${s.crisp || ''}</svg>`;
}

// Returns an SVG string for a lesson picture spec such as { "kind": "icon", "name": "bowl" } or { "kind": "dots", "n": 100 }.
export function picture(spec) {
  if (!spec || typeof spec !== 'object') return '';
  switch (spec.kind) {
    case 'icon':
      return icon(spec.name);
    case 'dots':
      return dots(Math.max(1, Math.min(100, spec.n || 10)));
    case 'blocks':
      return blocks();
    case 'big':
      return big(spec.label || '');
    case 'notes':
      return notes();
    case 'coin':
      return coin(spec.label);
    case 'tag':
      return tag(spec.label || '?', spec.mood);
    case 'question':
      return question(Math.max(1, Math.min(4, spec.n || 3)));
    case 'digits':
      return digits(String(spec.label || ''), spec.mark);
    case 'halves':
      return halves(spec.n || 1.5);
    case 'plus':
      return plus(Math.max(1, Math.min(4, spec.n || 3)));
    case 'half':
      return halfCircle();
    case 'compare':
      return compare();
    case 'scene':
      return scene(spec.name);
    default:
      return '';
  }
}

export const PICTURE_KINDS = ['icon', 'dots', 'blocks', 'big', 'notes', 'coin', 'tag', 'question', 'digits', 'halves', 'plus', 'half', 'compare', 'scene'];
export const SCENE_NAMES = Object.keys(SCENES);
export const ICON_NAMES = Object.keys(ICONS);

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
  return `<svg class="pic ink-pic k-${tone}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${tremor(id, W, H, 0.1, 1.25)}</defs><rect class="k-field" x="0.5" y="0.5" width="119" height="89" rx="8"/>${cut}<g class="k-ink" stroke-width="2.1" filter="url(#${id})">${ink}</g>${crisp}</svg>`;
}

const steam = (xs, y, w = 1.8) => `<g stroke-width="${w}">${xs.map((x) => `<path d="M${x} ${y} c-4 -5 3 -8 0 -13 c-3 -5 3 -8 1 -12"/>`).join('')}</g>`;

// People for the family words. A standing figure: the person a word names is tinted, a plain figure stands for you,
// and height shows who is older. Returns the drawing and the points where arms join, so each picture adds its own gesture.
function person(x, base, h, { fill = 'k-paper', hair = 'short', dress = false } = {}) {
  const r = h * 0.125;
  const hy = base - h + r;
  const sy = hy + r + h * 0.035;
  const ws = h * 0.165;
  const hip = base - h * 0.4;
  const legs = (top) => `<path d="M${n1(x - h * 0.06)} ${n1(top)} L${n1(x - h * 0.075)} ${n1(base)} M${n1(x + h * 0.06)} ${n1(top)} L${n1(x + h * 0.075)} ${n1(base)}"/>`;
  const shoulders = `M${n1(x - ws)} ${n1(sy + r * 0.9)} C${n1(x - ws)} ${n1(sy - r * 0.15)} ${n1(x - ws * 0.6)} ${n1(sy - r * 0.3)} ${n1(x)} ${n1(sy - r * 0.3)} C${n1(x + ws * 0.6)} ${n1(sy - r * 0.3)} ${n1(x + ws)} ${n1(sy - r * 0.15)} ${n1(x + ws)} ${n1(sy + r * 0.9)}`;
  let body;
  if (dress) {
    const hem = base - h * 0.19;
    body = `${legs(hem - 2)}<path class="${fill}" d="${shoulders} L${n1(x + h * 0.23)} ${n1(hem)} C${n1(x + h * 0.1)} ${n1(hem + 1.6)} ${n1(x - h * 0.1)} ${n1(hem + 1.6)} ${n1(x - h * 0.23)} ${n1(hem)} Z"/>`;
  } else {
    body = `${legs(hip - 2)}<path class="${fill}" d="${shoulders} L${n1(x + h * 0.14)} ${n1(hip)} L${n1(x - h * 0.14)} ${n1(hip)} Z"/>`;
  }
  const behind = hair === 'long' ? `<path class="k-dot" d="M${n1(x - r * 1.12)} ${n1(hy + r * 1.75)} C${n1(x - r * 1.5)} ${n1(hy - r * 1.25)} ${n1(x + r * 1.5)} ${n1(hy - r * 1.25)} ${n1(x + r * 1.12)} ${n1(hy + r * 1.75)} Z"/>` : '';
  const cap = `<path class="k-dot" d="M${n1(x - r * 1.02)} ${n1(hy + r * 0.1)} C${n1(x - r * 1.1)} ${n1(hy - r * 1.45)} ${n1(x + r * 1.1)} ${n1(hy - r * 1.45)} ${n1(x + r * 1.02)} ${n1(hy + r * 0.1)} C${n1(x + r * 0.7)} ${n1(hy - r * 0.55)} ${n1(x - r * 0.1)} ${n1(hy - r * 0.75)} ${n1(x - r * 1.02)} ${n1(hy + r * 0.1)} Z"/>`;
  const top = hair === 'short' || hair === 'long' ? cap : hair === 'tuft' ? `<path stroke-width="1.5" d="M${n1(x - r * 0.3)} ${n1(hy - r)} c0 -3 3 -4 4 -2"/>` : '';
  const ink = `${behind}${body}<circle class="k-paper" cx="${n1(x)}" cy="${n1(hy)}" r="${n1(r)}"/>${top}`;
  return { ink, sy, ws, hy, r, hip };
}

// A head-and-shoulders portrait for the older family words; each adds its own hair, hat and face on top.
const BUST = {
  shirt: (cls = 'k-tint') => `<path class="${cls}" d="M20 89 C22 73 34 64 47 62 L73 62 C86 64 98 73 100 89 Z"/>`,
  head: (cy = 38) => `<path d="M54 ${cy + 12} V62 M66 ${cy + 12} V62"/><circle class="k-paper" cx="60" cy="${cy}" r="14.5"/>`,
  ears: (cy = 38) => `<path class="k-paper" stroke-width="1.6" d="M45.6 ${cy - 3} c-4 0 -4 7 0 7 M74.4 ${cy - 3} c4 0 4 7 0 7"/>`,
};
const eyes = (y, dx = 6) => `<circle class="k-dot" cx="${60 - dx}" cy="${y}" r="1.5"/><circle class="k-dot" cx="${60 + dx}" cy="${y}" r="1.5"/>`;

// Two standing people for anh, chị, em and bạn, joined by a gesture: an arm round the shoulders, a hand held, a hand on the head.
function family(kind) {
  const arm = (x1, y1, x2, y2) => `M${n1(x1)} ${n1(y1)} L${n1(x2)} ${n1(y2)}`;
  if (kind === 'brother' || kind === 'sister') {
    const b = person(45, 82, 64, kind === 'sister' ? { fill: 'k-tint', hair: 'long', dress: true } : { fill: 'k-tint' });
    const y = person(79, 82, 45);
    const reach = kind === 'brother'
      ? `<path d="M${n1(45 + b.ws)} ${n1(b.sy + 2)} C62 ${n1(b.sy + 6)} 72 ${n1(y.sy - 2)} ${n1(79 + y.ws + 1)} ${n1(y.sy + 1)}"/><path d="${arm(79 + y.ws, y.sy + 2, 79 + y.ws + 3, y.hip + 3)}"/>`
      : `<path d="M${n1(45 + b.ws)} ${n1(b.sy + 2)} C60 ${n1(b.sy + 12)} 64 ${n1(y.hip - 1)} 68 ${n1(y.hip - 2)}"/><path d="${arm(79 - y.ws, y.sy + 2, 68, y.hip - 2)} ${arm(79 + y.ws, y.sy + 2, 79 + y.ws + 3, y.hip + 3)}"/>`;
    return {
      ink: `${y.ink}${b.ink}<path d="${arm(45 - b.ws, b.sy + 2, 45 - b.ws - 4, b.hip + 4)}"/>${reach}`,
      crisp: kind === 'sister' ? `<circle class="k-dot" cx="68" cy="${n1(y.hip - 2)}" r="2"/>` : '',
    };
  }
  if (kind === 'younger') {
    const o = person(43, 82, 64);
    const c = person(78, 82, 40, { fill: 'k-tint', hair: 'tuft' });
    return {
      ink: `${o.ink}${c.ink}<path d="${arm(43 - o.ws, o.sy + 2, 43 - o.ws - 4, o.hip + 4)}"/>
        <path d="M${n1(43 + o.ws)} ${n1(o.sy + 2)} C58 ${n1(o.sy + 2)} 66 ${n1(c.hy - c.r - 6)} 76 ${n1(c.hy - c.r - 1.5)}"/>
        <path d="${arm(78 - c.ws, c.sy + 2, 78 - c.ws - 3, c.hip + 3)} ${arm(78 + c.ws, c.sy + 2, 78 + c.ws + 3, c.hip + 3)}"/>`,
    };
  }
  const a = person(42, 82, 58);
  const b = person(78, 82, 58, { fill: 'k-tint' });
  return {
    ink: `${a.ink}${b.ink}<path d="${arm(42 - a.ws, a.sy + 2, 42 - a.ws - 4, a.hip + 4)} ${arm(78 + b.ws, b.sy + 2, 78 + b.ws + 4, b.hip + 4)}"/>
      <path d="M${n1(42 + a.ws)} ${n1(a.sy + 2)} L60 ${n1(a.hip + 1)} L${n1(78 - b.ws)} ${n1(b.sy + 2)}"/>`,
    crisp: `<circle class="k-dot" cx="60" cy="${n1(a.hip + 1)}" r="2.2"/>`,
  };
}

// Issue 5 (the market). Spokes from a centre: citrus segments, dial ticks, leaf veins.
function spokes(cx, cy, r0, r1, n, rot = 0, skip = []) {
  let d = '';
  for (let i = 0; i < n; i++) {
    if (skip.includes(i)) continue;
    const a = rot + (i / n) * Math.PI * 2;
    d += `M${n1(cx + Math.cos(a) * r0)} ${n1(cy + Math.sin(a) * r0)} L${n1(cx + Math.cos(a) * r1)} ${n1(cy + Math.sin(a) * r1)} `;
  }
  return d.trim();
}

// One banana finger growing from its crown at (x, y): a crescent that dips and curls up to a dark tip, turned by deg,
// sized by s and mirrored when flip is set. Coordinates are computed, not transformed, so line widths stay even.
function banana(x, y, deg, s = 1, { flip = false, cls = 'k-tint', ridge = 1.1 } = {}) {
  const a = (deg * Math.PI) / 180;
  const p = ([u, v]) => {
    const dx = (u * Math.cos(a) - v * Math.sin(a)) * s;
    const dy = (u * Math.sin(a) + v * Math.cos(a)) * s;
    return `${n1(flip ? x - dx : x + dx)} ${n1(y + dy)}`;
  };
  const [tx, ty] = p([74.6, 2]).split(' ');
  return `<path class="${cls}" d="M${p([0, 4])} C${p([4, 44])} ${p([56, 50])} ${p([75, 5])} L${p([74, -1])} C${p([58, 28])} ${p([20, 30])} ${p([2, -4])} Z"/>
    <path stroke-width="${ridge}" d="M${p([4, 1.6])} C${p([11, 37])} ${p([55, 41])} ${p([72.6, 3.4])}"/><circle class="k-dot" cx="${tx}" cy="${ty}" r="${n1(2.3 * Math.max(1, s * 0.75))}"/>`;
}

// A straight bar, wider at the far end (a pen, a stalk). Like stick() below, but safe to use while ICONS is being built.
function bar(x1, y1, x2, y2, w1, w2) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const pt = (x, y, w, k) => `${n1(x + (k * nx * w) / 2)} ${n1(y + (k * ny * w) / 2)}`;
  return `M${pt(x1, y1, w1, 1)} L${pt(x2, y2, w2, 1)} L${pt(x2, y2, w2, -1)} L${pt(x1, y1, w1, -1)} Z`;
}

// A lychee: a round fruit covered in small raised scales.
function lychee(cx, cy, r) {
  const marks = [[-0.5, -0.45], [0.1, -0.6], [0.55, -0.25], [-0.6, 0.15], [0, -0.05], [0.5, 0.35], [-0.2, 0.55], [-0.15, -0.3], [0.25, 0.15]];
  return `<circle class="k-tint" cx="${cx}" cy="${cy}" r="${r}"/><path stroke-width="1" d="${marks.map(([u, v]) => `M${n1(cx + u * r - 1.6)} ${n1(cy + v * r + 0.6)} q1.6 -2.2 3.2 0`).join(' ')}"/>`;
}

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
  // Family words. Older and younger siblings stand beside a plain figure (you); the tinted one is the word.
  brother: { tone: 'warm', seed: 141, ...family('brother') },
  sister: { tone: 'warm', seed: 143, ...family('sister') },
  younger: { tone: 'warm', seed: 145, ...family('younger') },
  friend: { tone: 'warm', seed: 147, ...family('friend') },
  me: {
    tone: 'warm',
    seed: 149,
    ink: `${BUST.shirt()}
      <path stroke-width="1.6" d="M52 62 L60 70 L68 62"/>
      ${BUST.head(35)}${BUST.ears(35)}
      <path class="k-dot" d="M45.4 36 C44 20 76 20 74.6 36 C70 28 58 26 45.4 36 Z"/>
      <path class="k-mid" d="M22 90 C26 84 34 79 45 76 L48 84 C40 86 34 88 32 90 Z"/>
      <path class="k-paper" d="M45 76 C49 73.5 53 72 57 70.6 L66 67.6 C68.4 66.8 69.6 69.6 67.4 70.8 L62.4 73 L68.6 72.2 C71 72 71.4 75 69 75.6 L62 77.6 L66.4 78 C68.6 78.4 68.4 81.2 66 81.2 L57 81.6 C53 82 50.4 83 48 84 Z"/>
      <path stroke-width="1.2" d="M57 74.4 L62.4 73 M57.4 78.2 L62 77.6"/>
      <path class="k-paper" stroke-width="1.8" d="M56.6 71 C57.6 67.6 59.6 65.4 62 64.6 C63.6 64.2 64.2 66 63.2 67"/>`,
    crisp: `${eyes(37)}<path class="k-dot" d="M56.5 44 q3.5 2.6 7 0 q-3.5 1.2 -7 0 Z"/>`,
  },
  aunt: {
    tone: 'warm',
    seed: 151,
    ink: `${BUST.shirt()}
      <path class="k-tint" stroke-width="1.6" d="M51.5 56.4 C54 57.6 66 57.6 68.5 56.4 V62 C66 63.4 54 63.4 51.5 62 Z"/>
      <path stroke-width="1.6" d="M68.4 62 C74 63.6 79 67.4 83 73.6"/>
      ${BUST.head(38)}${BUST.ears(38)}
      <path class="k-dot" d="M44.6 40 C40.6 38 41 33.4 44.6 32.6 C43.4 28 47.6 24.6 51.4 26.4 C52.6 22.2 58 21 60.6 24 C63.4 20.8 68.6 22.4 69.4 26.6 C73.4 25.4 77 29 75.4 33 C79 34.4 79 39 75.4 40.4 C74 34.6 70 31 64.6 30.4 C60 31.8 56 31.6 52.6 30.4 C48.4 31.4 45.6 35 44.6 40 Z"/>
      <path stroke-width="1.3" d="M53 34.6 q3 -1.5 6 0 M61 34.6 q3 -1.5 6 0"/>`,
    crisp: `${eyes(39.5)}<path class="k-dot" d="M56 46 q4 3 8 0 q-4 1.4 -8 0 Z"/><circle class="k-dot" cx="45.6" cy="45.5" r="1.4"/><circle class="k-dot" cx="74.4" cy="45.5" r="1.4"/><circle class="k-dot" cx="75.4" cy="65.6" r="1.1"/><circle class="k-dot" cx="79.4" cy="69.2" r="1.1"/>`,
  },
  uncle: {
    tone: 'warm',
    seed: 153,
    ink: `${BUST.shirt()}
      <path class="k-paper" stroke-width="1.6" d="M50 61 L60 69 L56 74 Z M70 61 L60 69 L64 74 Z"/>
      <path stroke-width="1.5" d="M60 69 V86"/>
      ${BUST.head(40)}${BUST.ears(40)}
      <path class="k-mid" d="M43 35 C43 17 77 17 77 35 Z"/>
      <path class="k-mid" d="M36 36 C46 31 74 31 84 36 C74 40 46 40 36 36 Z"/>
      <path stroke-width="1.3" d="M47 31 C52 27 68 27 73 31"/>
      <path stroke-width="2" d="M52.5 37.5 h5 M62.5 37.5 h5"/>`,
    crisp: `${eyes(42)}<circle class="k-dot" cx="60" cy="20.4" r="1.6"/><path class="k-dot" d="M51.5 49.5 C54 46.4 58 46.4 60 48.4 C62 46.4 66 46.4 68.5 49.5 C66 50.8 62 50.6 60 49.6 C58 50.6 54 50.8 51.5 49.5 Z"/>`,
  },
  grandpa: {
    tone: 'warm',
    seed: 155,
    ink: `${BUST.shirt()}
      <path stroke-width="1.6" d="M52 62 Q60 68 68 62"/>
      ${BUST.head(36)}${BUST.ears(36)}
      <path class="k-paper" stroke-width="1.5" d="M45.6 33 C42 31 41.5 38 44 41 M74.4 33 C78 31 78.5 38 76 41"/>
      <path stroke-width="1.1" d="M53 26 q7 -2 14 0 M55 29.5 q5 -1.4 10 0"/>
      <circle stroke-width="1.5" cx="53.6" cy="36" r="4.6"/><circle stroke-width="1.5" cx="66.4" cy="36" r="4.6"/>
      <path stroke-width="1.5" d="M58.2 35.4 q1.8 -1.4 3.6 0"/>
      <path class="k-paper" stroke-width="1.6" d="M54 45 C53 55 56.5 65 60 74 C63.5 65 67 55 66 45 C63 47.5 57 47.5 54 45 Z"/>
      <path stroke-width="1.1" d="M58 50 C58 57 59 63 60 68 M62 50 C62 56 61.5 61 61 65"/>
      <path stroke-width="1.5" d="M60 43.6 C56 44 53 46 51 49.5 M60 43.6 C64 44 67 46 69 49.5"/>`,
    crisp: eyes(36.4, 6.4),
  },
  grandma: {
    tone: 'warm',
    seed: 157,
    ink: `${BUST.shirt()}
      <path stroke-width="1.6" d="M51 62 Q60 69 69 62"/>
      <circle class="k-paper" cx="60" cy="19.5" r="7"/>
      <path stroke-width="1.1" d="M56 18 q4 -4 8 0 q-2 3 -5 2"/>
      ${BUST.head(39)}${BUST.ears(39)}
      <path class="k-paper" d="M44.6 39 C42 22.6 78 22.6 75.4 39 C73.6 33.6 70 30.6 66 30 C62 32 58 32 54 30 C50 30.6 46.4 33.6 44.6 39 Z"/>
      <path stroke-width="1.1" d="M49 31 C52 28 56 27 59 27.6 M61 27.6 C64 27 68 28 71 31 M60 25.6 V30.6"/>
      <path stroke-width="1.1" d="M54 34.6 q6 -1.6 12 0"/>
      <path stroke-width="1.6" d="M51 40.6 q3 -3 6 0 M63 40.6 q3 -3 6 0"/>
      <path stroke-width="1.1" d="M48.4 40 l-2.2 -1 M48.4 42.4 l-2.2 0.6 M71.6 40 l2.2 -1 M71.6 42.4 l2.2 0.6"/>
      <path stroke-width="1.5" d="M55 46.6 q5 4 10 0"/>
      <path stroke-width="1.1" d="M52.6 45 q-1 3 1 5 M67.4 45 q1 3 -1 5"/>`,
    crisp: '<circle class="k-dot" cx="45.6" cy="46.4" r="1.5"/><circle class="k-dot" cx="74.4" cy="46.4" r="1.5"/>',
  },
  nametag: {
    tone: 'warm',
    seed: 159,
    ink: `<path stroke-width="1.8" d="M57 22 C52 13 47 6 43 -1 M63 22 C68 13 73 6 77 -1"/>
      <path class="k-paper" d="M39 27 C39 25.4 40 24.4 41.6 24.4 H78.4 C80 24.4 81 25.4 81 27 V82 C81 83.6 80 84.6 78.4 84.6 H41.6 C40 84.6 39 83.6 39 82 Z"/>
      <path class="k-shade" stroke-width="1.4" d="M54 28 H66 V31 H54 Z"/>
      <path class="k-paper" stroke-width="1.8" d="M55.4 19 H64.6 V30 H55.4 Z"/>
      <path class="k-tint" stroke-width="1.6" d="M47 35 H73 V57 H47 Z"/>
      <path class="k-paper" stroke-width="1.4" d="M51.6 57 C52 51.6 55.6 49.6 60 49.6 C64.4 49.6 68 51.6 68.4 57 Z"/>
      <circle class="k-paper" stroke-width="1.4" cx="60" cy="44.2" r="4.6"/>
      <path stroke-width="1.3" d="M47 77.6 H73"/>`,
    crisp: textAt('Lan', 60, 68.4, 12.5),
  },
  fullname: {
    tone: 'earth',
    paper: false,
    ink: `<path class="k-paper" d="M8 27 C40 24 80 24 112 27 C114 37 114 47 112 57 C80 60 40 60 8 57 C6 47 6 37 8 27 Z"/>
      <path class="k-tint" stroke-width="1.7" d="M74 33 H105 V51 H74 Z"/>
      <path stroke-width="2.6" d="M89.5 79 V64 M84.5 69 l5 -5 l5 5"/>`,
    crisp: `${textAt('Nguyễn', 30, 42, 9.6)}${textAt('Văn', 59.5, 42, 9.6)}${textAt('Dũng', 89.5, 42, 9.6)}`,
  },
  edict: {
    tone: 'earth',
    seed: 161,
    ink: `<path class="k-paper" d="M27 20 C50 18 70 18 93 20 L93 72 C70 74 50 74 27 72 Z"/>
      <path class="k-tint" stroke-width="1.8" d="M20 16 C22 14 26 14 28 16 V76 C26 78 22 78 20 76 Z M92 16 C94 14 98 14 100 16 V76 C98 78 94 78 92 76 Z"/>
      <path stroke-width="1.5" d="M42 28 v7 M42 39 v5 M42 48 v8 M42 60 v4 M53 28 v5 M53 37 v8 M53 49 v5 M53 58 v6 M64 28 v8 M64 40 v5 M64 49 v7"/>
      <path class="k-shade" stroke-width="1.6" d="M72 50 H86 V64 H72 Z"/>
      <path class="k-paper" stroke-width="1.1" d="M76 54 c2 -2 4 -2 6 0 c-2 2 -2 4 0 6 c-2 -1 -4 -1 -6 0 c1 -2 1 -4 0 -6 Z"/>`,
  },
  suitcase: {
    tone: 'cool',
    seed: 163,
    ink: `<path d="M47 34 V27 C47 21 73 21 73 27 V34"/>
      <path class="k-paper" d="M22 37 C22 35 24 34 26 34 H94 C96 34 98 35 98 37 V77 C98 79 96 80 94 80 H26 C24 80 22 79 22 77 Z"/>
      <path class="k-tint" stroke-width="1.8" d="M38 34 V80 M82 34 V80"/>
      <path stroke-width="1.4" d="M38 34 V80 M42 34 V80 M78 34 V80 M82 34 V80"/>
      <circle class="k-tint" stroke-width="1.5" cx="60" cy="50" r="7"/><path stroke-width="1.1" d="M54 50 h12 M60 44 c-3 4 -3 8 0 12 c3 -4 3 -8 0 -12"/>
      <path class="k-shade" stroke-width="1.4" d="M51 64 H69 V72 H51 Z"/>
      <path stroke-width="1.6" d="M28 80 v3 M92 80 v3"/>`,
  },
  // Issue 5, the market. mua: a banknote goes one way, a bag of oranges comes back.
  buy: {
    tone: 'earth',
    seed: 171,
    ink: `<path stroke-width="1.8" d="M30 25 C42 13 66 11 80 21 M80 21 l-1.5 -7.5 M80 21 l-7.6 1.2"/>
      <path stroke-width="1.8" d="M88 74 C76 85 52 86 38 77 M38 77 l1.6 7.4 M38 77 l7.6 -1.4"/>
      <g transform="rotate(-9 31 49)"><path class="k-tint" d="M11 37 h40 v24 h-40 Z"/><path stroke-width="1.2" d="M15 41 h32 v16 h-32 Z"/><circle stroke-width="1.4" cx="23" cy="49" r="4.6"/><path stroke-width="1.2" d="M33 46 h9 M33 50 h11 M33 54 h7"/></g>
      ${[[78, 39], [88, 36], [97, 40], [84, 30]].map(([x, y]) => `<circle class="k-tint" stroke-width="1.6" cx="${x}" cy="${y}" r="6"/>`).join('')}
      <path stroke-width="1.6" d="M74 44 C70 34 73 27 77 27 M102 44 C106 34 103 27 99 27"/>
      <path class="k-paper" d="M70 43 C76 41 100 41 106 43 L109 77 C100 81 76 81 67 77 Z"/>
      <path stroke-width="1.2" d="M76 50 C78 60 77 68 75 74 M99 50 C97 60 98 68 100 74"/>`,
  },
  // quả: a fruiting branch; one fruit hangs on, one has just dropped.
  fruit: {
    tone: 'leaf',
    seed: 173,
    ink: `<path d="M6 18 C28 10 58 15 88 11 C96 10 103 12 110 9"/>
      <path class="k-pale" stroke-width="1.6" d="M60 14 C66 3 80 1 88 4 C82 12 70 16 60 14 Z M30 14 C25 4 13 3 7 7 C13 14 22 17 30 14 Z"/>
      <path stroke-width="1.1" d="M62 13 C70 9 78 6 86 4.6 M28 13.6 C22 10 15 8 9 7"/>
      <path stroke-width="1.6" d="M42 15 C43 20 43 24 42 28 M78 12 C79 15 79 18 78 20"/>
      <circle class="k-tint" cx="42" cy="40" r="12.5"/><path class="k-paper" stroke-width="1.3" d="M36 31 q4 -3 7 0 q-4 2 -7 0 Z"/>
      <path stroke-width="1.5" d="M71 34 v5 M78 31 v7 M85 34 v5"/>
      <circle class="k-tint" cx="78" cy="58" r="12.5"/><path stroke-width="1.6" d="M78 45.5 c0 -2.4 1 -4 2.4 -5"/>
      <path stroke-width="1.4" d="M64 80 h28"/>`,
  },
  // cam: a whole orange with its leaf, and a half showing the segments.
  orange: {
    tone: 'warm',
    seed: 175,
    ink: `<circle class="k-tint" cx="46" cy="49" r="25"/>
      <path stroke-width="1.8" d="M46 24.5 C45.4 21 46 18 47.6 15.4"/>
      <path class="k-paper" stroke-width="1.6" d="M47.6 17 C52 9.4 63.6 7.4 71 11 C65 18 55 21 47.6 17 Z"/><path stroke-width="1.1" d="M50 16.2 C56 13.6 62 12 68.6 11.4"/>
      <circle class="k-paper" cx="85" cy="63" r="17"/>
      <circle class="k-pale" stroke-width="1.4" cx="85" cy="63" r="13"/>
      <path stroke-width="1.2" d="${spokes(85, 63, 2.6, 12.4, 8, 0.2)}"/>`,
    crisp: `${[[36, 40], [44, 35], [53, 37], [33, 50], [42, 45], [50, 44], [58, 43], [38, 58], [47, 55], [55, 52], [44, 65], [30, 43], [60, 51]].map(([x, y]) => `<circle class="k-dot" cx="${x}" cy="${y}" r="0.75"/>`).join('')}<circle class="k-dot" cx="85" cy="63" r="1.4"/>`,
  },
  // chuối: a hand of bananas fanning from its crown.
  bananas: {
    tone: 'earth',
    seed: 177,
    ink: `<path class="k-shade" stroke-width="1.8" d="${bar(27, 39, 13, 22, 8, 6.5)}"/>
      ${[-26, -12, 2, 16].map((d) => banana(25, 37, d, 0.96)).join('')}
      <path class="k-shade" stroke-width="1.6" d="M18 33 C22 30 28 31 31 35 C30 41 24 44 19 41 C16 39 16 35 18 33 Z"/>`,
  },
  // cân: a market dial scale with fruit in its pan.
  scale: {
    tone: 'earth',
    seed: 179,
    ink: `<path stroke-width="1.8" d="M60 39 V29"/>
      <path class="k-paper" d="M30 29 C40 24 80 24 90 29 C80 34 40 34 30 29 Z"/>
      <circle class="k-pale" stroke-width="1.7" cx="51" cy="21" r="7.6"/><circle class="k-pale" stroke-width="1.7" cx="67" cy="20" r="8.4"/><circle class="k-pale" stroke-width="1.7" cx="58.6" cy="14" r="6.6"/>
      <path class="k-tint" d="M34 45 C34 41 37 39 41 39 H79 C83 39 86 41 86 45 V78 C86 81 84 83 81 83 H39 C36 83 34 81 34 78 Z"/>
      <path stroke-width="1.8" d="M40 83 v3 M80 83 v3"/>
      <circle class="k-paper" cx="60" cy="61" r="17"/>
      <path stroke-width="1.1" d="${spokes(60, 61, 12.8, 15.6, 12, -Math.PI / 2, [5, 6, 7])}"/>
      <path stroke-width="1.9" d="M60 61 L70.6 50.4"/>`,
    crisp: `<circle class="k-dot" cx="60" cy="61" r="2.2"/>${textAt('kg', 60, 70.4, 6.4)}`,
  },
  // thịt: a joint of meat on the bone, a rim of fat along its top, shaded by hatching.
  meat: {
    tone: 'warm',
    seed: 181,
    ink: `<path class="k-paper" stroke-width="1.8" d="${bar(70, 40, 98, 18, 7.4, 6.6)}"/>
      <circle class="k-paper" stroke-width="1.8" cx="101.4" cy="20.6" r="4.8"/><circle class="k-paper" stroke-width="1.8" cx="96.6" cy="14.6" r="4.8"/>
      <path class="k-tint" d="M77 33 C65 28 50 29 40 33 C26 38 16 50 19 62 C22 74 37 81 52 76 C65 72 73 60 79 46 C81 40 81 36 77 33 Z"/>
      <path class="k-paper" stroke-width="1.6" d="M77 33 C65 28 50 29 40 33 C30 37 23 44 20.6 52 C28 45.6 38 41 50 39.4 C61 38 71 38.6 79.4 41 C80.4 37.6 79.6 34.6 77 33 Z"/>
      ${hatch(34, 74, 66, 64, 7, 4.2, -5.4, 1.2)}${hatch(70, 58, 76, 48, 3, 3.6, -4.6, 1.2)}`,
  },
  // bớt: a price tag knocked down from 50k to 45k.
  discount: {
    tone: 'earth',
    paper: false,
    ink: `<path d="M24 46 C16 40 12 30 16 18"/>
      <path class="k-paper" d="M10 46 L28 21 H100 V71 H28 Z"/><circle stroke-width="1.8" cx="23" cy="46" r="3.6"/>
      <path stroke-width="2.6" d="M92 29 V50 M86.5 44.5 l5.5 5.5 l5.5 -5.5"/>`,
    crisp: `${textAt('80k', 57, 33, 12)}<path class="k-ink" stroke-width="2.2" d="M43 34.6 L71 31.4"/>${textAt('70k', 58, 56, 21)}`,
  },
  // hết: a handwritten bill with its total underlined.
  bill: {
    tone: 'earth',
    seed: 183,
    ink: `<path class="k-paper" d="M36 8 H84 V80 l-4 4 l-4 -4 l-4 4 l-4 -4 l-4 4 l-4 -4 l-4 4 l-4 -4 l-4 4 l-4 -4 l-4 4 l-4 -4 Z"/>
      <path stroke-width="1.3" d="M42 18 h20 M70 18 h8 M42 27 h16 M70 27 h8 M42 36 h22 M70 36 h8 M42 45 h14 M70 45 h8"/>
      <path stroke-width="1.6" d="M42 54 H78 M42 57.5 H78"/>
      <path class="k-tint" stroke-width="1.6" d="${bar(106, 20, 91, 66, 5, 5)}"/><path class="k-dot" d="M88.8 64.6 L89.4 71.8 L93.6 66.2 Z"/>`,
    crisp: textAt('150k', 60, 68, 14),
  },
  // Story: lychees, the vải thiều of summer.
  lychee: {
    tone: 'warm',
    seed: 185,
    ink: `<path d="M58 4 C58 14 56 22 52 30 M57 16 C64 22 70 26 76 30 M55 22 C50 26 44 30 38 34"/>
      <path class="k-pale" stroke-width="1.6" d="M58 9 C66 3 82 3 92 8 C84 14 68 14 58 9 Z M57 12 C48 6 34 7 26 13 C36 18 48 17 57 12 Z"/>
      <path stroke-width="1" d="M61 9 C70 7.4 80 7 89 8 M54 12.4 C46 11 37 11.6 29 13"/>
      ${lychee(38, 45, 11)}${lychee(56, 42, 11.5)}${lychee(78, 43, 11)}${lychee(47, 63, 11.5)}
      <path class="k-tint" stroke-width="1.6" d="M66 70 C64 62 70 56 77 57 C74 62 72 67 72 72 Z"/>
      <path class="k-paper" d="M74 70 C74 61 80 56 86 56 C93 56 97 62 96 69 C95 76 89 80 84 80 C78 80 74 76 74 70 Z"/>
      <path class="k-pale" stroke-width="1.2" d="M82.6 66 C82.6 62.8 84.2 61 86 61 C87.8 61 89 63 89 66 C89 69 87.4 71 85.6 71 C84 71 82.6 69 82.6 66 Z"/>`,
  },
  // Story: a street seller with a shoulder pole (đòn gánh), a basket of fruit at each end.
  pole: {
    tone: 'warm',
    seed: 187,
    ink: `<path class="k-pale" stroke-width="1.6" d="M9 31 Q60 23 111 31 L111 34 Q60 26 9 34 Z"/>
      <path stroke-width="1.3" d="M14 32.4 L7 58 M14 32.4 L14 58 M14 32.4 L21 58 M106 32.4 L99 58 M106 32.4 L106 58 M106 32.4 L113 58"/>
      ${[[9, 55], [14.6, 53], [19.6, 55.4], [101, 55], [106.6, 53], [111.4, 55.4]].map(([x, y]) => `<circle class="k-tint" stroke-width="1.5" cx="${x}" cy="${y}" r="4"/>`).join('')}
      <path class="k-pale" stroke-width="1.7" d="M4 58 H24 L21 76 H7 Z M96 58 H116 L113 76 H99 Z"/>
      <path stroke-width="1" d="M5 64 H23 M6 70 H22 M10 58 L10.6 76 M17.6 58 L17 76 M97 64 H115 M98 70 H114 M102 58 L102.6 76 M109.6 58 L109 76"/>
      <path d="M56 57 L54 80 M64 57 L67 80"/><path stroke-width="1.8" d="M50 81 h5 M66 81 h6"/>
      <path class="k-paper" d="M52 25 C55 23.4 65 23.4 68 25 L71 58 C64 60 56 60 49 58 Z"/>
      <path stroke-width="1.6" d="M67 30 C72 33 75 32 78 29 M53 30 C50 38 49 44 50 49"/>
      <path class="k-tint" d="M43 23 L60 6 L77 23 C70 25.6 50 25.6 43 23 Z"/>
      <path stroke-width="1" d="M60 6 L52 24 M60 6 L60 25 M60 6 L68 24"/>`,
  },
  // Story: cốm, young green rice, heaped on a lotus leaf and tied with green straw.
  comLeaf: {
    tone: 'leaf',
    seed: 189,
    ink: `<path class="k-tint" d="M60 14 C82 13 100 26 101 45 C102 64 84 78 60 78 C36 78 18 65 19 46 C20 27 38 15 60 14 Z"/>
      <path stroke-width="1.1" d="${spokes(60, 46, 6, 31, 14, 0.1)}"/>
      <path class="k-pale" stroke-width="1.8" d="M36 54 C38 38 48 30 60 30 C72 30 82 38 84 54 C76 59 44 59 36 54 Z"/>
      <path stroke-width="0.9" d="M46 41 q2 -1.4 4 0 M56 36 q2 -1.4 4 0 M66 40 q2 -1.4 4 0 M42 49 q2 -1.4 4 0 M52 46 q2 -1.4 4 0 M62 47 q2 -1.4 4 0 M72 48 q2 -1.4 4 0 M58 53 q2 -1.4 4 0 M48 53 q2 -1.4 4 0 M70 54 q2 -1.4 4 0"/>
      <path class="k-mid" stroke-width="1.5" d="M60 78 C61 82 63 85 66 87"/>`,
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

// Covers, 400 by 250, one subject each. A scene has up to five layers: back (flat shapes on the field), paper (the
// cut-outs), under (flat shading on the paper), ink (lines, with the pen tremor) and crisp (text and dots).

const P = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n1(x)} ${n1(y)}`).join(' ');

const curve = ([a, b, c, d]) => `M${a.join(' ')} C${b.join(' ')} ${c.join(' ')} ${d.join(' ')}`;

function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
}

// A chopstick or a pole: a long narrow shape, wider at the far end.
function stick(x1, y1, x2, y2, w1, w2) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  return `${P([[x1 + (nx * w1) / 2, y1 + (ny * w1) / 2], [x2 + (nx * w2) / 2, y2 + (ny * w2) / 2], [x2 - (nx * w2) / 2, y2 - (ny * w2) / 2], [x1 - (nx * w1) / 2, y1 - (ny * w1) / 2]])} Z`;
}

// A small pine: a trunk and three tiers.
function pine(x, y, s = 1) {
  const t = (w, a, b) => `M${n1(x - w * s)} ${n1(y - a * s)} L${n1(x)} ${n1(y - b * s)} L${n1(x + w * s)} ${n1(y - a * s)}`;
  return `<path stroke-width="1.4" d="M${x} ${y} v${n1(-6 * s)} ${t(7, 5, 12)} ${t(6, 10, 17)} ${t(4, 15, 21)}"/>`;
}

// Short parallel strokes along a line, for shading.
function hatch(x1, y1, x2, y2, n, dx, dy, w = 1.2) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    d += `M${n1(x1 + (x2 - x1) * t)} ${n1(y1 + (y2 - y1) * t)} l${dx} ${dy} `;
  }
  return `<path stroke-width="${w}" d="${d.trim()}"/>`;
}

// Rows of nested arcs: the wave pattern of Vietnamese woodblock prints.
function scales(x0, y0, x1, y1, r) {
  let d = '';
  let row = 0;
  for (let y = y0; y <= y1; y += r * 0.95, row++) {
    for (let x = x0 + (row % 2 ? r : 0); x <= x1 + r; x += r * 2) {
      for (const k of [1, 0.62, 0.28]) d += `M${n1(x - r * k)} ${n1(y)} A${n1(r * k)} ${n1(r * k)} 0 0 1 ${n1(x + r * k)} ${n1(y)} `;
    }
  }
  return d.trim();
}

function phoScene() {
  const band = (o) => [[99 + o, 147 + o * 3], [130, 161 + o * 3], [262, 161 + o * 3], [293 - o, 147 + o * 3]];
  const mid = band(2);
  let curls = '';
  for (let i = 0; i < 13; i++) {
    const [x, y] = cubicAt(...mid, 0.06 + (i * 0.88) / 12);
    curls += `M${n1(x - 4)} ${n1(y + 3)} c0 -5 7 -6 8 -1 c0 3 -4 3 -4 1 `;
  }
  const petals = [[150, 191], [165, 195], [180, 197], [196, 198], [212, 197], [227, 195], [242, 191]].map(([x, y]) => `M${x - 6} ${y} q6 -13 12 0`).join(' ');
  const steam = [[136, 116, 80], [160, 113, 92], [184, 116, 70]].map(([x, y, h]) => `M${x} ${y} c-10 ${n1(-h * 0.18)} 8 ${n1(-h * 0.32)} 0 ${n1(-h * 0.5)} c-8 ${n1(-h * 0.18)} 9 ${n1(-h * 0.32)} 2 ${n1(-h * 0.5)}`).join(' ');
  const noodles = [
    'M219 92 C214 102 222 109 217 118 C214 124 216 129 214 133',
    'M223 93 C219 103 229 110 224 120 C221 126 224 130 222 134',
    'M227 95 C224 105 234 112 229 122 C226 128 230 131 228 135',
    'M231 96 C229 106 239 113 234 123 C232 128 235 131 234 135',
    'M235 97 C235 107 244 114 239 124 C237 129 240 132 239 135',
  ].join(' ');
  const rings = [[176, 127], [190, 135], [264, 131], [142, 125], [230, 138], [256, 124], [118, 136]].map(([x, y]) => `<circle class="k-paper" stroke-width="1.2" cx="${x}" cy="${y}" r="2.6"/>`).join('');
  const leaf = (x, y, a = 0) => `<g transform="rotate(${a} ${x} ${y})"><path class="k-paper" stroke-width="1.2" d="M${x} ${y} q5 -7 11 -3 q-5 6 -11 3 Z M${x} ${y} q-6 -6 -10 -1 q6 4 10 1 Z"/><path stroke-width="0.9" d="M${x} ${y} l9 -3 M${x} ${y} l-8 -2"/></g>`;
  return {
    tone: 'warm',
    paper: blob(200, 126, 166, 104, 11, 11, 0.06),
    under: '<ellipse class="k-mid" cx="198" cy="219" rx="92" ry="6.5"/>',
    ink: `<path class="k-paper" d="M166 204 L161 217 C177 220 215 220 231 217 L226 204"/>
      <path class="k-paper" d="M90 133 C94 180 140 205 196 205 C252 205 298 180 302 133 Z"/>
      <path stroke-width="1.5" d="${curve(band(0))}"/>
      <path stroke-width="1.5" d="${curve(band(4))}"/>
      <path stroke-width="1.3" d="${curls.trim()}"/>
      <path stroke-width="1.3" d="${petals}"/>
      <ellipse class="k-paper" cx="196" cy="132" rx="106" ry="16"/>
      <ellipse class="k-tint" stroke-width="1.5" cx="196" cy="132" rx="99" ry="12.5"/>
      <path class="k-mid" stroke-width="1.4" d="M120 131 C126 124 150 122 160 128 C152 135 130 137 120 131 Z M206 126 C214 119 238 119 246 125 C238 131 216 133 206 126 Z M150 138 C158 133 178 133 186 138 C178 143 158 143 150 138 Z"/>
      <path stroke-width="1.1" d="M127 130 q10 -4 23 -2 M213 125 q10 -4 23 -2 M157 138 q9 -3 21 -1"/>
      ${rings}${leaf(198, 128, -8)}${leaf(276, 133, 10)}${leaf(140, 135, 4)}
      <path stroke-width="1.3" d="M166 137 c10 -4 20 2 30 -2 M200 141 c8 -3 16 1 24 -1"/>
      <path class="k-pale" stroke-width="1.6" d="M290 131 C294 117 311 113 320 123 C310 125 298 128 290 131 Z"/>
      <path stroke-width="1.1" d="M295 128 L306 118 M301 127 L313 119"/>
      <path class="k-paper" stroke-width="1.6" d="${stick(126, 127, 92, 98, 5, 8)}"/>
      <path class="k-paper" stroke-width="1.6" d="${stick(222, 91, 322, 14, 2.4, 5.2)}"/>
      <path class="k-paper" stroke-width="1.6" d="${stick(233, 95, 334, 22, 2.4, 5.2)}"/>
      <path stroke-width="1.4" d="${noodles}"/>
      <path stroke-width="1.4" d="${steam}"/>`,
  };
}

function marketScene() {
  const bays = [[70, 44], [130, 44], [200, 58], [270, 44], [330, 44]];
  const arch = ([cx, w], grow = 0) => {
    const r = w / 2 + grow;
    const spring = (w > 50 ? 146 : 156) - grow * 0.2;
    return `M${n1(cx - r)} 214 V${n1(spring)} A${n1(r)} ${n1(r)} 0 0 1 ${n1(cx + r)} ${n1(spring)} V214`;
  };
  const keystones = bays.map(([cx, w]) => { const top = (w > 50 ? 146 : 156) - w / 2 - 6; return `M${cx - 4} ${top} h8 l-1.5 9 h-5 Z`; }).join(' ');
  const pilasters = [100, 160, 240, 300].map((x) => `M${x - 3} 101 V214 M${x + 3} 101 V214`).join(' ');
  const windows = [70, 130, 270, 330].map((cx) => `M${cx - 9} 128 V114 A9 9 0 0 1 ${cx + 9} 114 V128 Z M${cx} 105 V128`).join(' ');
  let dentils = '';
  for (let x = 36; x <= 362; x += 8) dentils += `M${x} 95 v4 `;
  let tiles = '';
  for (let x = 18; x <= 390; x += 22) tiles += `M${x} 222 l-6 22 `;
  const basket = (cx) => `<path class="k-pale" stroke-width="1.6" d="M${cx - 15} 196 H${cx + 15} L${cx + 11} 212 H${cx - 11} Z"/><path stroke-width="1" d="M${cx - 13} 201 H${cx + 13} M${cx - 12} 206 H${cx + 12} M${cx - 5} 196 L${cx - 4} 212 M${cx + 5} 196 L${cx + 4} 212"/>`;
  return {
    tone: 'earth',
    paper: 'M30 92 L370 91 L371 215 L29 216 Z M136 92 L136 58 L200 32 L264 58 L264 92 Z',
    ink: `<path d="M29 216 L30 92 L370 91 L371 215"/><path d="M24 92 H376 M28 101 H372"/>
      <path stroke-width="1.1" d="${dentils.trim()}"/>
      <path d="M136 92 L136 58 L200 32 L264 58 L264 92"/><path stroke-width="1.5" d="M142 60 L200 38 L258 60"/>
      <path class="k-tint" stroke-width="1.6" d="M141 62 H259 V86 H141 Z"/>
      <path stroke-width="1.5" d="${pilasters}"/>
      ${bays.map((b) => `<path class="k-shade" stroke-width="1.8" d="${arch(b)}"/><path stroke-width="1.3" d="${arch(b, 5)}"/>`).join('')}
      <path class="k-paper" stroke-width="1.3" d="${keystones}"/>
      <path class="k-pale" stroke-width="1.4" d="${windows}"/>
      <path d="M6 216 H394"/><path stroke-width="1.1" d="${tiles.trim()}"/>
      <path class="k-paper" stroke-width="1.6" d="${stick(52, 176, 176, 174, 3, 3)}"/>
      <path stroke-width="1.2" d="M62 176 L50 196 M62 176 L74 196 M166 175 L154 196 M166 175 L178 196"/>
      ${basket(62)}${basket(166)}
      <path class="k-paper" stroke-width="1.6" d="M104 172 C102 182 100 196 98 208 H122 C120 196 118 182 116 172 Z"/>
      <path stroke-width="1.6" d="M104 208 L102 217 M116 208 L118 217"/>
      <path class="k-paper" stroke-width="1.6" d="M104 174 C98 180 94 176 92 175 M116 174 C124 178 130 176 134 175"/>
      <path class="k-tint" stroke-width="1.6" d="M92 168 L110 146 L128 168 C116 171 104 171 92 168 Z"/>
      <path stroke-width="1" d="M110 146 L100 168 M110 146 L106 169 M110 146 L114 169 M110 146 L120 168"/>`,
    crisp: `<text class="k-text k-sign" x="200" y="78" text-anchor="middle">CHỢ ĐỒNG XUÂN</text><text class="k-text k-year" x="200" y="55" text-anchor="middle">1889</text>${[[55, 193], [62, 191], [69, 193], [159, 193], [166, 191], [173, 193]].map(([x, y]) => `<circle class="k-dot" cx="${x}" cy="${y}" r="3.2"/>`).join('')}`,
  };
}

function legendScene(id) {
  const water = 'M196 252 C206 224 228 214 244 206 C258 198 256 182 270 176 C284 170 296 182 308 178 C322 172 318 158 334 152 C350 146 360 162 374 160 C388 158 394 146 404 144 L406 252 Z';
  const cloud = 'M262 56 C252 56 248 44 256 39 C258 30 270 27 276 33 C281 24 296 23 301 32 C310 28 322 34 320 43 C330 45 330 57 320 58 Z';
  const mountain = 'M-8 252 L-8 236 C22 204 54 158 84 124 L104 140 C124 108 144 80 164 54 C184 86 204 120 224 150 L240 140 C258 170 276 204 300 252 Z';
  const curl = ([x, y], s = 1) => `M${x} ${y} c${n1(6 * s)} ${n1(-10 * s)} ${n1(20 * s)} ${n1(-10 * s)} ${n1(22 * s)} ${n1(-1 * s)} c${n1(1 * s)} ${n1(6 * s)} ${n1(-7 * s)} ${n1(8 * s)} ${n1(-9 * s)} ${n1(3 * s)} c${n1(-1 * s)} ${n1(-3 * s)} ${n1(3 * s)} ${n1(-4 * s)} ${n1(4 * s)} ${n1(-1 * s)}`;
  return {
    tone: 'cool',
    back: '<path class="k-pale" d="M0 176 L34 150 L62 160 L100 128 L132 146 L170 124 L210 150 L252 134 L290 148 L330 130 L370 148 L400 136 V250 H0 Z"/>',
    paper: `${mountain} ${cloud}`,
    defs: `<clipPath id="${id}-sea"><path d="${water}"/></clipPath>`,
    ink: `<path d="${mountain.replace('M-8 252 L-8 236', 'M-8 236').replace(' Z', '')}"/>
      <path stroke-width="1.5" d="M164 54 L156 84 L162 92 L150 124 M84 124 L80 150 L88 162 M164 54 L176 84"/>
      ${hatch(170, 66, 214, 132, 12, 7, -3)}${hatch(232, 152, 276, 214, 9, 7, -3)}${hatch(90, 132, 98, 150, 3, 6, -3)}
      ${pine(118, 196, 1)}${pine(134, 206, 0.9)}${pine(102, 210, 0.85)}${pine(150, 214, 0.8)}${pine(60, 214, 0.9)}
      <path class="k-tint" stroke-width="1.4" d="M154 56 C160 52 168 52 174 56 L172 59 H156 Z"/><path stroke-width="1.3" d="M158 59 V66 M170 59 V66 M154 66 H174"/>
      <path d="${cloud}"/><path stroke-width="1.3" d="M276 33 c-6 6 -2 14 6 12 M301 32 c-4 8 2 14 9 11"/>
      ${hatch(266, 66, 318, 66, 9, -7, 22, 1.2)}
      <path class="k-pale" d="${water}"/>
      <path stroke-width="1.1" clip-path="url(#${id}-sea)" d="${scales(200, 176, 404, 252, 11)}"/>
      <path stroke-width="1.8" d="${[[244, 206], [270, 176], [308, 178], [334, 152], [374, 160]].map((p, i) => curl(p, i % 2 ? 0.9 : 1.1)).join(' ')}"/>`,
  };
}

// Issue 4: a family register (gia phả) unrolled on a table. Its tree is nearly all Nguyễn; the wife keeps her own name.
function genealogyScene() {
  const box = (cx, cy, w = 58) => `M${cx - w / 2} ${cy - 9} H${cx + w / 2} V${cy + 9} H${cx - w / 2} Z`;
  const label = (cx, cy, t) => `<text class="k-text k-sign" x="${cx}" y="${n1(cy + 3.8)}" text-anchor="middle">${t}</text>`;
  const roll = (x) => `<path class="k-shade" stroke-width="1.6" d="M${x - 3} 24 h6 v14 h-6 Z M${x - 3} 212 h6 v14 h-6 Z"/>
      <circle class="k-mid" stroke-width="1.6" cx="${x}" cy="21.5" r="4.8"/><circle class="k-mid" stroke-width="1.6" cx="${x}" cy="228.5" r="4.8"/>
      <path class="k-paper" d="M${x - 7.5} 38 C${x - 7.5} 35.4 ${x + 7.5} 35.4 ${x + 7.5} 38 V212 C${x + 7.5} 214.6 ${x - 7.5} 214.6 ${x - 7.5} 212 Z"/>
      <path stroke-width="1.1" d="M${x - 3.6} 40 V210 M${x + 3.2} 40 V210"/>`;
  const people = [[168, 98], [132, 137], [200, 137], [268, 137], [132, 175], [200, 175]];
  let grain = '';
  for (const [y, a, b] of [[224, 6, 120], [231, 150, 290], [238, 40, 96], [244, 300, 396], [221, 300, 380]]) grain += `M${a} ${y} C${a + (b - a) / 3} ${y - 1.5} ${a + (2 * (b - a)) / 3} ${y + 1.5} ${b} ${y} `;
  return {
    tone: 'warm',
    back: '<path class="k-pale" d="M0 202 C120 199 280 199 400 202 V250 H0 Z"/>',
    paper: 'M86 44 C150 41.5 250 41.5 314 44 V206 C250 208.5 150 208.5 86 206 Z',
    under: '<ellipse class="k-mid" cx="200" cy="217" rx="128" ry="4.5"/>',
    ink: `<path stroke-width="1" d="${grain.trim()}"/>
      <path d="M86 44 C150 41.5 250 41.5 314 44 M86 206 C150 208.5 250 208.5 314 206"/>
      ${roll(79)}${roll(321)}
      <path stroke-width="1" d="M93 51 H307 V199 H93 Z"/>
      <path stroke-width="1.4" d="M97 55 H303 V195 H97 Z M97 62 h7 v-7 M303 62 h-7 v-7 M97 188 h7 v7 M303 188 h-7 v7"/>
      <path stroke-width="1.2" d="M148 75 H252 M144 75 l3 -3 l3 3 l-3 3 Z M250 75 l3 -3 l3 3 l-3 3 Z"/>
      <path stroke-width="1.5" d="M197 96 H223 M197 100 H223 M210 100 V118 M132 118 H268 M132 118 V128 M200 118 V128 M268 118 V128 M132 146 V166 M200 146 V166"/>
      <path class="k-paper" stroke-width="1.6" d="${people.map(([x, y]) => box(x, y)).join(' ')}"/>
      <path class="k-tint" stroke-width="1.6" d="${box(247, 98, 48)}"/>
      <path class="k-shade" stroke-width="1.6" d="M256 163 H280 V187 H256 Z"/>
      <path stroke-width="1.2" d="M259.5 166.5 H276.5 V183.5 H259.5 Z M268 180.5 C263 177 263 172 268 169.5 C273 172 273 177 268 180.5 Z M268 180.5 C264.5 180.5 262 178.5 261.6 175.6 M268 180.5 C271.5 180.5 274 178.5 274.4 175.6"/>
      <path class="k-paper" stroke-width="1.6" d="${stick(134, 241.5, 262, 233, 4.2, 5.4)}"/>
      <path class="k-shade" stroke-width="1.4" d="${stick(134, 241.5, 146, 240.7, 5, 5)}"/>
      <path class="k-dot" d="M134.4 239.4 C126 240.4 119 242.4 112 245.4 C119.6 245.6 127 244.8 134.6 243.6 Z"/>`,
    crisp: `<text class="k-text k-sign" x="200" y="68" text-anchor="middle">GIA PHẢ HỌ NGUYỄN</text>${people.map(([x, y]) => label(x, y, 'NGUYỄN')).join('')}${label(247, 98, 'TRẦN')}`,
  };
}

// Issue 5: a Northern Tết fruit tray (mâm ngũ quả) on a raised dish. A hand of bananas curves up round a pomelo, with
// oranges, persimmons, kumquats and chillies in front and a sprig of peach blossom, the North's Tết flower, above.
function fruitTrayScene() {
  const fingers = [-36, -54, -72];
  const right = fingers.map((d, i) => banana(207, 162 - i * 3, d, 1.42 - i * 0.04, { ridge: 1.4 })).join('');
  const left = fingers.map((d, i) => banana(193, 162 - i * 3, d, 1.42 - i * 0.04, { flip: true, ridge: 1.4 })).join('');
  const P0 = [200, 120];
  const R = 45;
  let shade = '';
  for (let a = 8; a <= 104; a += 8) {
    const t = (a * Math.PI) / 180;
    const x = P0[0] + Math.cos(t) * (R - 7);
    const y = P0[1] + Math.sin(t) * (R - 7);
    shade += `M${n1(x)} ${n1(y)} l4.6 -4.6 `;
  }
  const citrus = (x, y, r) => `<circle class="k-tint" stroke-width="1.8" cx="${x}" cy="${y}" r="${r}"/><path stroke-width="1.4" d="M${x - 1} ${n1(y - r)} c0 -2.6 1.4 -4 3 -4.6"/>`;
  const persimmon = (x, y) => `<ellipse class="k-mid" stroke-width="1.8" cx="${x}" cy="${y}" rx="15" ry="12.5"/>
      <path class="k-shade" stroke-width="1.3" d="M${x} ${y - 12} c-6 -1 -10 1 -12 4 c4 2 8 1 12 -2 c4 3 8 4 12 2 c-2 -3 -6 -5 -12 -4 Z M${x} ${y - 12} c-2 -3 -1 -6 1 -8 c2 2 2 5 -1 8 Z"/>`;
  const blossom = (x, y, r = 5) => `<g stroke-width="1.1">${[0, 1, 2, 3, 4].map((k) => {
    const t = -Math.PI / 2 + (k * 2 * Math.PI) / 5 + 0.3;
    const ux = Math.cos(t);
    const uy = Math.sin(t);
    const tip = [x + ux * r * 1.55, y + uy * r * 1.55];
    const side = (k2) => [x + ux * r * 0.9 - uy * r * 0.62 * k2, y + uy * r * 0.9 + ux * r * 0.62 * k2];
    const [a1, a2] = side(1);
    const [b1, b2] = side(-1);
    return `<path class="k-paper" d="M${n1(x + ux * 1.2)} ${n1(y + uy * 1.2)} C${n1(a1)} ${n1(a2)} ${n1(tip[0] - uy * r * 0.5)} ${n1(tip[1] + ux * r * 0.5)} ${n1(tip[0])} ${n1(tip[1])} C${n1(tip[0] + uy * r * 0.5)} ${n1(tip[1] - ux * r * 0.5)} ${n1(b1)} ${n1(b2)} ${n1(x + ux * 1.2)} ${n1(y + uy * 1.2)} Z"/>`;
  }).join('')}</g>`;
  const flowers = [[48, 21], [80, 43], [23, 19], [97, 63], [36, 49], [63, 33]];
  const buds = [[57, 13], [90, 37], [12, 26], [106, 58]];
  let petals = '';
  for (let x = 124; x <= 276; x += 12) {
    const y = 187.5 - 7.5 * ((x - 200) / 88) ** 2;
    petals += `M${x - 5} ${n1(y - 2)} c1 5.4 9 5.4 10 0 `;
  }
  const dimples = [[183, 92], [196, 86], [212, 90], [176, 104], [190, 100], [205, 98], [221, 103], [170, 118], [184, 114], [199, 111], [214, 115], [228, 118], [178, 130], [193, 126], [208, 128], [222, 132], [186, 142], [201, 140], [214, 146], [194, 154]];
  const pits = [[148, 158], [155, 165], [146, 168], [252, 158], [245, 165], [254, 168], [174, 168], [228, 168]];
  return {
    tone: 'warm',
    back: '<path class="k-pale" d="M0 214 C120 211 280 211 400 214 V250 H0 Z"/>',
    paper: blob(200, 132, 122, 100, 33, 11, 0.06),
    under: '<ellipse class="k-mid" cx="200" cy="225" rx="74" ry="4.6"/>',
    ink: `<path d="M-6 34 C20 39 40 46 62 58 C72 63 84 66 98 64"/>
      <path stroke-width="1.6" d="M31 43 C35 33 41 26 49 21 M62 58 C66 50 72 46 80 43 M13 37 C14 30 18 24 23 19 M45 50 C42 44 40 36 42 30 M84 65 C90 66 96 64 99 62"/>
      ${flowers.map(([x, y]) => blossom(x, y)).join('')}
      ${buds.map(([x, y]) => `<ellipse class="k-tint" stroke-width="1.1" cx="${x}" cy="${y}" rx="3" ry="2.2"/>`).join('')}
      <ellipse class="k-paper" stroke-width="1.8" cx="200" cy="170" rx="92" ry="12"/>
      ${right}${left}
      <circle class="k-pale" cx="${P0[0]}" cy="${P0[1]}" r="${R}"/>
      <path stroke-width="1.2" d="${shade.trim()}"/>
      <path stroke-width="1.8" d="M200 75.4 C199.4 70.6 200.4 66.4 202.6 63"/>
      <path class="k-paper" stroke-width="1.6" d="M201.6 66 C194 55 181 52 172 56 C179 65 192 69 201.6 66 Z M203.4 66 C210 56 222 52 231 55 C225 64 213 69 203.4 66 Z"/>
      <path stroke-width="1.1" d="M199 64.8 C191 60 183 57.6 175 57 M205.6 64.6 C213 59.6 221 57 228.6 56.2"/>
      ${persimmon(126, 167)}${persimmon(274, 167)}
      ${citrus(152, 162, 15)}${citrus(248, 162, 15)}${citrus(176, 170, 12)}${citrus(224, 170, 12)}
      ${[[193, 172], [203, 171], [198, 164], [208, 165]].map(([x, y]) => `<circle class="k-tint" stroke-width="1.5" cx="${x}" cy="${y}" r="5.4"/>`).join('')}
      <path class="k-paper" stroke-width="1.3" d="M211 162 C216 157 224 157 228 160 C223 164 216 165 211 162 Z M189 162 C184 157 176 157 172 160 C177 164 184 165 189 162 Z"/>
      <path stroke-width="1" d="M212.6 161.6 C217 160 222 159.6 226 160 M187.4 161.6 C183 160 178 159.6 174 160"/>
      <path class="k-paper" d="M108 170 C108 177 150 182 200 182 C250 182 292 177 292 170 L290 173 C284 189 246 199 200 199 C154 199 116 189 110 173 Z"/>
      <path stroke-width="1.2" d="${petals.trim()}"/>
      ${hatch(258, 186, 282, 176, 6, -3.4, 5.4, 1.1)}
      <path class="k-paper" d="M187 198 C190 203 190 207 186 212 H214 C210 207 210 203 213 198 Z"/>
      <path class="k-tint" stroke-width="1.5" d="M188.4 203 H211.6 V207 H188.4 Z"/>
      <path class="k-tint" d="M168 224 C175 216 183 213 186 212 H214 C217 213 225 216 232 224 C220 227.4 180 227.4 168 224 Z"/>
      ${hatch(218, 216, 228, 222, 4, -2.6, 3.4, 1.1)}`,
    crisp: `${dimples.map(([x, y]) => `<circle class="k-dot" cx="${x}" cy="${y}" r="0.95"/>`).join('')}${pits.map(([x, y]) => `<circle class="k-dot" cx="${x}" cy="${y}" r="0.8"/>`).join('')}${flowers.map(([x, y]) => `<circle class="k-dot" cx="${x}" cy="${y}" r="1.5"/>`).join('')}`,
  };
}

const SCENES = { phoStall: phoScene, market: marketScene, legend: legendScene, genealogy: genealogyScene, fruitTray: fruitTrayScene };

function scene(name) {
  const make = SCENES[name];
  if (!make) return '';
  const id = `vw-ink-${++uid}`;
  const s = make(id);
  return `<svg class="pic scene ink-pic k-${s.tone}" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${tremor(id, 400, 250, 0.035, 1.6)}${s.defs || ''}</defs><rect class="k-field" x="0" y="0" width="400" height="250"/>${s.back || ''}<path class="k-carrier" d="${s.paper}"/>${s.under || ''}<g class="k-ink" stroke-width="2.2" filter="url(#${id})">${s.ink}</g>${s.crisp || ''}</svg>`;
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

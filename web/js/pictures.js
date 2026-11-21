// Pictures for words: small drawings of things (icons) and diagrams of quantities, coloured by the active style.

const VB = '0 0 120 90';

function svg(body) {
  return `<svg class="pic" viewBox="${VB}" aria-hidden="true">${body}</svg>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const STEAM = `<g class="s-soft"><path d="M46 28 q-5 -6 0 -12 q5 -6 0 -12"/><path d="M60 26 q-5 -6 0 -12 q5 -6 0 -12"/><path d="M74 28 q-5 -6 0 -12 q5 -6 0 -12"/></g>`;
const FOOT = `<path class="f-paper" d="M46 78 h28 l-3 8 h-22 z"/>`;
const BOWL = `<path class="f-paper" d="M16 46 C18 70 38 82 60 82 C82 82 102 70 104 46"/><path class="s-water" d="M24 58 C40 66 80 66 96 58"/>`;

const ICONS = {
  bowl: `${STEAM}
    <line class="s-brown thick" x1="80" y1="8" x2="98" y2="50"/><line class="s-brown thick" x1="88" y1="6" x2="104" y2="48"/>
    ${FOOT}
    <ellipse class="f-gold" cx="60" cy="46" rx="44" ry="8"/>
    <path class="s-noodle" d="M28 46 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0"/>
    <ellipse class="f-brown ns" cx="70" cy="44" rx="8" ry="3"/>
    <ellipse class="f-leaf ns" cx="46" cy="43" rx="6" ry="2.4" transform="rotate(-20 46 43)"/>
    <ellipse class="f-leaf ns" cx="54" cy="45" rx="5" ry="2.2" transform="rotate(25 54 45)"/>
    ${BOWL}
    <ellipse class="s-ink" cx="60" cy="46" rx="44" ry="8"/>`,
  ricebowl: `<line class="s-brown thick" x1="18" y1="20" x2="104" y2="34"/><line class="s-brown thick" x1="18" y1="27" x2="104" y2="38"/>
    ${FOOT}
    ${BOWL}
    <path class="f-paper" d="M20 47 C24 24 96 24 100 47 Z"/>
    <g class="f-soft ns"><ellipse cx="44" cy="36" rx="3" ry="1.6"/><ellipse cx="58" cy="31" rx="3" ry="1.6"/><ellipse cx="72" cy="36" rx="3" ry="1.6"/><ellipse cx="52" cy="42" rx="3" ry="1.6"/><ellipse cx="66" cy="42" rx="3" ry="1.6"/><ellipse cx="82" cy="42" rx="3" ry="1.6"/><ellipse cx="36" cy="42" rx="3" ry="1.6"/></g>`,
  noodles: `<ellipse class="f-soft" cx="60" cy="62" rx="50" ry="18"/>
    <g class="s-ink fine">
      <ellipse cx="42" cy="56" rx="16" ry="8"/><ellipse cx="44" cy="54" rx="12" ry="6"/><ellipse cx="40" cy="57" rx="9" ry="4"/>
      <ellipse cx="78" cy="56" rx="16" ry="8"/><ellipse cx="76" cy="54" rx="12" ry="6"/><ellipse cx="80" cy="57" rx="9" ry="4"/>
      <ellipse cx="60" cy="66" rx="16" ry="8"/><ellipse cx="62" cy="64" rx="12" ry="6"/><ellipse cx="58" cy="67" rx="9" ry="4"/>
    </g>
    <ellipse class="f-leaf ns" cx="92" cy="40" rx="9" ry="3.5" transform="rotate(-30 92 40)"/>
    <ellipse class="f-leaf ns" cx="100" cy="46" rx="8" ry="3" transform="rotate(10 100 46)"/>`,
  baguette: `<path class="f-gold" d="M12 62 C12 44 40 32 72 26 C98 21 110 28 108 38 C106 50 82 58 52 66 C30 72 12 72 12 62 Z"/>
    <path class="s-leaf thick" d="M24 62 C46 56 76 48 98 38"/>
    <g class="s-brown"><path d="M36 46 q6 4 10 0"/><path d="M54 40 q6 4 10 0"/><path d="M72 34 q6 4 10 0"/><path d="M88 30 q5 3 8 0"/></g>`,
  chicken: `<g class="f-bad ns"><path d="M76 22 q2 -8 7 -4 q3 -7 8 -1 q5 -4 6 4 z"/><ellipse cx="94" cy="42" rx="3" ry="5"/></g>
    <g class="f-brown ns"><ellipse cx="26" cy="46" rx="12" ry="5" transform="rotate(-40 26 46)"/><ellipse cx="24" cy="54" rx="12" ry="5" transform="rotate(-15 24 54)"/></g>
    <g class="f-orange ns"><ellipse cx="54" cy="56" rx="28" ry="20"/><ellipse cx="74" cy="44" rx="10" ry="14"/><circle cx="84" cy="32" r="11"/></g>
    <polygon class="f-gold ns" points="94,30 104,34 94,37"/>
    <ellipse class="f-gold ns" cx="50" cy="56" rx="14" ry="9" transform="rotate(-10 50 56)"/>
    <circle class="f-ink ns" cx="86" cy="30" r="2"/>
    <g class="s-brown thick"><polyline points="50,74 48,86 42,88"/><polyline points="62,74 62,86 68,88"/></g>`,
  cow: `<g class="f-gold ns"><path d="M36 26 q-12 -4 -14 -16 q10 6 18 10 z"/><path d="M84 26 q12 -4 14 -16 q-10 6 -18 10 z"/></g>
    <g class="f-paper"><ellipse cx="26" cy="36" rx="12" ry="6" transform="rotate(20 26 36)"/><ellipse cx="94" cy="36" rx="12" ry="6" transform="rotate(-20 94 36)"/></g>
    <path class="f-paper" d="M38 22 h44 q8 0 8 10 v26 q0 12 -14 14 h-32 q-14 -2 -14 -14 v-26 q0 -10 8 -10 z"/>
    <path class="f-ink ns" d="M38 22 h14 q2 10 -6 16 q-10 2 -16 -4 v-2 q0 -10 8 -10 z"/>
    <ellipse class="f-pink" cx="60" cy="66" rx="22" ry="13"/>
    <g class="f-ink ns"><ellipse cx="52" cy="66" rx="3" ry="4"/><ellipse cx="68" cy="66" rx="3" ry="4"/><circle cx="48" cy="42" r="3"/><circle cx="72" cy="42" r="3"/></g>`,
  fish: `<polygon class="f-water" points="18,30 40,45 18,60"/>
    <ellipse class="f-water" cx="66" cy="45" rx="36" ry="19"/>
    <path class="f-water" d="M56 28 q8 -12 22 -6 l-6 8 z"/>
    <g class="s-paper fine"><path d="M54 38 q4 7 0 14"/><path d="M64 36 q4 9 0 18"/><path d="M74 37 q4 8 0 16"/></g>
    <circle class="f-paper" cx="88" cy="41" r="5"/><circle class="f-ink ns" cx="89" cy="41" r="2.4"/>
    <path class="s-ink" d="M96 52 q-4 3 -8 1"/>`,
  greens: `<path class="s-leaf thick" d="M60 86 C60 70 58 56 54 44 M60 86 C62 66 70 52 82 40 M60 86 C58 70 46 58 34 50"/>
    <g class="f-leaf"><path d="M54 44 C40 30 44 12 56 6 C66 20 64 36 54 44 Z"/><path d="M82 40 C80 22 94 12 108 14 C106 30 96 40 82 40 Z"/><path d="M34 50 C18 50 8 38 10 26 C24 26 34 36 34 50 Z"/></g>
    <g class="s-paper fine"><path d="M54 42 C52 30 54 18 56 10"/><path d="M84 38 C90 30 98 22 104 18"/><path d="M32 48 C26 42 18 34 14 30"/></g>
    <rect class="f-accent" x="52" y="66" width="16" height="8" rx="2"/>`,
  water: `<path class="f-water" d="M60 4 C60 4 44 24 44 34 a16 16 0 0 0 32 0 C76 24 60 4 60 4 Z"/>
    <path class="s-paper thick" d="M52 32 q0 6 5 9"/>
    <path class="f-soft" d="M34 52 h52 l-6 34 h-40 z"/>
    <path class="f-water ns" d="M37 64 h46 l-4 20 h-38 z"/>
    <path class="s-ink" d="M34 52 h52 l-6 34 h-40 z" fill="none"/>`,
  tea: `${STEAM}
    <ellipse class="f-soft" cx="60" cy="80" rx="40" ry="7"/>
    <path class="f-paper" d="M34 40 h52 C86 64 76 78 60 78 C44 78 34 64 34 40 Z"/>
    <ellipse class="f-leaf" cx="60" cy="40" rx="26" ry="5"/>
    <path class="s-water" d="M40 56 C50 62 70 62 80 56"/>`,
  phin: `<rect class="f-soft" x="36" y="40" width="48" height="46" rx="4"/>
    <rect class="f-paper ns" x="38" y="70" width="44" height="14" rx="2"/>
    <rect class="f-brown ns" x="38" y="54" width="44" height="16"/>
    <path class="s-brown thick" d="M60 40 v12"/>
    <rect class="f-steel" x="28" y="34" width="64" height="6" rx="3"/>
    <path class="f-steel" d="M40 12 h40 l-4 22 h-32 z"/>
    <rect class="f-steel" x="38" y="6" width="44" height="8" rx="3"/>
    <circle class="f-steel" cx="60" cy="4" r="3"/>`,
  yum: `<circle class="f-gold" cx="60" cy="46" r="34"/>
    <g class="s-ink thick"><path d="M40 38 q6 -7 12 0"/><path d="M68 38 q6 -7 12 0"/></g>
    <path class="f-ink" d="M42 52 q18 22 36 0 z"/>
    <path class="f-pink ns" d="M52 60 q8 10 16 0 q-8 -4 -16 0 z"/>
    <g class="f-accent ns"><path d="M100 14 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z"/><path d="M16 64 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z"/></g>`,
};

function dots(n) {
  const cols = n <= 10 ? 5 : 10;
  const rows = Math.ceil(n / cols);
  const gap = n <= 10 ? 16 : n <= 30 ? 10.5 : 7.4;
  const r = n <= 10 ? 6 : n <= 30 ? 4.2 : 2.8;
  const w = (cols - 1) * gap;
  const h = (rows - 1) * gap;
  const x0 = 60 - w / 2;
  const y0 = 45 - h / 2;
  let out = '';
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i % cols) * gap;
    const cy = y0 + Math.floor(i / cols) * gap;
    out += `<circle class="f-accent ns" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}"/>`;
  }
  const frame = n <= 10 ? `<rect class="s-soft" x="${x0 - 12}" y="${y0 - 12}" width="${w + 24}" height="${h + 24}" rx="6" fill="none"/>` : '';
  return svg(frame + out);
}

function blocks() {
  let out = '';
  for (let t = 0; t < 10; t++) {
    const x = 8 + (t % 5) * 21.6;
    const y = 16 + Math.floor(t / 5) * 30;
    out += `<rect class="f-accent" x="${x.toFixed(1)}" y="${y}" width="18" height="18" rx="1.5"/>`;
    for (let k = 1; k < 10; k++) {
      const d = (k * 1.8).toFixed(1);
      out += `<line class="s-paper hair" x1="${(x + +d).toFixed(1)}" y1="${y}" x2="${(x + +d).toFixed(1)}" y2="${y + 18}"/>`;
      out += `<line class="s-paper hair" x1="${x.toFixed(1)}" y1="${(y + +d).toFixed(1)}" x2="${(x + 18).toFixed(1)}" y2="${(y + +d).toFixed(1)}"/>`;
    }
  }
  return svg(out);
}

function fit(label, width, max) {
  return Math.min(max, width / (Math.max(1, [...label].length) * 0.62)).toFixed(1);
}

function big(label) {
  return svg(`<rect class="f-soft" x="6" y="22" width="108" height="46" rx="10"/><text class="t-pic big-text" x="60" y="${52 + fit(label, 96, 26) / 4}" font-size="${fit(label, 96, 26)}" text-anchor="middle">${esc(label)}</text>`);
}

function notes() {
  const one = (x, y, r, label, cls) =>
    `<g transform="rotate(${r} ${x + 34} ${y + 18})"><rect class="${cls}" x="${x}" y="${y}" width="68" height="36" rx="4"/><circle class="s-paper" cx="${x + 18}" cy="${y + 18}" r="9" fill="none"/><text class="t-note" x="${x + 62}" y="${y + 30}" text-anchor="end">${label}</text></g>`;
  return svg(one(14, 34, -14, '10.000', 'f-water') + one(26, 26, -4, '50.000', 'f-pink') + one(38, 22, 8, '100.000', 'f-leaf'));
}

function coin(label) {
  return svg(`<circle class="f-gold" cx="60" cy="45" r="34"/><circle class="s-brown" cx="60" cy="45" r="26" fill="none"/><text class="t-pic coin-text" x="60" y="57" text-anchor="middle">${esc(label || '₫')}</text>`);
}

function tag(label, mood) {
  const cls = mood === 'high' ? 'f-bad' : mood === 'low' ? 'f-good' : 'f-gold';
  const arrow =
    mood === 'high'
      ? '<path class="s-bad thick" d="M108 70 V28 M99 37 l9 -9 l9 9" fill="none"/>'
      : mood === 'low'
        ? '<path class="s-good thick" d="M108 28 V70 M99 61 l9 9 l9 -9" fill="none"/>'
        : '';
  const fs = fit(label, 56, 22);
  return svg(`<path class="${cls}" d="M4 45 L24 22 H96 V68 H24 Z"/><circle class="f-paper" cx="20" cy="45" r="4.5"/><text class="t-tag" x="62" y="${45 + fs / 3}" font-size="${fs}" text-anchor="middle">${esc(label)}</text>${arrow}`);
}

function question(n) {
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle class="f-accent ns" cx="${22 + i * 16}" cy="58" r="6"/>`;
  return svg(`${out}<text class="t-pic q-text" x="88" y="66" text-anchor="middle">?</text>`);
}

function digits(label, mark) {
  const chars = [...label];
  const w = 26;
  const x0 = 60 - (chars.length * w) / 2;
  let out = '';
  chars.forEach((c, i) => {
    const x = x0 + i * w;
    out += `<rect class="${i === mark ? 'f-accent' : 'f-soft'}" x="${x + 1}" y="22" width="${w - 2}" height="38" rx="5"/><text class="t-pic digit-text${i === mark ? ' on' : ''}" x="${x + w / 2}" y="50" text-anchor="middle">${esc(c)}</text>`;
  });
  if (mark != null && mark >= 0) out += `<path class="s-accent thick" d="M${x0 + mark * w + w / 2} 66 v12" fill="none"/>`;
  return svg(out);
}

function halves(n) {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  const count = whole + (half ? 1 : 0);
  const gap = 34;
  const x0 = 60 - ((count - 1) * gap) / 2;
  let out = '';
  for (let i = 0; i < whole; i++) out += `<circle class="f-accent" cx="${x0 + i * gap}" cy="45" r="15"/>`;
  if (half) {
    const cx = x0 + whole * gap;
    out += `<circle class="s-soft" cx="${cx}" cy="45" r="15" fill="none"/><path class="f-accent" d="M${cx} 30 A15 15 0 0 0 ${cx} 60 Z"/>`;
  }
  return svg(out);
}

function plus(n) {
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle class="f-soft" cx="${18 + i * 20}" cy="45" r="8"/>`;
  const px = 18 + n * 20;
  out += `<path class="s-ink thick" d="M${px} 39 v12 M${px - 6} 45 h12" fill="none"/><circle class="f-accent" cx="${px + 22}" cy="45" r="10"/>`;
  return svg(out);
}

function compare() {
  return svg(`<rect class="f-soft" x="26" y="46" width="26" height="36" rx="3"/><rect class="f-accent" x="68" y="14" width="26" height="68" rx="3"/><path class="s-ink thick" d="M16 82 H104" fill="none"/><path class="s-accent thick" d="M44 34 l14 -14 M58 20 h-10 M58 20 v10" fill="none"/>`);
}

function halfCircle() {
  return svg(`<circle class="f-soft" cx="60" cy="45" r="32"/><path class="f-accent" d="M60 13 A32 32 0 0 0 60 77 Z"/><path class="s-ink" d="M60 8 V82" stroke-dasharray="4 4" fill="none"/>`);
}

// Returns an SVG string for a lesson picture spec such as { "kind": "icon", "name": "bowl" } or { "kind": "dots", "n": 100 }.
export function picture(spec) {
  if (!spec || typeof spec !== 'object') return '';
  switch (spec.kind) {
    case 'icon':
      return ICONS[spec.name] ? svg(ICONS[spec.name]) : '';
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
    default:
      return '';
  }
}

export const PICTURE_KINDS = ['icon', 'dots', 'blocks', 'big', 'notes', 'coin', 'tag', 'question', 'digits', 'halves', 'plus', 'half', 'compare'];
export const ICON_NAMES = Object.keys(ICONS);

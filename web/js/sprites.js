// Drawings for the lesson villains. Each lesson's foe names one of these in "art".

const MOSQUITO = `
<svg class="sprite" viewBox="0 0 100 100" aria-hidden="true">
  <g class="sprite-wings">
    <ellipse cx="30" cy="40" rx="20" ry="9" transform="rotate(-28 30 40)" fill="#cfe6ff" fill-opacity="0.75" stroke="#7aa7d6" stroke-width="1.5"/>
    <ellipse cx="70" cy="40" rx="20" ry="9" transform="rotate(28 70 40)" fill="#cfe6ff" fill-opacity="0.75" stroke="#7aa7d6" stroke-width="1.5"/>
  </g>
  <g stroke="#2a2a38" stroke-width="2" stroke-linecap="round" fill="none">
    <polyline points="43,60 30,66 24,80"/>
    <polyline points="57,60 70,66 76,80"/>
    <polyline points="44,68 34,78 32,92"/>
    <polyline points="56,68 66,78 68,92"/>
  </g>
  <ellipse cx="50" cy="66" rx="10" ry="19" fill="#3d3d55"/>
  <g stroke="#6b6b8a" stroke-width="2">
    <line x1="41" y1="62" x2="59" y2="62"/>
    <line x1="41" y1="70" x2="59" y2="70"/>
    <line x1="43" y1="78" x2="57" y2="78"/>
  </g>
  <line x1="44" y1="49" x2="26" y2="62" stroke="#2a2a38" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="50" cy="42" r="12" fill="#4b4b68"/>
  <circle cx="45" cy="41" r="4.5" fill="#ffffff"/>
  <circle cx="55" cy="41" r="4.5" fill="#ffffff"/>
  <circle cx="46" cy="42" r="2.2" fill="#d62828"/>
  <circle cx="54" cy="42" r="2.2" fill="#d62828"/>
  <line x1="39" y1="35" x2="47" y2="38" stroke="#15151f" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="61" y1="35" x2="53" y2="38" stroke="#15151f" stroke-width="2.5" stroke-linecap="round"/>
  <polygon points="40,31 42,21 46,27 50,18 54,27 58,21 60,31" fill="#f6c445" stroke="#c99a1e" stroke-width="1.2"/>
</svg>`;

const CAT = `
<svg class="sprite" viewBox="0 0 100 100" aria-hidden="true">
  <ellipse cx="50" cy="68" rx="30" ry="24" fill="#f0a35e"/>
  <path d="M74 78 q18 -4 14 -22" fill="none" stroke="#f0a35e" stroke-width="7" stroke-linecap="round"/>
  <polygon points="31,30 34,12 46,24" fill="#e08d45"/>
  <polygon points="69,30 66,12 54,24" fill="#e08d45"/>
  <polygon points="34,27 36,17 43,24" fill="#f7c9a0"/>
  <polygon points="66,27 64,17 57,24" fill="#f7c9a0"/>
  <circle cx="50" cy="38" r="21" fill="#f0a35e"/>
  <path d="M38 36 q4 -3 8 0" fill="none" stroke="#3a2a1a" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M54 36 q4 -3 8 0" fill="none" stroke="#3a2a1a" stroke-width="2.5" stroke-linecap="round"/>
  <polygon points="47,43 53,43 50,46" fill="#e7708b"/>
  <path d="M50 46 q-3 4 -7 2 M50 46 q3 4 7 2" fill="none" stroke="#3a2a1a" stroke-width="1.8" stroke-linecap="round"/>
  <g stroke="#3a2a1a" stroke-width="1.3" stroke-linecap="round">
    <line x1="36" y1="45" x2="22" y2="42"/>
    <line x1="36" y1="48" x2="22" y2="50"/>
    <line x1="64" y1="45" x2="78" y2="42"/>
    <line x1="64" y1="48" x2="78" y2="50"/>
  </g>
  <path d="M30 76 h40 q-2 14 -20 14 q-18 0 -20 -14 z" fill="#ffffff" stroke="#c9b9a6" stroke-width="1.5"/>
  <path d="M33 76 q17 -6 34 0" fill="#f3d9a4"/>
  <line x1="58" y1="58" x2="70" y2="80" stroke="#8a5a2b" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="63" y1="57" x2="73" y2="79" stroke="#8a5a2b" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;

const SHADOW = `
<svg class="sprite" viewBox="0 0 100 100" aria-hidden="true">
  <path d="M50 14 c22 0 32 18 32 40 v34 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6 v-34 c0 -22 10 -40 32 -40 z" fill="#5b5f7a"/>
  <circle cx="40" cy="46" r="6" fill="#ffffff"/>
  <circle cx="60" cy="46" r="6" fill="#ffffff"/>
  <circle cx="41" cy="47" r="3" fill="#15151f"/>
  <circle cx="61" cy="47" r="3" fill="#15151f"/>
</svg>`;

export const SPRITES = { mosquito: MOSQUITO, cat: CAT, shadow: SHADOW };

export function sprite(name) {
  return SPRITES[name] || SHADOW;
}

export const HEART =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>';

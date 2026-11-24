#!/usr/bin/env python3
"""Draws every picture (word icons, diagrams, cover scenes) on one sheet per style, to check new art.

  /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 scripts/picture_sheet.py
  ... scripts/picture_sheet.py --style paper --style lacquer --out .checks/pictures
  ... scripts/picture_sheet.py --covers      only the covers, at 800 by 500 (how a Mac shows an issue's opening)
  ... scripts/picture_sheet.py --only stall,eggs,oldQuarter   only these pictures (new art)

Writes <out>-<style>.png (default .checks/pictures-<style>.png). Pictures are shown at the sizes the
site uses: covers at 400 by 250, word pictures at the word-card size and as tiny list thumbnails.
"""

import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_site import BASE, serve  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
STYLES = ["paper", "paper-dark", "ink", "lacquer", "indigo", "celadon", "silk"]

PAGE = """<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css">
<style>
  body { padding: 24px; }
  h2 { font-family: var(--sans); font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 22px 0 10px; }
  .grid { display: flex; flex-wrap: wrap; gap: 14px; }
  .cell { background: var(--card); border: 1px solid var(--rule); border-radius: 6px; padding: 10px; text-align: center; font-family: var(--sans); font-size: 11px; color: var(--muted); }
  .scene-cell .pic-box { width: 400px; height: 250px; }
  body.covers .scene-cell .pic-box { width: 800px; height: 500px; }
  body.covers .only-covers-hide { display: none; }
  .icon-cell .pic-box { width: 160px; height: 120px; }
  .tiny-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .tiny-row .pic-box { width: 40px; height: 30px; }
  .stamp-row .pic-box { width: 70px; height: 56px; }
</style></head>
<body><div class="page"><div id="out"></div></div>
<script type="module">
  import { picture, SCENE_NAMES, ICON_NAMES } from './js/pictures.js';
  const diagrams = [
    { kind: 'dots', n: 1 }, { kind: 'dots', n: 5 }, { kind: 'dots', n: 10 }, { kind: 'dots', n: 30 }, { kind: 'blocks' },
    { kind: 'big', label: '1.000.000' }, { kind: 'notes' }, { kind: 'coin', label: '5.000' }, { kind: 'tag', label: '50.000₫', mood: 'high' },
    { kind: 'tag', label: '?', mood: 'ask' }, { kind: 'question', n: 3 }, { kind: 'digits', label: '105', mark: 1 }, { kind: 'halves', n: 1.5 },
    { kind: 'plus', n: 3 }, { kind: 'half' }, { kind: 'compare' },
  ];
  const label = (s) => s.kind === 'icon' || s.kind === 'scene' ? s.name : `${s.kind}${s.n ? ' ' + s.n : ''}${s.label ? ' ' + s.label : ''}`;
  const cell = (spec, cls) => `<div class="cell ${cls}"><div class="pic-box">${picture(spec)}</div>${label(spec)}</div>`;
  const only = (new URLSearchParams(location.search).get('only') || '').split(',').filter(Boolean);
  const keep = (name) => !only.length || only.includes(name);
  const icons = ICON_NAMES.filter(keep).map((name) => ({ kind: 'icon', name }));
  const scenes = SCENE_NAMES.filter(keep).map((name) => ({ kind: 'scene', name }));
  document.getElementById('out').innerHTML = `
    <h2>Covers</h2><div class="grid">${scenes.map((s) => cell(s, 'scene-cell')).join('')}</div>
    <div class="only-covers-hide"><h2>Word pictures</h2><div class="grid">${icons.map((s) => cell(s, 'icon-cell')).join('')}</div>
    <h2>Diagrams</h2><div class="grid">${diagrams.map((s) => cell(s, 'icon-cell')).join('')}</div>
    <h2>Stamps and thumbnails</h2><div class="tiny-row stamp-row">${scenes.map((s) => `<div class="pic-box stamp-art">${picture(s)}</div>`).join('')}</div>
    <div class="tiny-row" style="margin-top:10px">${[...icons, ...diagrams].map((s) => `<div class="pic-box">${picture(s)}</div>`).join('')}</div></div>`;
  document.body.dataset.ready = '1';
</script></body></html>"""


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--style", action="append", choices=STYLES, help="styles to draw (default: all)")
    parser.add_argument("--out", default=str(ROOT / ".checks" / "pictures"), help="output path prefix")
    parser.add_argument("--covers", action="store_true", help="only the covers, drawn large")
    parser.add_argument("--only", help="comma-separated icon and scene names to draw (default: all)")
    args = parser.parse_args()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.webkit.launch()
        for style in args.style or STYLES:
            dark = style == "paper-dark"
            ctx = browser.new_context(viewport={"width": 1400 if not args.covers else 900, "height": 900}, device_scale_factor=1 if not args.covers else 2, color_scheme="dark" if dark else "light")
            ctx.route(f"{BASE}**", lambda route: route.fulfill(status=200, content_type="text/html", body=PAGE) if route.request.url.split("?")[0].endswith("/_sheet.html") else serve(route))
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"{BASE}_sheet.html" + (f"?only={args.only}" if args.only else ""))
            if style not in ("paper-dark",):
                page.evaluate(f"document.documentElement.dataset.style = '{style}'")
            page.wait_for_selector("body[data-ready='1']")
            if args.covers:
                page.evaluate("document.body.classList.add('covers')")
            page.wait_for_timeout(300)
            path = f"{out}-{style}.png"
            page.screenshot(path=path, full_page=True)
            print(f"{style}: {path}" + (f" ({'; '.join(errors)})" if errors else ""))
            ctx.close()
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())

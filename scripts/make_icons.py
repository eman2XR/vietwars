#!/usr/bin/env python3
"""Renders the app icons (Home Screen and manifest) with a headless browser."""

from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "web" / "icons"
SIZES = {"apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512}

HTML = """<!doctype html><html><body style="margin:0">
<div id="i" style="width:{s}px;height:{s}px;background:#a8322a;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:ui-serif,'New York',Georgia,serif;color:#f6f1e7">
<div style="font-family:-apple-system,sans-serif;font-weight:700;font-size:{g}px;letter-spacing:0.22em;margin-left:0.22em;opacity:0.9">HỌC TIẾNG</div>
<div style="width:{w}px;border-top:{b}px solid #f6f1e7;opacity:0.6;margin:{h}px 0"></div>
<div style="font-weight:600;font-size:{f}px;line-height:1;letter-spacing:-0.02em">Việt</div>
</div></body></html>"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.webkit.launch()
        page = browser.new_page()
        for name, size in SIZES.items():
            page.set_viewport_size({"width": size, "height": size})
            page.set_content(HTML.format(s=size, f=round(size * 0.36), g=round(size * 0.085), w=round(size * 0.5), b=max(1, round(size * 0.008)), h=round(size * 0.04)))
            page.locator("#i").screenshot(path=str(OUT / name))
        browser.close()
    print(f"wrote {len(SIZES)} icons to {OUT}")


if __name__ == "__main__":
    main()

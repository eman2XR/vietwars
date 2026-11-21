#!/usr/bin/env python3
"""Renders the app icons (Home Screen and manifest) with a headless browser."""

from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "web" / "icons"
SIZES = {"apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512}

HTML = """<!doctype html><html><body style="margin:0">
<div id="i" style="width:{s}px;height:{s}px;background:radial-gradient(circle at 30% 20%,#d9573a,#8f1f18 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;
font-family:-apple-system,'Helvetica Neue',sans-serif;">
<div style="color:#fbf7f0;font-weight:900;font-size:{f}px;line-height:1;letter-spacing:-0.02em;margin-top:{m}px">Vi<span style="color:#f6c445">ệ</span>t</div>
<div style="color:#f6c445;font-weight:900;font-size:{g}px;letter-spacing:0.28em;margin-top:{h}px;margin-left:0.28em">WARS</div>
</div></body></html>"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.webkit.launch()
        page = browser.new_page()
        for name, size in SIZES.items():
            page.set_viewport_size({"width": size, "height": size})
            page.set_content(HTML.format(s=size, f=round(size * 0.34), m=round(size * 0.06), g=round(size * 0.13), h=round(size * 0.02)))
            page.locator("#i").screenshot(path=str(OUT / name))
        browser.close()
    print(f"wrote {len(SIZES)} icons to {OUT}")


if __name__ == "__main__":
    main()

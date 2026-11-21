#!/usr/bin/env python3
"""Renders every visual style on an iPhone-sized screen and saves one contact sheet per style.

Output: docs/styles/<style>.jpg (home, article, quiz, word card, tone keys, results)
and docs/STYLES.md, which shows them all. Needs the Framework Python with Playwright:
  /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 scripts/style_shots.py
"""

import base64
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_site import BASE, WEB, serve  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "styles"
DEVICE = "iPhone 15"


def styles():
    src = (WEB / "js" / "main.js").read_text(encoding="utf-8")
    block = src[src.index("export const STYLES") : src.index("];", src.index("export const STYLES"))]
    return re.findall(r"id: '([a-z]+)', name: '([^']+)', vi: '([^']+)', note: '([^']+)'", block)


def shoot(page, style, lesson_id):
    shots = []

    def grab(label):
        page.wait_for_timeout(350)
        shots.append((label, page.screenshot(type="jpeg", quality=82)))

    base = f"{BASE}?test=1&style={style}"
    page.goto(f"{base}#/")
    page.wait_for_selector(".home")
    page.evaluate("localStorage.setItem('vw-progress', JSON.stringify({days: [], lessons: {'lesson-01': {attempts: 1, best: 0.76, grade: 'merit', first: '2026-11-21T07:42:39Z'}}, words: {}, known: []})); localStorage.setItem('vw-settings', JSON.stringify({seen: '3'}))")
    page.goto(f"{base}#/")
    page.wait_for_selector(".home")
    grab("Home")
    page.goto(f"{base}#/lesson/{lesson_id}")
    page.wait_for_selector(".step-feature")
    grab("Article")
    for jump, label in (("quiz", "Quiz"), ("meet", "Word card"), ("type", "Tone keys"), ("results", "Results")):
        page.goto(f"{base}&jump={jump}#/lesson/{lesson_id}")
        page.wait_for_selector(f".step-{jump}")
        if jump == "quiz":
            page.locator(".opt").first.click()
        if jump == "type":
            page.fill(".type-input", "nu")
            page.click(".vkey[data-key='ư']")
            page.fill(".type-input", page.input_value(".type-input") + "a")
            page.click(".vkey[data-key='nga']")
        page.evaluate("window.scrollTo(0, 0)")
        grab(label)
    return shots


def sheet(page, title, shots):
    imgs = "".join(
        f'<figure><img src="data:image/jpeg;base64,{base64.b64encode(b).decode()}"><figcaption>{label}</figcaption></figure>'
        for label, b in shots
    )
    html = f"""<!doctype html><html><body style="margin:0;background:#e9e6e1;font-family:-apple-system,sans-serif">
    <div id="s" style="padding:28px;display:inline-block">
    <h1 style="margin:0 0 18px;font-size:34px;color:#222">{title}</h1>
    <div style="display:grid;grid-template-columns:repeat(6,300px);gap:18px">{imgs}</div></div>
    <style>figure{{margin:0}} img{{width:300px;border-radius:22px;box-shadow:0 6px 18px rgba(0,0,0,.18)}} figcaption{{text-align:center;margin-top:8px;color:#555;font-size:18px}}</style>
    </body></html>"""
    page.set_viewport_size({"width": 2000, "height": 900})
    page.set_content(html)
    return page.locator("#s").screenshot(type="jpeg", quality=80)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = json.loads((WEB / "lessons" / "index.json").read_text(encoding="utf-8"))["lessons"]
    lesson_id = index[-1]["id"]
    found = styles()
    md = ["# Visual styles", "", "Every style, rendered on an iPhone 15 screen by `scripts/style_shots.py`. Pick one in the app under Settings, Look; or preview one by adding `?style=<id>` to the address.", ""]
    with sync_playwright() as p:
        browser = p.webkit.launch()
        for sid, name, vi, note in found:
            ctx = browser.new_context(**p.devices[DEVICE], service_workers="block")
            ctx.route(f"{BASE}**", serve)
            ctx.route("https://api.github.com/**", lambda r: r.fulfill(status=200, body="{}"))
            page = ctx.new_page()
            shots = shoot(page, sid, lesson_id)
            maker = browser.new_page()
            (OUT / f"{sid}.jpg").write_bytes(sheet(maker, f"{name} ({vi}): {note}", shots))
            maker.close()
            ctx.close()
            md += [f"## {name} ({vi})", "", f"`?style={sid}`. {note}.", "", f"![{name}](styles/{sid}.jpg)", ""]
            print(f"{sid}: done")
        browser.close()
    (ROOT / "docs" / "STYLES.md").write_text("\n".join(md), encoding="utf-8")
    print(f"wrote {len(found)} sheets to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

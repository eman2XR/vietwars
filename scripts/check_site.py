#!/usr/bin/env python3
"""Plays through the site in WebKit on several Apple devices and saves screenshots to .checks/.

Serves web/ through request routing (no server), fakes the GitHub API, plays a whole lesson as
a battle (warm-up, "I know it", ambushes, tone keys, the boss round), checks what was saved and
sent, then runs a review. Fails on page errors, horizontal overflow, or missing results.
Needs the Framework Python with Playwright:
  /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 scripts/check_site.py
"""

import argparse
import json
import mimetypes
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
OUT = ROOT / ".checks"
BASE = "https://vietwars.test/"
DEVICES = [
    ("iPhone 15", "light", True),
    ("iPhone SE (3rd gen)", "light", False),
    ("iPad Pro 11", "dark", True),
    ("iPad Pro 11 landscape", "light", False),
    ("Desktop Safari", "light", True),
]
MARKER = re.compile(r"<!-- vietwars-result -->\n```json\n(.*)\n```", re.S)
mimetypes.add_type("audio/mp4", ".m4a")
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("text/javascript", ".js")


def serve(route):
    path = urlparse(route.request.url).path.lstrip("/") or "index.html"
    file = (WEB / path).resolve()
    if WEB.resolve() not in file.parents or not file.is_file():
        route.fulfill(status=404, body="not found")
        return
    route.fulfill(status=200, body=file.read_bytes(), content_type=mimetypes.guess_type(file.name)[0] or "application/octet-stream")


class Run:
    def __init__(self, name, scheme, shots, lesson):
        self.name = name
        self.lesson = lesson
        self.slug = re.sub(r"\W+", "-", name.lower()).strip("-")
        self.scheme = scheme
        self.shots = shots
        self.errors = []
        self.posts = []
        self.shot_steps = set()
        self.n = 0
        self.seen_types = set()

    def shot(self, page, label):
        if not self.shots:
            return
        self.n += 1
        folder = OUT / self.slug
        folder.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(folder / f"{self.n:02d}-{label}.png"), full_page=True)

    def overflow(self, page, where):
        wide = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        if wide > 1:
            self.errors.append(f"{where}: page is {wide}px wider than the screen")

    def console(self, msg):
        if msg.type != "error":
            return
        # Playwright injects a stylesheet when it takes screenshots, which the page's CSP refuses; runs without screenshots still catch real ones.
        if self.shots and "Refused to apply a stylesheet" in msg.text:
            return
        self.errors.append(f"console: {msg.text}")

    def github(self, route):
        req = route.request
        if req.method == "POST" and req.url.endswith("/issues"):
            self.posts.append(json.loads(req.post_data or "{}"))
            route.fulfill(status=201, content_type="application/json", body=json.dumps({"number": len(self.posts)}))
        else:
            route.fulfill(status=200, content_type="application/json", body="{}")

    def first(self, page, label):
        if label not in self.shot_steps:
            self.shot_steps.add(label)
            self.overflow(page, label)
            self.shot(page, label)

    def play_session(self, page, label):
        meets = 0
        typed = 0
        for _ in range(600):
            if page.locator(".done-page").count():
                return True
            step = page.get_attribute(".stage", "data-step")
            classes = page.get_attribute(".stage", "class") or ""
            kind = step
            if "is-ambush" in classes:
                kind = "ambush"
            elif "is-warmup" in classes:
                kind = "warmup"
            self.seen_types.add(kind)
            self.first(page, f"{label}-{kind}")
            if step in ("intro", "stage", "grammar", "speedIntro", "results"):
                page.click("[data-act=next]")
            elif step == "meet":
                meets += 1
                page.click("[data-act=known]" if meets == 2 else "[data-act=next]")
            elif step in ("listen", "spell", "reverse"):
                opts = page.locator(".opt")
                opts.nth(typed % opts.count()).click()
                typed += 1
                self.first(page, f"{label}-{kind}-answered")
                page.click("[data-act=next]")
            elif step == "type":
                if typed % 3 == 0:
                    page.fill(".type-input", "pho")
                    page.click(".vkey[data-key='ơ']")
                    page.click(".vkey[data-key='hoi']")
                    value = page.input_value(".type-input")
                    if value != "phở":
                        self.errors.append(f"tone keys produced {value!r} instead of 'phở'")
                    self.first(page, f"{label}-type-keys")
                else:
                    page.fill(".type-input", ["cha", "xyz", "nuwowcs"][typed % 3])
                typed += 1
                page.click("[data-act=check]")
                self.first(page, f"{label}-type-answered")
                page.click("[data-act=check]")
            elif step == "speed":
                opt = page.locator(".opt").first
                if opt.count():
                    try:
                        opt.click(timeout=500)
                    except Exception:
                        pass
                page.wait_for_timeout(120)
            elif step == "feedback":
                page.click("[data-name=difficulty] .seg-btn >> nth=1")
                page.click("[data-name=fun] .seg-btn >> nth=3")
                page.fill("#want-next", "numbers and prices at the market")
                page.fill("#note", "check run")
                self.first(page, f"{label}-feedback-filled")
                page.click("[data-act=save]")
                page.wait_for_selector(".done-page")
            else:
                self.errors.append(f"{label}: unknown step {step!r}")
                return False
        self.errors.append(f"{label}: did not finish within 600 actions")
        return False

    def run(self, p):
        browser = p.webkit.launch()
        ctx = browser.new_context(**p.devices[self.name], service_workers="block", color_scheme=self.scheme)
        ctx.route(f"{BASE}**", serve)
        ctx.route("https://api.github.com/**", self.github)
        page = ctx.new_page()
        page.on("pageerror", lambda e: self.errors.append(f"page error: {e}"))
        page.on("console", self.console)

        page.goto(f"{BASE}?test=1#/")
        page.wait_for_selector(".home")
        self.first(page, "home-new")

        page.evaluate("location.hash = '#/settings'")
        page.wait_for_selector(".settings")
        page.fill(".token-form input", "test-token")
        page.click(".token-form button[type=submit]")
        page.locator(".form-status", has_text="works").wait_for()
        self.first(page, "settings")

        page.evaluate("location.hash = '#/'")
        page.wait_for_selector(".home")
        page.evaluate(f"location.hash = '#/lesson/{self.lesson['id']}'")
        if self.play_session(page, "lesson"):
            page.wait_for_selector(".send-status:not([data-state=sending])")
            self.first(page, "lesson-done")
            state = page.get_attribute(".send-status", "data-state")
            if state != "sent":
                self.errors.append(f"results were not sent (state {state})")
        expect = ("warmup", "meet", "listen", "type", "speed", "results") if self.lesson.get("warmup") else ("meet", "listen", "type", "speed", "results")
        for kind in expect:
            if kind not in self.seen_types:
                self.errors.append(f"lesson never showed a {kind} step")

        data = page.evaluate("({h: JSON.parse(localStorage.getItem('vw-history') || '[]'), d: JSON.parse(localStorage.getItem('vw-deck') || '{}'), o: JSON.parse(localStorage.getItem('vw-outbox') || '[]')})")
        if len(data["h"]) != 1:
            self.errors.append(f"expected 1 saved result, found {len(data['h'])}")
        else:
            r = data["h"][0]
            verified = {w["vi"] for w in r["words"] if w.get("known") and (w.get("firstTry") or {}).get("type") in ("perfect", "tone", "marks", "sound")}
            expected = {w["vi"] for w in r["words"]} - verified
            expected |= {m["vi"] for m in r.get("warmup", []) if not m["ok"]}
            if set(data["d"]) != expected:
                self.errors.append(f"review deck has {sorted(data['d'])}, expected {sorted(expected)}")
            if "rank" not in (r.get("battle") or {}):
                self.errors.append("result has no battle summary")
        if data["o"]:
            self.errors.append(f"{len(data['o'])} results left unsent")
        if len(self.posts) != 1:
            self.errors.append(f"expected 1 issue posted, found {len(self.posts)}")
        else:
            body = self.posts[0]["body"]
            m = MARKER.search(body)
            if not m:
                self.errors.append("posted issue has no result block")
            else:
                r = json.loads(m.group(1))
                for key in ("resultId", "lessonId", "words", "events", "typed", "toneConfusions", "feedback", "summary", "battle", "warmup"):
                    if key not in r:
                        self.errors.append(f"posted result is missing {key}")
                if (r.get("feedback") or {}).get("wantNext") != "numbers and prices at the market":
                    self.errors.append("feedback was not included in the posted result")
                if len(body) > 60000:
                    self.errors.append(f"issue body is {len(body)} characters, close to GitHub's limit")

        page.evaluate("""() => {
            const d = JSON.parse(localStorage.getItem('vw-deck'));
            for (const k of Object.keys(d)) d[k].due = Date.now() - 1000;
            localStorage.setItem('vw-deck', JSON.stringify(d));
            location.hash = '#/x';
            location.hash = '#/';
        }""")
        page.wait_for_selector(".review-card.is-due")
        self.first(page, "home-due")
        page.click(".review-card .btn")
        if self.play_session(page, "review"):
            page.wait_for_selector(".send-status:not([data-state=sending])")
        if len(self.posts) != 2:
            self.errors.append(f"expected 2 issues after the review, found {len(self.posts)}")

        posted = [json.loads(m.group(1)) for m in (MARKER.search(x["body"]) for x in self.posts) if m]
        OUT.mkdir(exist_ok=True)
        (OUT / f"{self.slug}-posted.json").write_text(json.dumps(posted, ensure_ascii=False, indent=1), encoding="utf-8")

        page.click("[data-act=home]")
        page.wait_for_selector(".home")
        self.first(page, "home-after")
        page.evaluate("location.hash = '#/words'")
        page.wait_for_selector(".word-list")
        self.first(page, "words")
        browser.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-shots", action="store_true", help="skip screenshots")
    parser.add_argument("--lesson", help="lesson id to play (default: the newest)")
    parser.add_argument("--device", action="append", help="only these devices (repeatable)")
    args = parser.parse_args()
    index = json.loads((WEB / "lessons" / "index.json").read_text(encoding="utf-8"))["lessons"]
    entry = next((e for e in index if e["id"] == args.lesson), None) if args.lesson else index[-1]
    if not entry:
        print(f"no lesson {args.lesson!r}")
        return 1
    lesson = json.loads((WEB / "lessons" / entry["file"]).read_text(encoding="utf-8"))
    print(f"playing {lesson['id']}: {lesson['title']}")
    failed = False
    with sync_playwright() as p:
        for name, scheme, shots in DEVICES:
            if args.device and name not in args.device:
                continue
            run = Run(name, scheme, shots and not args.no_shots, lesson)
            run.run(p)
            status = "ok" if not run.errors else "FAILED"
            print(f"{name} ({scheme}): {status}, {len(run.posts)} issues posted")
            for e in run.errors:
                print(f"  {e}")
            failed = failed or bool(run.errors)
    if not args.no_shots:
        print(f"screenshots in {OUT}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

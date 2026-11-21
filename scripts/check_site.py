#!/usr/bin/env python3
"""Plays through the site in WebKit as an iPhone and an iPad and saves screenshots to .checks/.

Serves web/ through request routing (no server), fakes the GitHub API, completes a whole lesson,
checks what was saved and sent, then runs a review session. Fails on page errors, horizontal
overflow, or missing results. Needs the Framework Python with Playwright:
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
DEVICES = [("iPhone 15", "light"), ("iPad Pro 11", "dark")]
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

    def play_session(self, page, label):
        seen_meet = 0
        typed = 0
        for _ in range(400):
            if page.locator(".done-page").count():
                return True
            step = page.get_attribute(".stage", "data-step")
            if step and step not in self.shot_steps:
                self.shot_steps.add(step)
                self.overflow(page, f"{label} {step}")
                self.shot(page, f"{label}-{step}")
            if step in ("intro", "stage", "grammar", "speedIntro", "results"):
                page.click("[data-act=next]")
            elif step == "meet":
                seen_meet += 1
                page.click("[data-act=known]" if seen_meet == 2 else "[data-act=next]")
            elif step in ("listen", "spell", "reverse"):
                opts = page.locator(".opt")
                opts.nth(typed % opts.count()).click()
                typed += 1
                if step + "-answered" not in self.shot_steps:
                    self.shot_steps.add(step + "-answered")
                    self.shot(page, f"{label}-{step}-answered")
                page.click("[data-act=next]")
            elif step == "type":
                page.fill(".type-input", ["phowr", "pho", "xyz", "nuwowcs"][typed % 4])
                typed += 1
                page.click("[data-act=check]")
                if "type-answered" not in self.shot_steps:
                    self.shot_steps.add("type-answered")
                    self.shot(page, f"{label}-type-answered")
                page.click("[data-act=check]")
            elif step == "speed":
                opt = page.locator(".opt").first
                if opt.count():
                    try:
                        opt.click(timeout=500)
                    except Exception:
                        pass
                page.wait_for_timeout(150)
            elif step == "feedback":
                page.click("[data-name=difficulty] .seg-btn >> nth=1")
                page.click("[data-name=fun] .seg-btn >> nth=3")
                page.fill("#want-next", "numbers and prices at the market")
                page.fill("#note", "check run")
                self.shot(page, f"{label}-feedback-filled")
                page.click("[data-act=save]")
                page.wait_for_selector(".done-page")
            else:
                self.errors.append(f"{label}: unknown step {step!r}")
                return False
        self.errors.append(f"{label}: did not finish within 400 actions")
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
        self.overflow(page, "home")
        self.shot(page, "home-new")

        page.evaluate("location.hash = '#/settings'")
        page.wait_for_selector(".settings")
        page.fill(".token-form input", "test-token")
        page.click(".token-form button[type=submit]")
        page.locator(".form-status", has_text="works").wait_for()
        self.shot(page, "settings")

        page.evaluate("location.hash = '#/'")
        page.wait_for_selector(".home")
        page.click(f".lesson-card[href='#/lesson/{self.lesson['id']}']")
        if self.play_session(page, "lesson"):
            page.wait_for_selector(".send-status:not([data-state=sending])")
            self.shot(page, "lesson-done")
            state = page.get_attribute(".send-status", "data-state")
            if state != "sent":
                self.errors.append(f"results were not sent (state {state})")

        data = page.evaluate("({h: JSON.parse(localStorage.getItem('vw-history') || '[]'), d: JSON.parse(localStorage.getItem('vw-deck') || '{}'), o: JSON.parse(localStorage.getItem('vw-outbox') || '[]')})")
        if len(data["h"]) != 1:
            self.errors.append(f"expected 1 saved result, found {len(data['h'])}")
        expected = len(self.lesson["words"]) + len(self.lesson.get("review", []))
        if len(data["d"]) != expected:
            self.errors.append(f"expected {expected} words in the review deck, found {len(data['d'])}")
        if data["o"]:
            self.errors.append(f"{len(data['o'])} results left unsent")
        if len(self.posts) != 1:
            self.errors.append(f"expected 1 issue posted, found {len(self.posts)}")
        else:
            body = self.posts[0]["body"]
            m = re.search(r"<!-- vietwars-result -->\n```json\n(.*)\n```", body, re.S)
            if not m:
                self.errors.append("posted issue has no result block")
            else:
                r = json.loads(m.group(1))
                for key in ("resultId", "lessonId", "words", "events", "typed", "toneConfusions", "feedback", "summary"):
                    if key not in r:
                        self.errors.append(f"posted result is missing {key}")
                if r.get("feedback", {}).get("wantNext") != "numbers and prices at the market":
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
        self.shot(page, "home-due")
        page.click(".review-card .btn")
        self.shot_steps = set()
        if self.play_session(page, "review"):
            page.wait_for_selector(".send-status:not([data-state=sending])")
        if len(self.posts) != 2:
            self.errors.append(f"expected 2 issues after the review, found {len(self.posts)}")

        posted = []
        for item in self.posts:
            m = re.search(r"<!-- vietwars-result -->\n```json\n(.*)\n```", item["body"], re.S)
            if m:
                posted.append(json.loads(m.group(1)))
        OUT.mkdir(exist_ok=True)
        (OUT / f"{self.slug}-posted.json").write_text(json.dumps(posted, ensure_ascii=False, indent=1), encoding="utf-8")

        page.click("[data-act=home]")
        page.wait_for_selector(".home")
        self.shot(page, "home-after")
        page.evaluate("location.hash = '#/words'")
        page.wait_for_selector(".word-list")
        self.overflow(page, "words")
        self.shot(page, "words")
        browser.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-shots", action="store_true", help="skip screenshots")
    parser.add_argument("--lesson", help="lesson id to play (default: the newest)")
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
        for name, scheme in DEVICES:
            run = Run(name, scheme, not args.no_shots, lesson)
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

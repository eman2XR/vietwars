#!/usr/bin/env python3
"""Reports the state of the learning loop and what the agents should do next.

  python3 scripts/status.py            human-readable summary
  python3 scripts/status.py --json     the same as JSON
  python3 scripts/status.py --decide   prints one action: answer-questions, ingest, review-progress, adjust-lesson, next-lesson or wait

Rules: questions from the learner (Ask on the site) are answered first, then results waiting on GitHub are ingested. A new lesson is built only when the newest
lesson has been played (so one unplayed lesson is always ready, never a pile of them), and at most
two lessons are added per day. A progress review is due after five sessions or seven days since the last one.
If the learner has closed the newest lesson midway twice without finishing it, the lesson needs adjusting.
"""

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "eman2XR/vietwars"
MAX_LESSONS_PER_DAY = 2
REVIEW_EVERY_SESSIONS = 5
REVIEW_EVERY_DAYS = 7


def load(path, default):
    p = ROOT / path
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def open_issues():
    """Counts open result issues not saved yet, and open questions; None for both if GitHub cannot be reached."""
    try:
        out = subprocess.run(
            ["gh", "issue", "list", "-R", REPO, "--state", "open", "--limit", "200", "--json", "number,body"],
            check=True, capture_output=True, text=True, timeout=60,
        ).stdout
    except Exception as e:
        return None, None, str(e).splitlines()[0] if str(e) else "gh failed"
    issues = json.loads(out)
    saved = {json.loads(p.read_text(encoding="utf-8"))["resultId"] for p in (ROOT / "learner" / "results").glob("*.json")}
    waiting = 0
    for i in issues:
        if "<!-- vietwars-result -->" not in (i.get("body") or ""):
            continue
        m = re.search(r'"resultId":\s*"([^"]+)"', i["body"])
        if m and m.group(1) not in saved:
            waiting += 1
    questions = sum(1 for i in issues if "<!-- vietwars-question -->" in (i.get("body") or ""))
    return waiting, questions, None


def state():
    index = load("web/lessons/index.json", {"lessons": []})["lessons"]
    newest = index[-1] if index else None
    results = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((ROOT / "learner" / "results").glob("*.json"))]
    played = {r["lessonId"] for r in results if r["kind"] == "lesson" and not r.get("partial")}
    unfinished = sum(1 for r in results if r.get("partial") and newest and r["lessonId"] == newest["id"])
    today = dt.date.today().isoformat()
    added_today = sum(1 for l in index if l.get("added") == today)
    cur = load("learner/curriculum.json", {})
    reviewed = cur.get("reviewedAt")
    since = [r for r in results if not r.get("partial") and (not reviewed or r["finishedAt"][:10] > reviewed)]
    days = (dt.date.today() - dt.date.fromisoformat(reviewed)).days if reviewed else None
    nxt = next((u for u in cur.get("units", []) if u.get("status") == "planned"), None)
    waiting, questions, gh_error = open_issues()
    profile = load("learner/profile.json", {})
    return {
        "today": today,
        "lessons": len(index),
        "newestLesson": newest["id"] if newest else None,
        "newestPlayed": bool(newest and newest["id"] in played),
        "newestUnfinished": unfinished,
        "lessonsAddedToday": added_today,
        "results": len(results),
        "resultsWaitingOnGitHub": waiting,
        "questionsWaiting": questions,
        "githubError": gh_error,
        "sessionsSinceReview": len(since),
        "daysSinceReview": days,
        "nextUnit": nxt["id"] if nxt else None,
        "wordsMet": len(profile.get("words", {})),
        "knownWords": len(load("web/lessons/known.json", {"words": []})["words"]),
    }


def decide(s):
    if s["questionsWaiting"]:
        return "answer-questions"
    if s["resultsWaitingOnGitHub"]:
        return "ingest"
    if s["results"] and (s["sessionsSinceReview"] >= REVIEW_EVERY_SESSIONS or (s["daysSinceReview"] or 0) >= REVIEW_EVERY_DAYS):
        return "review-progress"
    if not s["newestPlayed"] and s["newestUnfinished"] >= 2:
        return "adjust-lesson"
    if s["newestPlayed"] and s["lessonsAddedToday"] < MAX_LESSONS_PER_DAY:
        return "next-lesson"
    return "wait"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--decide", action="store_true")
    args = parser.parse_args()
    s = state()
    s["decision"] = decide(s)
    if args.decide:
        print(s["decision"])
    elif args.json:
        print(json.dumps(s, indent=1))
    else:
        for k, v in s.items():
            print(f"{k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

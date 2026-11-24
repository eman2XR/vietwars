#!/usr/bin/env python3
"""Shows how the recent issues turned out, side by side, so the next one can be planned to improve on them.

  python3 scripts/outcomes.py           the last five finished issues
  python3 scripts/outcomes.py -n 8      the last eight

For each issue: first-try accuracy, the learner's ratings, minutes per phase, accuracy per exercise type, real life and
conversation, the misses, and what the learner wrote. Read it before planning (the next-lesson skill, step 2).
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPES = ("listen", "spell", "reverse", "type", "situation", "say", "dialogue", "speed")


def ok(e):
    return e.get("ok") is True or (e.get("t") == "type" and e.get("ok") is None and e.get("g") == "perfect")


def issue_rows(results):
    rows = []
    for r in results:
        if r.get("kind") != "lesson" or r.get("partial"):
            continue
        kinds = defaultdict(lambda: [0, 0])
        misses = []
        for e in r.get("events", []):
            t = e.get("t")
            if t not in TYPES or e.get("warmup") or e.get("retry"):
                continue
            kinds[t][1] += 1
            if ok(e):
                kinds[t][0] += 1
            elif t != "speed":
                misses.append(f"{t} {e.get('w')} -> {e.get('a')!r}")
        timing = r.get("timing") or {}
        active = sum(v for k, v in timing.items() if isinstance(v, (int, float)) and k not in ("pauses", "longestPauseSec"))
        fb = r.get("feedback") or {}
        rows.append({
            "lesson": r.get("lessonId"),
            "title": r.get("lessonTitle"),
            "when": (r.get("finishedAt") or "")[:16],
            "firstTry": (r.get("summary") or {}).get("firstTryAccuracy"),
            "difficulty": fb.get("difficulty"),
            "fun": fb.get("fun"),
            "article": fb.get("article"),
            "readSec": (r.get("article") or {}).get("readSec"),
            "activeMin": round(active / 60, 1),
            "phases": {k: round(v / 60, 1) for k, v in timing.items() if isinstance(v, (int, float)) and k not in ("pauses", "longestPauseSec")},
            "kinds": {k: f"{v[0]}/{v[1]}" for k, v in kinds.items()},
            "misses": misses,
            "hardest": fb.get("hardest") or [],
            "wantNext": fb.get("wantNext"),
            "note": fb.get("note"),
        })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=5)
    args = ap.parse_args()
    results = [json.loads(p.read_text(encoding="utf-8")) for p in (ROOT / "learner" / "results").glob("*.json")]
    results.sort(key=lambda r: r.get("finishedAt") or "")
    rows = issue_rows(results)[-args.n:]
    print("| Issue | First try | Difficulty | Fun | Story | Read (s) | Active min | " + " | ".join(TYPES) + " |")
    print("|---|---|---|---|---|---|---|" + "---|" * len(TYPES))
    for x in rows:
        ft = f"{round(100 * x['firstTry'])}%" if isinstance(x["firstTry"], (int, float)) else ""
        cells = [x["kinds"].get(t, "") for t in TYPES]
        print(f"| {x['lesson']} | {ft} | {x['difficulty'] or ''} | {x['fun'] or ''} | {x['article'] or ''} | {x['readSec'] or ''} | {x['activeMin']} | " + " | ".join(cells) + " |")
    for x in rows:
        print(f"\n{x['lesson']} ({x['title']}, {x['when']}): minutes {x['phases']}")
        if x["hardest"]:
            print(f"  hardest: {', '.join(x['hardest'])}")
        for m in x["misses"]:
            print(f"  missed: {m}")
        if x["wantNext"]:
            print(f"  wants next: {x['wantNext']}")
        if x["note"]:
            print(f"  note: {x['note']}")


if __name__ == "__main__":
    main()

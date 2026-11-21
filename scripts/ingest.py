#!/usr/bin/env python3
"""Collects lesson results and builds the learner profile that the lesson-planning agents read.

Results arrive as GitHub issues (posted by the site) or as a JSON file (the site's "Copy all my data").
Each result is saved once to learner/results/; learner/profile.json and learner/SUMMARY.md are then
rebuilt from every saved result.

  python3 scripts/ingest.py                 pull open result issues and rebuild the profile
  python3 scripts/ingest.py --file data.json   import results from a file instead
  python3 scripts/ingest.py --close         also close the open issues that are saved (after a lesson ships)
  python3 scripts/ingest.py --offline       only rebuild from saved results
"""

import argparse
import json
import re
import statistics
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEARNER = ROOT / "learner"
RESULTS = LEARNER / "results"
REPO = "eman2XR/vietwars"
MARKER = re.compile(r"<!-- vietwars-result -->\s*```json\s*(\{.*\})\s*```", re.S)
CREDIT = {"perfect": 1.0, "tone": 0.5, "marks": 0.5, "wrong": 0.0}


def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def saved_ids():
    ids = {}
    for path in RESULTS.glob("*.json"):
        r = json.loads(path.read_text(encoding="utf-8"))
        ids[r["resultId"]] = path
    return ids


def save(result, issue=None):
    RESULTS.mkdir(parents=True, exist_ok=True)
    if result["resultId"] in saved_ids():
        return False
    if issue is not None:
        result = {**result, "issue": issue}
    name = f"{result['finishedAt'][:19].replace(':', '')}-{result['kind']}-{result['lessonId']}-{result['resultId'][:8]}.json"
    (RESULTS / name).write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return True


def open_issues():
    out = gh("issue", "list", "-R", REPO, "--state", "open", "--limit", "200", "--json", "number,title,body")
    found = []
    for issue in json.loads(out):
        m = MARKER.search(issue["body"] or "")
        if m:
            try:
                found.append((issue["number"], json.loads(m.group(1))))
            except json.JSONDecodeError:
                print(f"issue #{issue['number']}: result block is not valid JSON, skipped")
    return found


def from_file(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(data, dict) and "history" in data:
        return data["history"]
    return data if isinstance(data, list) else [data]


def first_try_credit(event):
    if event["t"] == "type":
        return CREDIT.get(event.get("g"), 0.0)
    return 1.0 if event.get("ok") else 0.0


def build_profile(results):
    results = sorted(results, key=lambda r: r["finishedAt"])
    words = {}
    tone_conf = Counter()
    meaning_conf = Counter()
    typed_grades = Counter()
    lessons = defaultdict(lambda: {"attempts": 0, "accuracies": [], "last": None})
    sessions = []
    feedback = []
    for r in results:
        acc = r["summary"]["firstTryAccuracy"]
        sessions.append({
            "finishedAt": r["finishedAt"],
            "kind": r["kind"],
            "lesson": r["lessonId"],
            "accuracy": acc,
            "minutes": round(r["durationSec"] / 60, 1),
            "device": r.get("device"),
            "speed": f"{r['summary'].get('speedCorrect', 0)}/{r['summary'].get('speedAnswered', 0)}",
        })
        if r["kind"] == "lesson":
            l = lessons[r["lessonId"]]
            l["attempts"] += 1
            l["accuracies"].append(acc)
            l["last"] = r["finishedAt"]
        if r.get("feedback"):
            feedback.append({"finishedAt": r["finishedAt"], "lesson": r["lessonId"], "kind": r["kind"], **r["feedback"]})
        for c in r.get("toneConfusions", []):
            tone_conf[f"{c['target']} -> {c['chose']}"] += 1
        for c in r.get("meaningConfusions", []):
            meaning_conf[f"{c['target']} -> {c['chose']}"] += 1
        for t in r.get("typed", []):
            if not t.get("retry"):
                typed_grades[t["grade"]] += 1
        firsts = defaultdict(list)
        for e in r.get("events", []):
            if e["t"] in ("listen", "spell", "reverse", "type") and not e.get("retry"):
                firsts[e["w"]].append(e)
        for w in r.get("words", []):
            entry = words.setdefault(w["vi"], {
                "en": w["en"], "firstLesson": r["lessonId"], "sessions": 0, "shares": [],
                "byExercise": defaultdict(list), "typedErrors": Counter(), "known": False, "msMedian": None,
            })
            entry["sessions"] += 1
            entry["shares"].append(w["share"])
            entry["known"] = entry["known"] or bool(w.get("known"))
            entry["lastSeen"] = r["finishedAt"]
            if w.get("msMedian"):
                entry["msMedian"] = w["msMedian"]
            for e in firsts.get(w["vi"], []):
                entry["byExercise"][e["t"]].append(first_try_credit(e))
                if e["t"] == "type" and e.get("g") != "perfect":
                    entry["typedErrors"][e.get("g")] += 1

    word_out = {}
    for vi, e in words.items():
        recent = e["shares"][-3:]
        word_out[vi] = {
            "en": e["en"],
            "firstLesson": e["firstLesson"],
            "sessions": e["sessions"],
            "strength": round(statistics.mean(recent), 2),
            "history": e["shares"],
            "byExercise": {k: round(statistics.mean(v), 2) for k, v in e["byExercise"].items()},
            "typedErrors": dict(e["typedErrors"]),
            "knewIt": e["known"],
            "msMedian": e["msMedian"],
            "lastSeen": e["lastSeen"],
        }
    ranked = sorted(word_out.items(), key=lambda kv: (kv[1]["strength"], kv[0]))
    return {
        "sessions": sessions,
        "lessons": {
            k: {"attempts": v["attempts"], "best": max(v["accuracies"]), "latest": v["accuracies"][-1], "last": v["last"]}
            for k, v in lessons.items()
        },
        "words": word_out,
        "weakest": [vi for vi, w in ranked if w["strength"] < 0.7][:15],
        "strongest": [vi for vi, w in reversed(ranked) if w["strength"] >= 0.9][:15],
        "toneConfusions": dict(tone_conf.most_common()),
        "meaningConfusions": dict(meaning_conf.most_common(20)),
        "typing": dict(typed_grades),
        "feedback": feedback,
    }


def summary_md(p):
    lines = ["# Learner summary", "", "Built by `scripts/ingest.py` from `learner/results/`. Do not edit by hand.", ""]
    s = p["sessions"]
    if not s:
        return "\n".join(lines + ["No results yet."]) + "\n"
    lines.append(f"- Sessions: {len(s)} ({sum(1 for x in s if x['kind'] == 'lesson')} lessons, {sum(1 for x in s if x['kind'] == 'review')} reviews), last {s[-1]['finishedAt'][:16]} on {s[-1]['device']}")
    lines.append(f"- Words met: {len(p['words'])}; strong (0.9 or more): {len(p['strongest'])}; weak (under 0.7): {len(p['weakest'])}")
    t = p["typing"]
    total = sum(t.values())
    if total:
        lines.append(f"- Typing, first tries: {t.get('perfect', 0)} perfect, {t.get('tone', 0)} wrong or missing tone, {t.get('marks', 0)} missing vowel marks, {t.get('wrong', 0)} wrong (of {total})")
    lines += ["", "## Sessions", "", "| When (UTC) | Kind | Lesson | First try | Minutes | Speed |", "|---|---|---|---|---|---|"]
    for x in s[-12:]:
        lines.append(f"| {x['finishedAt'][:16]} | {x['kind']} | {x['lesson']} | {round(x['accuracy'] * 100)}% | {x['minutes']} | {x['speed']} |")
    lines += ["", "## Words, weakest first", "", "| Word | Meaning | Strength | Listen | Spell | Reverse | Type | Typing errors | Knew it |", "|---|---|---|---|---|---|---|---|---|"]
    for vi, w in sorted(p["words"].items(), key=lambda kv: kv[1]["strength"]):
        b = w["byExercise"]
        cell = lambda k: f"{b[k]:.2f}" if k in b else ""
        errs = ", ".join(f"{k} {v}" for k, v in w["typedErrors"].items())
        lines.append(f"| {vi} | {w['en']} | {w['strength']:.2f} | {cell('listen')} | {cell('spell')} | {cell('reverse')} | {cell('type')} | {errs} | {'yes' if w['knewIt'] else ''} |")
    if p["toneConfusions"]:
        lines += ["", "## Tone and spelling confusions (heard -> picked)", ""]
        lines += [f"- {k}: {v}" for k, v in p["toneConfusions"].items()]
    if p["meaningConfusions"]:
        lines += ["", "## Meaning confusions (heard -> picked)", ""]
        lines += [f"- {k}: {v}" for k, v in p["meaningConfusions"].items()]
    if p["feedback"]:
        lines += ["", "## Feedback, newest first", ""]
        for f in reversed(p["feedback"][-10:]):
            parts = [f"{f['finishedAt'][:10]} {f['kind']} {f['lesson']}: difficulty {f.get('difficulty') or 'n/a'}, fun {f.get('fun') or 'n/a'}"]
            if f.get("hardest"):
                parts.append(f"hardest {', '.join(f['hardest'])}")
            if f.get("wantNext"):
                parts.append(f"wants next \"{f['wantNext']}\"")
            if f.get("note"):
                parts.append(f"note \"{f['note']}\"")
            lines.append("- " + "; ".join(parts))
    return "\n".join(lines) + "\n"


def rebuild():
    results = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(RESULTS.glob("*.json"))]
    profile = build_profile(results)
    LEARNER.mkdir(exist_ok=True)
    (LEARNER / "profile.json").write_text(json.dumps(profile, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (LEARNER / "SUMMARY.md").write_text(summary_md(profile), encoding="utf-8")
    return len(results)


def close_saved():
    ids = saved_ids()
    closed = 0
    for number, result in open_issues():
        if result["resultId"] in ids:
            path = ids[result["resultId"]].relative_to(ROOT)
            gh("issue", "close", str(number), "-R", REPO, "--comment", f"Saved to `{path}` and used for the next lesson.")
            closed += 1
    return closed


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", help="import results from a JSON file")
    parser.add_argument("--close", action="store_true", help="close open result issues that are already saved")
    parser.add_argument("--offline", action="store_true", help="do not contact GitHub")
    args = parser.parse_args()

    new = 0
    if args.file:
        for r in from_file(args.file):
            new += save(r)
    elif not args.offline:
        for number, r in open_issues():
            new += save(r, issue=number)
    total = rebuild()
    print(f"{new} new result{'s' if new != 1 else ''}, {total} in total; wrote learner/profile.json and learner/SUMMARY.md")
    if args.close and not args.offline:
        print(f"closed {close_saved()} issue(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

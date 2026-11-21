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


def known_words():
    path = ROOT / "web" / "lessons" / "known.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("words", [])


def avg(xs):
    return round(statistics.mean(xs), 2) if xs else None


def build_profile(results):
    results = sorted(results, key=lambda r: r["finishedAt"])
    known = set(known_words())
    words = {}
    tone_conf = Counter()
    meaning_conf = Counter()
    typed_grades = Counter()
    keys_used = [0, 0]
    warmup_missed = Counter()
    lessons = defaultdict(lambda: {"attempts": 0, "accuracies": [], "last": None, "won": False, "ranks": []})
    sessions = []
    feedback = []
    for r in results:
        acc = r["summary"]["firstTryAccuracy"]
        b = r.get("battle") or {}
        missed = [m["vi"] for m in r.get("warmup", []) if not m.get("ok")]
        warmup_missed.update(set(missed))
        sessions.append({
            "finishedAt": r["finishedAt"],
            "kind": r["kind"],
            "lesson": r["lessonId"],
            "accuracy": acc,
            "minutes": round(r["durationSec"] / 60, 1),
            "device": r.get("device"),
            "style": r.get("style"),
            "speed": f"{r['summary'].get('speedCorrect', 0)}/{r['summary'].get('speedAnswered', 0)}",
            "battle": {k: b.get(k) for k in ("won", "rank", "foeHpLeft", "heartsLost", "knockouts", "crits", "ambushWon", "ambushLost")} if b else None,
            "warmupMissed": missed,
        })
        if r["kind"] == "lesson":
            l = lessons[r["lessonId"]]
            l["attempts"] += 1
            l["accuracies"].append(acc)
            l["last"] = r["finishedAt"]
            l["won"] = l["won"] or bool(b.get("won"))
            if b.get("rank"):
                l["ranks"].append(b["rank"])
        if r.get("feedback"):
            feedback.append({"finishedAt": r["finishedAt"], "lesson": r["lessonId"], "kind": r["kind"], **r["feedback"]})
        for c in r.get("toneConfusions", []):
            tone_conf[f"{c['target']} -> {c['chose']}"] += 1
        for c in r.get("meaningConfusions", []):
            meaning_conf[f"{c['target']} -> {c['chose']}"] += 1
        for t in r.get("typed", []):
            if not t.get("retry"):
                typed_grades[t["grade"]] += 1
                if "keys" in t:
                    keys_used[1] += 1
                    keys_used[0] += 1 if t.get("keys") else 0
        firsts = defaultdict(list)
        for e in r.get("events", []):
            if e["t"] in ("listen", "spell", "reverse", "type") and not (e.get("retry") or e.get("warmup") or e.get("ambush")):
                firsts[e["w"]].append(e)
        for w in r.get("words", []):
            entry = words.setdefault(w["vi"], {
                "en": w["en"], "firstLesson": r["lessonId"], "sessions": 0, "shares": [],
                "byExercise": defaultdict(list), "meaning": [], "form": [], "typedErrors": Counter(), "known": False, "msMedian": None,
            })
            entry["sessions"] += 1
            entry["shares"].append(w["share"])
            entry["known"] = entry["known"] or bool(w.get("known"))
            entry["lastSeen"] = r["finishedAt"]
            if w.get("msMedian"):
                entry["msMedian"] = w["msMedian"]
            for e in firsts.get(w["vi"], []):
                c = first_try_credit(e)
                kind = "dictation" if e["t"] == "type" and e.get("dictation") else e["t"]
                entry["byExercise"][kind].append(c)
                (entry["meaning"] if e["t"] in ("listen", "reverse") else entry["form"]).append(c)
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
            "meaning": avg(e["meaning"][-6:]),
            "form": avg(e["form"][-6:]),
            "history": e["shares"],
            "byExercise": {k: round(statistics.mean(v), 2) for k, v in e["byExercise"].items()},
            "typedErrors": dict(e["typedErrors"]),
            "tappedKnowIt": e["known"],
            "knownList": vi in known,
            "msMedian": e["msMedian"],
            "lastSeen": e["lastSeen"],
        }
    live = {vi: w for vi, w in word_out.items() if not w["knownList"]}
    by_meaning = sorted(live.items(), key=lambda kv: (kv[1]["meaning"] if kv[1]["meaning"] is not None else 1, kv[0]))
    by_form = sorted(live.items(), key=lambda kv: (kv[1]["form"] if kv[1]["form"] is not None else 1, kv[0]))
    return {
        "sessions": sessions,
        "lessons": {
            k: {"attempts": v["attempts"], "best": max(v["accuracies"]), "latest": v["accuracies"][-1], "last": v["last"], "won": v["won"], "ranks": v["ranks"]}
            for k, v in lessons.items()
        },
        "words": word_out,
        "known": sorted(known),
        "weakMeaning": [vi for vi, w in by_meaning if w["meaning"] is not None and w["meaning"] < 0.7][:15],
        "weakSpelling": [vi for vi, w in by_form if w["form"] is not None and w["form"] < 0.6][:15],
        "strongest": [vi for vi, w in sorted(live.items(), key=lambda kv: -kv[1]["strength"]) if w["strength"] >= 0.9][:15],
        "warmupMissed": dict(warmup_missed.most_common()),
        "toneConfusions": dict(tone_conf.most_common()),
        "meaningConfusions": dict(meaning_conf.most_common(20)),
        "typing": dict(typed_grades),
        "toneKeysUsed": f"{keys_used[0]}/{keys_used[1]}" if keys_used[1] else None,
        "feedback": feedback,
    }


def summary_md(p):
    lines = ["# Learner summary", "", "Built by `scripts/ingest.py` from `learner/results/`. Do not edit by hand.", ""]
    s = p["sessions"]
    if not s:
        return "\n".join(lines + ["No results yet."]) + "\n"
    lines.append(f"- Sessions: {len(s)} ({sum(1 for x in s if x['kind'] == 'lesson')} lessons, {sum(1 for x in s if x['kind'] == 'review')} reviews), last {s[-1]['finishedAt'][:16]} UTC on {s[-1]['device']}")
    lines.append(f"- Words met: {len(p['words'])}; on the known list (never taught or reviewed again): {len(p['known'])}")
    lines.append(f"- Weak in meaning (under 0.7): {', '.join(p['weakMeaning']) or 'none'}")
    lines.append(f"- Weak in spelling or tone (under 0.6): {', '.join(p['weakSpelling']) or 'none'}")
    t = p["typing"]
    total = sum(t.values())
    if total:
        lines.append(f"- Typing, first tries: {t.get('perfect', 0)} perfect, {t.get('tone', 0)} wrong or missing tone, {t.get('marks', 0)} missing vowel marks, {t.get('sound', 0)} spelled as it sounds in Hà Nội, {t.get('wrong', 0)} wrong (of {total})")
    if p.get("toneKeysUsed"):
        lines.append(f"- Answers typed with the on-screen tone keys: {p['toneKeysUsed']}")
    if p["warmupMissed"]:
        lines.append(f"- Warm-up words missed: {', '.join(f'{k} ({v})' for k, v in p['warmupMissed'].items())}")
    lines += ["", "## Sessions", "", "| When (UTC) | Kind | Lesson | First try | Minutes | Speed | Battle |", "|---|---|---|---|---|---|---|"]
    for x in s[-12:]:
        b = x.get("battle")
        bt = f"{'won' if b.get('won') else 'lost'}, rank {b.get('rank')}, {b.get('heartsLost')} hearts lost, {b.get('crits')} crits" if b else ""
        lines.append(f"| {x['finishedAt'][:16]} | {x['kind']} | {x['lesson']} | {round(x['accuracy'] * 100)}% | {x['minutes']} | {x['speed']} | {bt} |")
    lines += ["", "## Words, weakest meaning first (known-list words last)", "", "| Word | Gloss | Meaning | Spelling | Listen | Spell | Reverse | Type | Hear+type | Typing errors | Notes |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    order = sorted(p["words"].items(), key=lambda kv: (kv[1]["knownList"], kv[1]["meaning"] if kv[1]["meaning"] is not None else 1))
    for vi, w in order:
        b = w["byExercise"]
        cell = lambda k: f"{b[k]:.2f}" if k in b else ""
        num = lambda v: f"{v:.2f}" if v is not None else ""
        errs = ", ".join(f"{k} {v}" for k, v in w["typedErrors"].items())
        notes = ", ".join(x for x in ("known list" if w["knownList"] else "", "tapped I know it" if w["tappedKnowIt"] else "") if x)
        lines.append(f"| {vi} | {w['en']} | {num(w['meaning'])} | {num(w['form'])} | {cell('listen')} | {cell('spell')} | {cell('reverse')} | {cell('type')} | {cell('dictation')} | {errs} | {notes} |")
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
    notes = ROOT / "learner" / "NOTES.md"
    if notes.exists():
        lines += ["", "## Notes from the learner outside the app", "", notes.read_text(encoding="utf-8").strip()]
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

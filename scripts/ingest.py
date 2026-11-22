#!/usr/bin/env python3
"""Collects lesson results and builds the learner profile that the lesson-planning agents read.

Results arrive as GitHub issues (posted by the site) or as a JSON file (the site's "Copy all my data").
Each result is saved once to learner/results/; learner/profile.json and learner/SUMMARY.md are then
rebuilt from every saved result. The learner's questions and their answers (scripts/questions.py) are
saved to learner/questions.json and listed in the summary. Devices asking for notifications are saved
by scripts/push.mjs inbox (on this Mac only, in .push/).

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
    unfinished = Counter()
    for r in results:
        if r.get("partial"):
            unfinished[r["lessonId"]] += 1
            prog = r.get("progress") or {}
            sessions.append({
                "finishedAt": r["finishedAt"], "kind": "unfinished", "lesson": r["lessonId"],
                "accuracy": r["summary"]["firstTryAccuracy"], "minutes": round(r["durationSec"] / 60, 1),
                "device": r.get("device"), "style": r.get("style"), "speed": f"stopped at step {prog.get('step', 0) + 1} of {prog.get('steps', '?')}",
                "battle": None, "grade": None, "bestStreak": None, "quiz": None, "articleSec": None, "articleRating": None, "warmupMissed": [],
            })
            continue
        acc = r["summary"]["firstTryAccuracy"]
        b = r.get("battle") or {}
        q = r.get("quiz") or {}
        art = r.get("article") or {}
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
            "battle": {k: b.get(k) for k in ("won", "rank", "heartsLost", "crits")} if b else None,
            "grade": (r.get("summary") or {}).get("grade"),
            "bestStreak": (r.get("summary") or {}).get("bestStreak"),
            "quiz": f"{q.get('correct', 0)}/{q.get('total', 0)}" if q else None,
            "articleSec": art.get("readSec"),
            "articleRating": (r.get("feedback") or {}).get("article"),
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
        "warmupMissed": dict(sorted(warmup_missed.items(), key=lambda kv: (-kv[1], kv[0]))),
        "toneConfusions": dict(tone_conf.most_common()),
        "meaningConfusions": dict(meaning_conf.most_common(20)),
        "typing": dict(typed_grades),
        "unfinished": dict(unfinished),
        "toneKeysUsed": f"{keys_used[0]}/{keys_used[1]}" if keys_used[1] else None,
        "feedback": feedback,
    }


SCORED_TYPES = ("listen", "spell", "reverse", "type", "situation", "dialogue", "speed")


def struggle(results):
    """Per-word and per-exercise difficulty from every answer in finished sessions."""
    words = defaultdict(lambda: {"attempts": 0, "fails": 0, "ms": [], "plays": 0, "hints": 0, "revealed": 0, "studyMs": 0, "deletes": 0})
    kinds = defaultdict(lambda: {"n": 0, "ok": 0, "ms": []})
    phases = defaultdict(int)
    for r in results:
        if r.get("partial"):
            continue
        for k, v in (r.get("timing") or {}).items():
            if isinstance(v, (int, float)):
                phases[k] += v
        for e in r.get("events", []):
            t = e.get("t")
            if t == "meet":
                words[e["w"]]["studyMs"] += e.get("ms") or 0
                continue
            if t not in SCORED_TYPES or e.get("warmup"):
                continue
            ok = e.get("ok") is True or (t == "type" and e.get("ok") is None and e.get("g") == "perfect")
            k = kinds["type (tiles)" if e.get("tiles") else ("type (from hearing)" if e.get("dictation") else t)]
            k["n"] += 1
            k["ok"] += 1 if ok else 0
            if e.get("ms"):
                k["ms"].append(e["ms"])
            if t in ("speed", "situation", "dialogue"):
                continue
            w = words[e["w"]]
            w["attempts"] += 1
            w["fails"] += 0 if ok else 1
            if e.get("ms"):
                w["ms"].append(e["ms"])
            w["plays"] += e.get("plays") or 0
            w["hints"] += e.get("hints") or 0
            w["revealed"] += 1 if e.get("revealed") else 0
            w["deletes"] += e.get("deletes") or 0
    out = {}
    for vi, w in words.items():
        n = max(1, w["attempts"])
        med = statistics.median(w["ms"]) / 1000 if w["ms"] else 0
        score = round(60 * w["fails"] / n + 1.5 * min(med, 20) + 15 * w["hints"] / n + 4 * w["plays"] / n + 20 * w["revealed"] / n)
        out[vi] = {"attempts": w["attempts"], "fails": w["fails"], "medianSec": round(med, 1), "replays": w["plays"], "hints": w["hints"], "revealed": w["revealed"], "deletes": w["deletes"], "studySec": round(w["studyMs"] / 1000), "struggle": score}
    kind_out = {k: {"answers": v["n"], "accuracy": round(v["ok"] / v["n"], 2) if v["n"] else None, "medianSec": round(statistics.median(v["ms"]) / 1000, 1) if v["ms"] else None} for k, v in kinds.items()}
    return {"words": dict(sorted(out.items(), key=lambda kv: -kv[1]["struggle"])), "exercises": kind_out, "phaseSeconds": dict(phases)}


def summary_md(p):
    lines = ["# Learner summary", "", "Built by `scripts/ingest.py` from `learner/results/`. Do not edit by hand.", ""]
    s = p["sessions"]
    if not s:
        return "\n".join(lines + ["No results yet."]) + "\n"
    lines.append(f"- Sessions: {len(s)} ({sum(1 for x in s if x['kind'] == 'lesson')} lessons, {sum(1 for x in s if x['kind'] == 'review')} reviews, {sum(1 for x in s if x['kind'] == 'unfinished')} unfinished), last {s[-1]['finishedAt'][:16]} UTC on {s[-1]['device']}")
    lines.append(f"- Words met: {len(p['words'])}; on the known list (never taught or reviewed again): {len(p['known'])}")
    lines.append(f"- Weak in meaning (under 0.7): {', '.join(p['weakMeaning']) or 'none'}")
    lines.append(f"- Weak in spelling or tone (under 0.6): {', '.join(p['weakSpelling']) or 'none'}")
    t = p["typing"]
    total = sum(t.values())
    if total:
        lines.append(f"- Typing, first tries: {t.get('perfect', 0)} perfect, {t.get('tone', 0)} wrong or missing tone, {t.get('marks', 0)} missing vowel marks, {t.get('sound', 0)} spelled as it sounds in Hà Nội, {t.get('wrong', 0)} wrong (of {total})")
    if p.get("unfinished"):
        lines.append(f"- Unfinished attempts (closed midway): {', '.join(f'{k} ({v})' for k, v in p['unfinished'].items())}. Repeated unfinished attempts mean the issue is too long or too hard.")
    if p.get("toneKeysUsed"):
        lines.append(f"- Answers typed with the on-screen tone keys: {p['toneKeysUsed']}")
    if p["warmupMissed"]:
        lines.append(f"- Warm-up words missed: {', '.join(f'{k} ({v})' for k, v in p['warmupMissed'].items())}")
    lines += ["", "## Sessions", "", "| When (UTC) | Kind | Lesson | First try | Grade | Minutes | Rush hour | Quiz | Article read (s) | Article rating |", "|---|---|---|---|---|---|---|---|---|---|"]
    for x in s[-12:]:
        lines.append(f"| {x['finishedAt'][:16]} | {x['kind']} | {x['lesson']} | {round(x['accuracy'] * 100)}% | {x.get('grade') or ''} | {x['minutes']} | {x['speed']} | {x.get('quiz') or ''} | {x.get('articleSec') if x.get('articleSec') is not None else ''} | {x.get('articleRating') or ''} |")
    lines += ["", "## Words, weakest meaning first (known-list words last)", "", "| Word | Gloss | Meaning | Spelling | Listen | Spell | Reverse | Type | Hear+type | Typing errors | Notes |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    order = sorted(p["words"].items(), key=lambda kv: (kv[1]["knownList"], kv[1]["meaning"] if kv[1]["meaning"] is not None else 1))
    for vi, w in order:
        b = w["byExercise"]
        cell = lambda k: f"{b[k]:.2f}" if k in b else ""
        num = lambda v: f"{v:.2f}" if v is not None else ""
        errs = ", ".join(f"{k} {v}" for k, v in w["typedErrors"].items())
        notes = ", ".join(x for x in ("known list" if w["knownList"] else "", "tapped I know it" if w["tappedKnowIt"] else "") if x)
        lines.append(f"| {vi} | {w['en']} | {num(w['meaning'])} | {num(w['form'])} | {cell('listen')} | {cell('spell')} | {cell('reverse')} | {cell('type')} | {cell('dictation')} | {errs} | {notes} |")
    st = p.get("struggle") or {}
    if st.get("words"):
        lines += ["", "## Where the learner struggles", "", "Struggle score combines failed first tries, slow answers, hints, replays and revealed answers (higher is harder). From finished sessions only.", "", "| Word | Struggle | Attempts | Failed | Median answer (s) | Replays | Hints | Revealed | Studied card (s) |", "|---|---|---|---|---|---|---|---|---|"]
        for vi, w in list(st["words"].items())[:15]:
            lines.append(f"| {vi} | {w['struggle']} | {w['attempts']} | {w['fails']} | {w['medianSec']} | {w['replays']} | {w['hints']} | {w['revealed']} | {w['studySec']} |")
    if st.get("exercises"):
        lines += ["", "## Exercise types", "", "| Exercise | Answers | Accuracy | Median answer (s) |", "|---|---|---|---|"]
        for k, v in sorted(st["exercises"].items(), key=lambda kv: (kv[1]["accuracy"] if kv[1]["accuracy"] is not None else 1)):
            lines.append(f"| {k} | {v['answers']} | {'' if v['accuracy'] is None else f'{round(v[chr(97)+chr(99)+chr(99)+chr(117)+chr(114)+chr(97)+chr(99)+chr(121)] * 100)}%'} | {v['medianSec'] if v['medianSec'] is not None else ''} |")
    if st.get("phaseSeconds"):
        ph = st["phaseSeconds"]
        lines += ["", "Time spent (all finished sessions): " + ", ".join(f"{k} {round(v / 60, 1)} min" for k, v in ph.items() if k not in ("pauses", "longestPauseSec")) + (f"; long pauses (over a minute): {ph.get('pauses', 0)}" if 'pauses' in ph else "")]
    if p["toneConfusions"]:
        lines += ["", "## Tone and spelling confusions (heard -> picked)", ""]
        lines += [f"- {k}: {v}" for k, v in p["toneConfusions"].items()]
    if p["meaningConfusions"]:
        lines += ["", "## Meaning confusions (heard -> picked)", ""]
        lines += [f"- {k}: {v}" for k, v in p["meaningConfusions"].items()]
    if p["feedback"]:
        lines += ["", "## Feedback, newest first", ""]
        for f in reversed(p["feedback"][-10:]):
            parts = [f"{f['finishedAt'][:10]} {f['kind']} {f['lesson']}: difficulty {f.get('difficulty') or 'n/a'}, fun {f.get('fun') or 'n/a'}" + (f", article {f['article']}" if f.get('article') else "")]
            if f.get("hardest"):
                parts.append(f"hardest {', '.join(f['hardest'])}")
            if f.get("wantNext"):
                parts.append(f"wants next \"{f['wantNext']}\"")
            if f.get("note"):
                parts.append(f"note \"{f['note']}\"")
            lines.append("- " + "; ".join(parts))
    qpath = LEARNER / "questions.json"
    qs = json.loads(qpath.read_text(encoding="utf-8")) if qpath.exists() else []
    if qs:
        lines += ["", "## Questions the learner asked, newest first", "",
                  "What they wanted to know or say. Teach these in coming issues where they fit.", ""]
        for q in reversed(qs[-12:]):
            a = q.get("answer") or {}
            first = " ".join((a.get("text") or "").split())[:160]
            said = ", ".join(f"{x['vi']} ({x['en']})" for x in a.get("phrases", []))
            line = f"- {str(q.get('askedAt', ''))[:10]}" + (f" ({q['context']})" if q.get("context") else "") + f": \"{q.get('text', '')}\""
            line += f" Answered: {first}" + (f" Phrases: {said}." if said else "") if a else " Not answered yet."
            lines.append(line)
    notes = ROOT / "learner" / "NOTES.md"
    if notes.exists():
        lines += ["", "## Notes from the learner outside the app", "", notes.read_text(encoding="utf-8").strip()]
    return "\n".join(lines) + "\n"


def rebuild():
    results = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(RESULTS.glob("*.json"))]
    profile = build_profile(results)
    profile["struggle"] = struggle(results)
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
        try:
            from questions import sync as sync_questions
            sync_questions()
        except Exception as e:
            print(f"questions not updated: {str(e).splitlines()[0] if str(e) else e}")
        if (ROOT / ".push" / "keys.json").exists():
            try:
                out = subprocess.run(["node", str(ROOT / "scripts" / "push.mjs"), "inbox"], check=True, capture_output=True, text=True, timeout=120).stdout
                print(out.strip().splitlines()[-1] if out.strip() else "no notification requests")
            except Exception as e:
                print(f"notification requests not read: {str(e).splitlines()[0] if str(e) else e}")
    total = rebuild()
    print(f"{new} new result{'s' if new != 1 else ''}, {total} in total; wrote learner/profile.json and learner/SUMMARY.md")
    if args.close and not args.offline:
        print(f"closed {close_saved()} issue(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

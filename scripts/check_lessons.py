#!/usr/bin/env python3
"""Checks every lesson listed in web/lessons/index.json against the lesson format (docs/LESSON_FORMAT.md).

Errors fail the check; warnings are printed for a human or reviewer to judge.
Use --no-audio to skip the audio checks (for example in CI before clips exist).
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
TONE_MARKS = {"\u0300", "\u0301", "\u0309", "\u0303", "\u0323"}

# Words more typical of the South, with the usual Hà Nội word. Several also have other meanings, so these are warnings only.
SOUTHERN = {
    "heo": "lợn (pig)",
    "trái": "quả (fruit; trái also means left)",
    "bông": "hoa (flower)",
    "ly": "cốc (glass)",
    "muỗng": "thìa (spoon)",
    "chén": "bát (bowl)",
    "tô": "bát (big bowl)",
    "má": "mẹ (mother; má also means cheek)",
    "vô": "vào (to enter)",
    "dạ": "vâng (polite yes; dạ is also used in the North)",
    "cám ơn": "cảm ơn (thank you)",
    "kêu": "gọi (to call)",
    "nón": "mũ (hat)",
    "thơm": "dứa (pineapple; thơm also means fragrant)",
    "bắp": "ngô (corn)",
    "đậu phộng": "lạc (peanut)",
    "mắc": "đắt (expensive)",
}

LIMITS = {"en": 80, "hook": 260, "tip": 260, "note": 200, "intro": 300, "title": 60}
def picture_names():
    """Kinds, icon names and scene names from web/js/pictures.js: asked of node when it is installed, else read from the source."""
    node = shutil.which("node")
    if node:
        try:
            out = subprocess.run([node, "--input-type=module", "-e", "const m = await import(process.argv[1]); console.log(JSON.stringify([m.PICTURE_KINDS, m.ICON_NAMES, m.SCENE_NAMES]))", (WEB / "js" / "pictures.js").as_uri()],
                                 check=True, capture_output=True, text=True, timeout=30).stdout
            kinds, icons, scenes = json.loads(out)
            return set(kinds), set(icons), set(scenes)
        except Exception:
            pass
    src = (WEB / "js" / "pictures.js").read_text(encoding="utf-8")
    block = lambda name: src.split(f"const {name} = {{")[1].split("\n};")[0]
    keys = lambda text: set(re.findall(r"^  ([a-zA-Z]+): [`{]", text, re.M))
    scenes = re.search(r"const SCENES = \{([^}]*)\}", src)
    scene_keys = set(re.findall(r"(\w+)\s*:", scenes.group(1))) if scenes else set()
    return set(re.findall(r"case '([a-z]+)':", src)), keys(block("ICONS")), scene_keys


PICTURE_KINDS, ICON_NAMES, SCENE_NAMES = picture_names()


def nfc(s):
    return unicodedata.normalize("NFC", s)


def strip_all(s):
    d = unicodedata.normalize("NFD", s)
    return "".join(c for c in d if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D")


def syllables(s):
    return [t for t in re.split(r"[\s.,!?;:\"“”'’()…\-]+", s.lower()) if t]


class Report:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, where, msg):
        self.errors.append(f"{where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"{where}: {msg}")


def check_text(r, where, s, field="vi"):
    if not isinstance(s, str) or not s.strip():
        r.error(where, f"{field} is missing or empty")
        return
    if nfc(s) != s:
        r.error(where, f"{field} {s!r} is not NFC-normalised")
    if s != s.strip():
        r.error(where, f"{field} {s!r} has leading or trailing spaces")
    if field == "vi":
        for syl in syllables(s):
            marks = [c for c in unicodedata.normalize("NFD", syl) if c in TONE_MARKS]
            if len(marks) > 1:
                r.error(where, f"syllable {syl!r} has more than one tone mark")


def check_limit(r, where, obj, field):
    v = obj.get(field)
    if v is not None and len(v) > LIMITS[field]:
        r.error(where, f"{field} is {len(v)} characters (limit {LIMITS[field]})")


def check_picture(r, where, spec):
    if spec is None:
        return
    if not isinstance(spec, dict) or spec.get("kind") not in PICTURE_KINDS:
        r.error(where, f"picture kind must be one of {sorted(PICTURE_KINDS)}")
    elif spec["kind"] == "icon" and spec.get("name") not in ICON_NAMES:
        r.error(where, f"icon name must be one of {sorted(ICON_NAMES)} (or add a drawing to web/js/pictures.js)")
    elif spec["kind"] == "scene" and spec.get("name") not in SCENE_NAMES:
        r.error(where, f"scene name must be one of {sorted(SCENE_NAMES)} (or add a scene to web/js/pictures.js)")


def check_line(r, where, line):
    if not isinstance(line, dict) or not line.get("vi") or not line.get("en"):
        r.error(where, "needs vi and en")
        return
    check_text(r, where, line["vi"])


def check_feature(r, lid, lesson, newest=False):
    f = lesson.get("feature")
    if not f:
        r.error(lid, "missing feature (the issue's article)")
        return
    for field in ("kicker", "title", "dek", "intro", "beats", "sources"):
        if not f.get(field):
            r.error(f"{lid}.feature", f"missing {field}")
    check_text(r, f"{lid}.feature.intro", f.get("intro", "x"), "text")
    if len(f.get("intro", "")) > 420:
        r.error(f"{lid}.feature.intro", f"is {len(f['intro'])} characters; keep the intro under 420")
    taught = {nfc(w.get("vi", "")).lower() for w in lesson.get("words", [])}
    beats = f.get("beats", [])
    if not 2 <= len(beats) <= 7:
        r.error(f"{lid}.feature", f"has {len(beats)} story beats; use 2 to 7")
    for i, b in enumerate(beats):
        where = f"{lid}.feature.beats[{i}]"
        check_text(r, where, b.get("text", ""), "text")
        if len(b.get("text", "")) > 600:
            r.error(where, f"is {len(b['text'])} characters (limit 600)")
        if b.get("word") and nfc(b["word"]).lower() not in taught:
            r.error(where, f"word {b['word']!r} is not one of this issue's new words")
    need = 2 if len(lesson.get("words", [])) > 8 else 1
    if sum(1 for b in beats if b.get("word")) < need:
        r.warn(f"{lid}.feature", f"tie at least {need} beat{'s' if need > 1 else ''} to words, so the story appears right after them (one part has room for one)")
    words = len(f.get("intro", "").split()) + sum(len(b.get("text", "").split()) for b in beats)
    if not 120 <= words <= 450:
        r.warn(f"{lid}.feature", f"story is {words} words; aim for 150 to 350")
    for i, src in enumerate(f.get("sources", [])):
        if not str(src.get("url", "")).startswith("https://") or not src.get("title"):
            r.error(f"{lid}.feature.sources[{i}]", "needs a title and an https url")
    if lesson.get("quiz"):
        r.warn(lid, "quizzes are retired (the learner did not like them); remove quiz")
    for i, sit in enumerate(lesson.get("situations", [])):
        where = f"{lid}.situations[{i}]"
        check_text(r, where, sit.get("vi", ""))
        if not sit.get("en") or not sit.get("ask"):
            r.error(where, "needs en and ask")
        opts = sit.get("options")
        if sit.get("say"):
            accept = sit.get("accept") or []
            if not accept or not all(isinstance(a, str) and a.strip() for a in accept):
                r.error(where, "a say question needs accept: the ways of saying it that count as right")
            elif nfc(sit.get("vi", "")).strip() not in [nfc(a).strip() for a in accept]:
                r.error(where, "vi (the model answer) must be one of accept")
            for a in accept:
                check_text(r, where, a)
            if opts or sit.get("digits"):
                r.error(where, "a say question has no options or digits")
            if not re.search(r"\d", str(sit["say"])):
                r.error(where, "say shows the price in figures, like 25.000₫")
            for key in ("reply", "replyMissed"):
                if sit.get(key) is not None:
                    rep = sit[key]
                    if not rep.get("vi") or not rep.get("en"):
                        r.error(f"{where}.{key}", "needs vi and en")
                    else:
                        check_text(r, f"{where}.{key}", rep["vi"])
            if sit.get("saves") is not None and not (isinstance(sit["saves"], int) and sit["saves"] > 0):
                r.error(where, "saves is the đồng haggled off, a whole number")
        elif opts:
            if sit.get("answer") not in opts:
                r.error(where, "answer must be one of the options")
            if len(set(opts)) != len(opts) or not 2 <= len(opts) <= 4:
                r.error(where, "use 2 to 4 different options")
        elif not str(sit.get("digits", "")).replace(".", "").isdigit():
            r.error(where, "needs options and an answer, or digits")
        elif sit.get("placeholder") and re.sub(r"\D", "", str(sit["placeholder"])) == re.sub(r"\D", "", str(sit["digits"])):
            r.error(where, "the placeholder gives the answer away; remove it")
        if sit.get("picture"):
            check_picture(r, where, sit["picture"])
    for i, d in enumerate(lesson.get("dialogues", [])):
        where = f"{lid}.dialogues[{i}]"
        if not d.get("title"):
            r.error(where, "needs a title")
        if d.get("setting") not in (None, "table", "street"):
            r.error(where, "setting is table or street")
        lines = d.get("lines", [])
        if not 2 <= len(lines) <= 8:
            r.error(where, f"has {len(lines)} lines; use 2 to 8")
        for j, line in enumerate(lines):
            check_text(r, f"{where}.lines[{j}]", line.get("vi", ""))
            if not line.get("who") or not line.get("en"):
                r.error(f"{where}.lines[{j}]", "needs who, vi and en")
        chk = d.get("check") or {}
        opts = chk.get("options") or []
        if not chk.get("ask") or chk.get("answer") not in opts or not 2 <= len(set(opts)) == len(opts) <= 4:
            r.error(where, "check needs ask, 2 to 4 different options and an answer among them")
        for o in opts:
            check_text(r, f"{where}.check", o)
        if d.get("picture"):
            check_picture(r, where, d["picture"])
    if not lesson.get("situations") and newest:
        r.warn(lid, "no real-life situations")
    elif newest and not 5 <= len(lesson["situations"]) <= 8:
        r.warn(lid, f"has {len(lesson['situations'])} real-life situations; use 5 to 8")
    c = lesson.get("challenge")
    if not c or not c.get("text"):
        r.warn(lid, "no challenge (a real thing to try)")
    st = lesson.get("stamp")
    if not st or not st.get("label"):
        r.error(lid, "missing stamp label")
    else:
        check_picture(r, f"{lid}.stamp", st.get("picture"))
    cover = lesson.get("cover")
    if not cover or not cover.get("picture"):
        r.warn(lid, "no cover picture")
    else:
        check_picture(r, f"{lid}.cover", cover["picture"])


def check_lesson(r, entry, lesson, earlier_words, audio, known_words, warmed=frozenset()):
    lid = entry["id"]
    if lesson.get("id") != lid:
        r.error(lid, f"id {lesson.get('id')!r} does not match the index entry")
    for field in ("number", "title", "vi", "intro", "words"):
        if field not in lesson:
            r.error(lid, f"missing {field}")
    check_text(r, f"{lid}.vi", lesson.get("vi", ""))
    for field in ("title", "intro"):
        check_limit(r, lid, lesson, field)

    words = lesson.get("words", [])
    if not 4 <= len(words) <= 16:
        r.error(lid, f"has {len(words)} words; use 4 to 16")
    seen = set()
    for i, w in enumerate(words):
        where = f"{lid}.words[{i}] {w.get('vi', '?')}"
        check_text(r, where, w.get("vi", ""))
        check_text(r, where, w.get("en", ""), "en")
        for field in ("en", "hook", "tip", "note"):
            check_limit(r, where, w, field)
        if not w.get("hook"):
            r.warn(where, "no memory hook")
        if "picture" in w:
            check_picture(r, where, w["picture"])
        else:
            r.warn(where, "no picture")
        gloss_words = re.findall(r"[^\W\d_]+", nfc(w.get("en", "")).lower())
        own = re.findall(r"[^\W\d_]+", nfc(w.get("vi", "")).lower())
        if own and any(gloss_words[i:i + len(own)] == own for i in range(len(gloss_words) - len(own) + 1)):
            r.error(where, "the gloss contains the word itself, and typing prompts show the gloss; move the example to the note")
        if w.get("fact") and len(w["fact"]) > 260:
            r.error(where, f"fact is {len(w['fact'])} characters (limit 260)")
        if nfc(w.get("vi", "")).lower() in known_words:
            r.error(where, "the learner already knows this word (web/lessons/known.json)")
        key = nfc(w.get("vi", "")).lower()
        if key in seen:
            r.error(where, "duplicate word in this lesson")
        if key in earlier_words:
            r.error(where, f"already taught in {earlier_words[key]}; list it under review instead")
        seen.add(key)
        if key in SOUTHERN:
            r.warn(where, f"more typical of the South; Hà Nội usually says {SOUTHERN[key]}")
        for j, c in enumerate(w.get("contrast", [])):
            cw = f"{where}.contrast[{j}]"
            check_text(r, cw, c.get("vi", ""))
            check_text(r, cw, c.get("en", ""), "en")
            if nfc(c.get("vi", "")) == nfc(w.get("vi", "")):
                r.error(cw, "contrast is the same as the word")
            if strip_all(c.get("vi", "")).lower() != strip_all(w.get("vi", "")).lower():
                r.warn(cw, f"{c.get('vi')!r} differs from {w.get('vi')!r} in more than tone and vowel marks")
    ens = [x.get("en") for x in words]
    if len(set(ens)) != len(ens):
        r.error(lid, "two words share the same English meaning, so choice questions would be ambiguous")

    check_feature(r, lid, lesson, newest=bool(known_words))
    if known_words:
        check_use(r, lid, lesson)
    warm = set()
    for i, w in enumerate(lesson.get("warmup", [])):
        where = f"{lid}.warmup[{i}] {w.get('vi', '?')}"
        check_text(r, where, w.get("vi", ""))
        check_text(r, where, w.get("en", ""), "en")
        warm.add(nfc(w.get("vi", "")).lower())
    if len(warm) != len(lesson.get("warmup", [])):
        r.error(lid, "duplicate warm-up words")

    known = set(seen) | set(earlier_words) | warm | set(warmed) | set(known_words)
    for i, c in enumerate(lesson.get("combos", [])):
        where = f"{lid}.combos[{i}] {c.get('vi', '?')}"
        check_text(r, where, c.get("vi", ""))
        check_text(r, where, c.get("en", ""), "en")
        check_limit(r, where, c, "note")
        for syl in syllables(c.get("vi", "")):
            if not c.get("note") and not any(syl in k.split() for k in known):
                r.warn(where, f"syllable {syl!r} is not a taught word; explain it in a note")
    combo_ens = [c.get("en") for c in lesson.get("combos", [])]
    if len(set(combo_ens)) != len(combo_ens):
        r.error(lid, "two combos share the same English meaning")
    if lesson.get("combos") and len(lesson["combos"]) < 4:
        r.error(lid, "use at least four combos, or none")

    g = lesson.get("grammar")
    if g:
        for field in ("title", "text"):
            if not g.get(field):
                r.error(f"{lid}.grammar", f"missing {field}")
        for i, x in enumerate(g.get("examples", [])):
            check_text(r, f"{lid}.grammar.examples[{i}]", x.get("vi", ""))

    for vi in lesson.get("review", []):
        if nfc(vi).lower() not in earlier_words and nfc(vi).lower() not in warmed:
            r.error(f"{lid}.review", f"{vi!r} was not taught in an earlier lesson")
        if nfc(vi).lower() in known_words:
            r.error(f"{lid}.review", f"{vi!r} is a known word (web/lessons/known.json); known words are never reviewed")

    if audio is not None:
        texts = [w["vi"] for w in words if "vi" in w]
        texts += [c["vi"] for w in words for c in w.get("contrast", [])]
        texts += [c["vi"] for c in lesson.get("combos", [])]
        texts += [x["vi"] for x in (g or {}).get("examples", [])]
        texts += [w["vi"] for w in lesson.get("warmup", [])]
        texts += [x["vi"] for x in lesson.get("situations", [])]
        texts += [r["vi"] for x in lesson.get("situations", []) for r in (x.get("reply"), x.get("replyMissed")) if r and r.get("vi")]
        texts += [line["vi"] for d in lesson.get("dialogues", []) for line in d.get("lines", [])]
        texts += [d["check"]["answer"] for d in lesson.get("dialogues", []) if d.get("check", {}).get("answer")]
        texts += [x["answer"] for x in lesson.get("situations", []) if re.search(r"[^\W\d_]", x.get("answer", ""))]
        for t in texts:
            cid = audio.get(nfc(t).strip())
            if not cid:
                r.error(lid, f"no audio clip for {t!r}; run scripts/make_audio.py")
            elif not (WEB / "audio" / f"{cid}.m4a").exists():
                r.error(lid, f"audio file for {t!r} is missing")
    return seen, warm


MAX_ANSWERS = 50


def check_use(r, lid, lesson):
    """Warns about new or review words that are only drilled, never heard in a situation, combo or story beat."""
    lines = [t for x in lesson.get("situations", []) for t in [x.get("vi", ""), x.get("answer", "")] + list(x.get("options", []))]
    lines += [c.get("vi", "") for c in lesson.get("combos", [])]
    lines += [t for d in lesson.get("dialogues", []) for t in [x.get("vi", "") for x in d.get("lines", [])] + list((d.get("check") or {}).get("options", []))]
    lines += [b.get("text", "") for b in (lesson.get("feature") or {}).get("beats", [])]
    seqs = [re.findall(r"[^\W\d_]+", nfc(t).lower()) for t in lines]
    def used(word):
        target = re.findall(r"[^\W\d_]+", nfc(word).lower())
        n = len(target)
        return n and any(seq[i:i + n] == target for seq in seqs for i in range(len(seq) - n + 1))
    for w in [x.get("vi", "") for x in lesson.get("words", [])] + list(lesson.get("review", [])):
        if not used(w):
            r.warn(lid, f"{w} is never used in a situation, combo or story beat")


def check_plan(r, lid):
    """Plays the newest issue through the site's own engine (scripts/plan.mjs) to check its length and story placement."""
    node = shutil.which("node")
    if not node:
        r.warn(lid, "node not found, so story order and length were not checked")
        return
    try:
        out = subprocess.run([node, str(ROOT / "scripts" / "plan.mjs"), "--json", lid], check=True, capture_output=True, text=True, timeout=60).stdout
        plan = json.loads(out)[0]
    except Exception as e:
        r.error(lid, f"scripts/plan.mjs failed: {str(e).splitlines()[0] if str(e) else e}")
        return
    if not plan["inOrder"]:
        r.error(lid, "the story plays out of order")
    if plan["answers"] > MAX_ANSWERS:
        r.warn(lid, f"{plan['answers']} answers before rush hour; keep an issue near 45 (fewer new or review words, or fewer situations)")
    beats = plan["beats"]
    for a, b in zip(beats, beats[1:]):
        if a["answersBefore"] == b["answersBefore"] and a["where"] != "on the results page":
            r.warn(lid, f"story beats {a['beat'] + 1} and {b['beat'] + 1} play back to back; tie one to a later word or untie it (node scripts/plan.mjs {lid})")


def load_known(r):
    path = WEB / "lessons" / "known.json"
    if not path.exists():
        return set()
    words = json.loads(path.read_text(encoding="utf-8")).get("words", [])
    for w in words:
        check_text(r, "known.json", w)
    return {nfc(w).lower() for w in words}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-audio", action="store_true")
    args = parser.parse_args()

    r = Report()
    index = json.loads((WEB / "lessons" / "index.json").read_text(encoding="utf-8"))
    audio = None
    if not args.no_audio:
        path = WEB / "audio" / "index.json"
        audio = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    earlier = {}
    warmed = set()
    numbers = []
    known_words = load_known(r)
    for entry in index["lessons"]:
        path = WEB / "lessons" / entry["file"]
        if not path.exists():
            r.error(entry["id"], f"file {entry['file']} is missing")
            continue
        lesson = json.loads(path.read_text(encoding="utf-8"))
        numbers.append(lesson.get("number"))
        taught, warm = check_lesson(r, entry, lesson, earlier, audio, known_words if entry is index["lessons"][-1] else set(), frozenset(warmed))
        for w in taught:
            earlier[w] = entry["id"]
        warmed |= warm
    if index["lessons"]:
        check_plan(r, index["lessons"][-1]["id"])
    if numbers != list(range(1, len(numbers) + 1)):
        r.error("index", f"lesson numbers should run 1, 2, 3... in order; found {numbers}")

    for w in r.warnings:
        print(f"warning: {w}")
    for e in r.errors:
        print(f"error: {e}")
    print(f"{len(index['lessons'])} lessons, {len(earlier)} words, {len(r.errors)} errors, {len(r.warnings)} warnings")
    return 1 if r.errors else 0


if __name__ == "__main__":
    sys.exit(main())

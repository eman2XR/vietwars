#!/usr/bin/env python3
"""Checks every lesson listed in web/lessons/index.json against the lesson format (docs/LESSON_FORMAT.md).

Errors fail the check; warnings are printed for a human or reviewer to judge.
Use --no-audio to skip the audio checks (for example in CI before clips exist).
"""

import argparse
import json
import re
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
PICTURE_KINDS = set(re.findall(r"case '([a-z]+)':", (WEB / "js" / "pictures.js").read_text(encoding="utf-8")))


ICON_NAMES = set(re.findall(r"^  ([a-z]+): `", (WEB / "js" / "pictures.js").read_text(encoding="utf-8"), re.M))
SCENE_NAMES = set(re.findall(r"^  ([a-zA-Z]+): `", (WEB / "js" / "pictures.js").read_text(encoding="utf-8").split("const SCENES = {")[1].split("};")[0], re.M))


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


def check_feature(r, lid, lesson):
    f = lesson.get("feature")
    if not f:
        r.error(lid, "missing feature (the issue's article)")
        return
    for field in ("kicker", "title", "dek", "body", "sources"):
        if not f.get(field):
            r.error(f"{lid}.feature", f"missing {field}")
    body = f.get("body", [])
    if not 2 <= len(body) <= 6:
        r.error(f"{lid}.feature", f"has {len(body)} paragraphs; use 2 to 6")
    for i, para in enumerate(body):
        check_text(r, f"{lid}.feature.body[{i}]", para, "text")
        if len(para) > 800:
            r.error(f"{lid}.feature.body[{i}]", f"is {len(para)} characters (limit 800)")
    words = sum(len(p.split()) for p in body)
    if not 120 <= words <= 450:
        r.warn(f"{lid}.feature", f"article is {words} words; aim for 150 to 350")
    for i, src in enumerate(f.get("sources", [])):
        if not str(src.get("url", "")).startswith("https://") or not src.get("title"):
            r.error(f"{lid}.feature.sources[{i}]", "needs a title and an https url")
    quiz = lesson.get("quiz", [])
    if not 2 <= len(quiz) <= 6:
        r.error(lid, f"has {len(quiz)} quiz questions; use 2 to 6")
    for i, q in enumerate(quiz):
        where = f"{lid}.quiz[{i}]"
        opts = q.get("options", [])
        if not q.get("q") or not 2 <= len(opts) <= 4:
            r.error(where, "needs q and 2 to 4 options")
        if not isinstance(q.get("answer"), int) or not 0 <= q.get("answer", -1) < len(opts):
            r.error(where, "answer must be the index of the right option")
        if len(set(opts)) != len(opts):
            r.error(where, "options repeat")
        if not q.get("explain"):
            r.warn(where, "no explain line")
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


def check_lesson(r, entry, lesson, earlier_words, audio, known_words):
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
        if w.get("fact") and len(w["fact"]) > 260:
            r.error(where, f"fact is {len(w['fact'])} characters (limit 260)")
        if not w.get("fact"):
            r.warn(where, "no did-you-know fact")
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

    check_feature(r, lid, lesson)
    warm = set()
    for i, w in enumerate(lesson.get("warmup", [])):
        where = f"{lid}.warmup[{i}] {w.get('vi', '?')}"
        check_text(r, where, w.get("vi", ""))
        check_text(r, where, w.get("en", ""), "en")
        warm.add(nfc(w.get("vi", "")).lower())
    if len(warm) != len(lesson.get("warmup", [])):
        r.error(lid, "duplicate warm-up words")

    known = set(seen) | set(earlier_words) | warm | set(known_words)
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
        if nfc(vi).lower() not in earlier_words:
            r.error(f"{lid}.review", f"{vi!r} was not taught in an earlier lesson")
        if nfc(vi).lower() in known_words:
            r.error(f"{lid}.review", f"{vi!r} is a known word (web/lessons/known.json); known words are never reviewed")

    if audio is not None:
        texts = [w["vi"] for w in words if "vi" in w]
        texts += [c["vi"] for w in words for c in w.get("contrast", [])]
        texts += [c["vi"] for c in lesson.get("combos", [])]
        texts += [x["vi"] for x in (g or {}).get("examples", [])]
        texts += [w["vi"] for w in lesson.get("warmup", [])]
        for t in texts:
            cid = audio.get(nfc(t).strip())
            if not cid:
                r.error(lid, f"no audio clip for {t!r}; run scripts/make_audio.py")
            elif not (WEB / "audio" / f"{cid}.m4a").exists():
                r.error(lid, f"audio file for {t!r} is missing")
    return seen | warm


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
    numbers = []
    known_words = load_known(r)
    for entry in index["lessons"]:
        path = WEB / "lessons" / entry["file"]
        if not path.exists():
            r.error(entry["id"], f"file {entry['file']} is missing")
            continue
        lesson = json.loads(path.read_text(encoding="utf-8"))
        numbers.append(lesson.get("number"))
        for w in check_lesson(r, entry, lesson, earlier, audio, known_words if entry is index["lessons"][-1] else set()):
            earlier[w] = entry["id"]
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

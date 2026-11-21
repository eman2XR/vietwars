#!/usr/bin/env python3
"""Generates an audio clip for every Vietnamese string in the lessons, using the macOS voice Linh.

Clips are named by a hash of their text and listed in web/audio/index.json, which the site reads.
Existing clips are kept; clips no lesson uses any more are deleted. Use --force to regenerate all.
"""

import argparse
import hashlib
import json
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
AUDIO = WEB / "audio"
VOICE = "Linh"


def nfc(s):
    return unicodedata.normalize("NFC", s).strip()


def lesson_texts(lesson):
    texts = []
    for w in lesson.get("words", []):
        texts.append(w["vi"])
        texts.extend(c["vi"] for c in w.get("contrast", []))
    texts.extend(w["vi"] for w in lesson.get("warmup", []))
    texts.extend(c["vi"] for c in lesson.get("combos", []))
    texts.extend(x["vi"] for x in (lesson.get("grammar") or {}).get("examples", []))
    return texts


def all_texts():
    index = json.loads((WEB / "lessons" / "index.json").read_text(encoding="utf-8"))
    texts = []
    for entry in index["lessons"]:
        lesson = json.loads((WEB / "lessons" / entry["file"]).read_text(encoding="utf-8"))
        texts.extend(lesson_texts(lesson))
    return sorted({nfc(t) for t in texts})


def clip_id(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="regenerate every clip")
    args = parser.parse_args()

    AUDIO.mkdir(parents=True, exist_ok=True)
    texts = all_texts()
    index = {}
    made = 0
    for text in texts:
        cid = clip_id(text)
        index[text] = cid
        path = AUDIO / f"{cid}.m4a"
        if path.exists() and not args.force:
            continue
        subprocess.run(
            ["say", "-v", VOICE, "-o", str(path), "--data-format=aac", text],
            check=True,
        )
        made += 1

    keep = {f"{cid}.m4a" for cid in index.values()}
    removed = 0
    for path in AUDIO.glob("*.m4a"):
        if path.name not in keep:
            path.unlink()
            removed += 1

    (AUDIO / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(f"{len(index)} clips ({made} new, {removed} removed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

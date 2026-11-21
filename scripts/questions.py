#!/usr/bin/env python3
"""The learner's questions ("Ask the editors" on the site) and the editors' answers.

The site posts each question as a GitHub issue. An answer is a comment on that issue, which the site
shows under Ask, with a play button for every phrase.

  python3 scripts/questions.py                        open questions that need an answer
  python3 scripts/questions.py --json                 the same as JSON
  python3 scripts/questions.py answer N FILE          post the answer in FILE to question issue N, then close it
  python3 scripts/questions.py answer N FILE --dry-run    print the comment instead of posting it
  python3 scripts/questions.py sync                   save every question and answer to learner/questions.json

FILE is JSON:
  {"text": "The answer, in short Markdown paragraphs.",
   "phrases": [{"vi": "Cho tôi xin hóa đơn.", "en": "The bill, please."}]}
"""

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "eman2XR/vietwars"
QUESTION = re.compile(r"<!-- vietwars-question -->\s*```json\s*(\{.*?\})\s*```", re.S)
ANSWER = re.compile(r"<!-- vietwars-answer\s*(.*?)\s*-->", re.S)
SAVED = ROOT / "learner" / "questions.json"
MAX_TEXT = 1500
MAX_PHRASES = 6


def gh(*args, stdin=None):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True, input=stdin, timeout=120).stdout


def parse(issue):
    m = QUESTION.search(issue.get("body") or "")
    if not m:
        return None
    try:
        q = json.loads(m.group(1))
    except json.JSONDecodeError:
        return None
    return {**q, "number": issue["number"], "state": str(issue.get("state", "")).lower()}


def answer_of(comments):
    """The newest comment with an answer block, or else the newest comment."""
    if not comments:
        return None
    c = next((x for x in reversed(comments) if ANSWER.search(x.get("body") or "")), comments[-1])
    body = c.get("body") or ""
    phrases = []
    m = ANSWER.search(body)
    if m:
        try:
            phrases = json.loads(m.group(1)).get("phrases", [])
        except json.JSONDecodeError:
            phrases = []
    return {"text": ANSWER.sub("", body).strip(), "phrases": phrases, "at": c.get("createdAt") or c.get("created_at")}


def open_questions():
    out = gh("issue", "list", "-R", REPO, "--state", "open", "--limit", "200", "--json", "number,state,body,comments")
    found = []
    for issue in json.loads(out):
        q = parse(issue)
        if q:
            q["comments"] = [{"body": c.get("body"), "at": c.get("createdAt")} for c in issue.get("comments") or []]
            found.append(q)
    return sorted(found, key=lambda q: q.get("askedAt", ""))


def all_questions():
    out = gh("issue", "list", "-R", REPO, "--state", "all", "--limit", "500", "--search", "Question in:title",
             "--json", "number,state,body,comments")
    found = []
    for issue in json.loads(out):
        q = parse(issue)
        if q:
            q["answer"] = answer_of(issue.get("comments") or [])
            found.append(q)
    return sorted(found, key=lambda q: q.get("askedAt", ""))


def sync():
    qs = all_questions()
    SAVED.parent.mkdir(exist_ok=True)
    SAVED.write_text(json.dumps(qs, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return qs


def nfc(s):
    return unicodedata.normalize("NFC", s)


def compose(data):
    text = nfc(str(data.get("text", "")).strip())
    phrases = data.get("phrases") or []
    problems = []
    if not text:
        problems.append("text is empty")
    if len(text) > MAX_TEXT:
        problems.append(f"text is {len(text)} characters (limit {MAX_TEXT})")
    if not isinstance(phrases, list) or len(phrases) > MAX_PHRASES:
        problems.append(f"phrases must be a list of at most {MAX_PHRASES}")
        phrases = []
    clean = []
    for i, p in enumerate(phrases):
        vi, en = nfc(str(p.get("vi", "")).strip()), str(p.get("en", "")).strip()
        if not vi or not en:
            problems.append(f"phrases[{i}] needs vi and en")
        clean.append({"vi": vi, "en": en})
    block = json.dumps({"phrases": clean}, ensure_ascii=False)
    if "-->" in block or "-->" in text:
        problems.append("the answer must not contain -->")
    if problems:
        raise SystemExit("error: " + "; ".join(problems))
    return f"{text}\n\n<!-- vietwars-answer {block} -->\n"


def post_answer(number, path, dry_run=False):
    body = compose(json.loads(Path(path).read_text(encoding="utf-8")))
    issue = json.loads(gh("issue", "view", str(number), "-R", REPO, "--json", "number,state,body"))
    if not parse(issue):
        raise SystemExit(f"error: issue #{number} is not a question from the site")
    if dry_run:
        print(body)
        return
    gh("issue", "comment", str(number), "-R", REPO, "--body-file", "-", stdin=body)
    if str(issue.get("state", "")).lower() == "open":
        gh("issue", "close", str(number), "-R", REPO)
    print(f"answered #{number}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", nargs="?", default="list", choices=["list", "answer", "sync"])
    parser.add_argument("number", nargs="?", type=int)
    parser.add_argument("file", nargs="?")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.command == "answer":
        if not args.number or not args.file:
            parser.error("answer needs an issue number and a file")
        post_answer(args.number, args.file, args.dry_run)
        if not args.dry_run:
            sync()
        return 0
    if args.command == "sync":
        qs = sync()
        print(f"{len(qs)} question(s), {sum(1 for q in qs if q.get('answer'))} answered; wrote learner/questions.json")
        return 0
    qs = open_questions()
    if args.json:
        print(json.dumps(qs, ensure_ascii=False, indent=1))
    elif not qs:
        print("no open questions")
    else:
        for q in qs:
            print(f"#{q['number']} asked {q.get('askedAt', '?')[:16]}" + (f" ({q['context']})" if q.get("context") else ""))
            print(f"  {q.get('text', '')}")
            for c in q["comments"]:
                print(f"  comment {c['at']}: {c['body']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

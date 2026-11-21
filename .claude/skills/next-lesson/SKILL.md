---
name: next-lesson
description: Plan, write, review and publish the next Vietnamese lesson from the learner's saved results and feedback. Use when the user asks for the next lesson, a new lesson, or to process lesson results.
---

# Next lesson

Builds `web/lessons/lesson-NN.json` from what the learner's results show, gets it reviewed, checks it on iPhone and iPad, and publishes it. Read `CLAUDE.md`, `docs/PEDAGOGY.md` and `docs/LESSON_FORMAT.md` first.

## 1. Gather the data

```sh
python3 scripts/ingest.py
```

Read `learner/SUMMARY.md`, and `learner/profile.json` for detail. Read the last entries of `docs/LESSON_LOG.md` and the most recent lesson file.

If there are no results since the last lesson was added, tell the user and ask whether to build the next lesson anyway (from the roadmap alone) or wait for them to play the current one.

## 2. Plan

Write a short plan before any content, and show it to the user in your final message:

- Theme and why (the learner's `wantNext`, otherwise the next roadmap theme).
- Number of new words and why (last accuracy and difficulty rating, per the rules in `docs/PEDAGOGY.md`).
- Review words and why (weakest strength, confusions, words marked hardest).
- What the data says to change (tone pairs to practise, typing patterns, fun rating).

## 3. Write the lesson

Write `web/lessons/lesson-NN.json` (next number) and add its entry to `web/lessons/index.json` with today's date. Follow every rule in `docs/PEDAGOGY.md`: Northern words, vivid hooks tied to the tone shape, Hà Nội pronunciation tips, real contrast words that sound different in Hà Nội, at least four combos, one grammar rule. Then:

```sh
python3 scripts/make_audio.py
python3 scripts/check_lessons.py
```

Fix every error. Judge every warning, and fix it or note in the log why it stays.

## 4. Review

Run two reviews as subagents in parallel. Give each the file path and the context below, not your own opinion of the lesson. Ask for "must fix" and "suggestions", each with the field and an exact replacement, under 600 words.

- **Vietnamese accuracy** (native-level Northern reviewer): spelling and tone marks; glosses as used in the North; nothing Southern-only; pronunciation tips accurate for Hà Nội; hooks that would teach a wrong sound, syllable count or tone direction; contrast words that are real, common and sound different from the target in Hà Nội (no r/d/gi, tr/ch or s/x-only pairs); natural combos; a correct grammar rule.
- **Learning design** (give it `learner/SUMMARY.md` too): does the lesson answer what the data shows (weak words reviewed, confusions practised, feedback followed); is the load right; are the hooks memorable and concrete; anything confusing for this learner.

Apply every must-fix and the suggestions you agree with, then rerun `make_audio.py` and `check_lessons.py`.

## 5. Check

```sh
node --test
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 scripts/check_site.py
```

Both devices must pass. Look at a few screenshots of the new lesson in `.checks/` (the intro, a word card, a spelling question) for overflow, clipped text or anything unreadable.

## 6. Log and publish

Add an entry at the top of `docs/LESSON_LOG.md`: date, lesson, the data you used (sessions, accuracy, weak words, confusions, feedback quotes), and each decision with its reason. Then commit the lesson, its audio, `learner/` and the log, and push `main`:

```sh
git add web/lessons web/audio learner docs/LESSON_LOG.md
git commit -m "Add lesson NN: <title>"
git push
python3 scripts/ingest.py --close
```

`--close` closes the result issues that are now saved, with a comment. Wait for the Pages deploy (`gh run list -R eman2XR/vietwars --limit 1`) and tell the user the lesson is live, what it covers and why, in a few lines.

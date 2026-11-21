---
name: next-lesson
description: Plan, write, review, test and publish the next issue of the Học tiếng Việt magazine (a lesson) from the learner's saved results, feedback and curriculum. Use when the user asks for the next lesson or a new lesson, or when scripts/status.py --decide says next-lesson.
---

# Next lesson

Builds the next issue, `web/lessons/lesson-NN.json`: an article on Vietnamese history or culture, a quiz, a challenge and the words, planned from what the learner's results show. It has it reviewed, tests it on iPhone, iPad and Mac, and publishes it. Read `CLAUDE.md`, `docs/PEDAGOGY.md` and `docs/LESSON_FORMAT.md` first; they hold the rules this skill relies on.

## 1. Gather the data

```sh
python3 scripts/ingest.py
python3 scripts/status.py
```

Read `learner/SUMMARY.md`, `learner/NOTES.md`, `learner/curriculum.json`, `web/lessons/known.json`, the top entries of `docs/LESSON_LOG.md` and the newest lesson file. Use `learner/profile.json` for detail.

If the newest lesson has not been played yet (`newestPlayed: False`), do not build another one unless the user asked for it explicitly: one unplayed lesson should be waiting, not a pile. Say so and stop.

If the learner said something about their knowledge or wishes in the conversation, add it to `learner/NOTES.md` first (newest first, dated). If they said they know certain words, add those to `web/lessons/known.json`.

## 2. Plan

Write a short plan before any content and show it in your final message:

- Theme and why: the learner's `wantNext`, otherwise the next `planned` unit in `learner/curriculum.json` (reorder units if the data says so).
- Number of new words and why (meaning accuracy and the difficulty rating; see PEDAGOGY.md).
- Review words and why (weakest meaning, words marked hardest, meaning confusions). Never known-list words.
- A warm-up, if the theme has basics the learner probably knows.
- What the data says to change (tone pairs, spelling, typing with the tone keys, fun and difficulty ratings, the article rating and reading time, quiz scores).
- The story: the article's subject and hook (the unit's `storyIdea`, or better), its sources, the quiz questions, the challenge, and the cover scene (reuse one, or draw a new one in context).

## 3. Write the lesson

Write `web/lessons/lesson-NN.json` (next number) and add it to `web/lessons/index.json` with today's date. Follow every rule in `docs/PEDAGOGY.md`. Research the article first: fetch the sources from Wikipedia with curl (`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=...`, and vi.wikipedia.org) and write only what they support. If the theme needs a new cover scene or a word needs a picture no kind fits, add an original SVG drawing to `web/js/pictures.js`. Then:

```sh
python3 scripts/make_audio.py
python3 scripts/check_lessons.py
```

Fix every error. Judge every warning: fix it, or note in the log why it stays.

## 4. Review

Run three reviews as subagents in parallel. Give each the file path and the context, not your opinion of the lesson. Ask for "must fix" and "suggestions" with the field path and an exact replacement, under 700 words.

- **Vietnamese accuracy** (a strict native-level Northern reviewer): spelling and tone marks; glosses as used in the North; nothing Southern-only; Hà Nội pronunciation tips; hooks that would teach a wrong sound, vowel length, syllable count or tone direction; contrast words that are real, common and sound different in Hà Nội; natural combos and grammar; every Vietnamese phrase in the article, facts and challenge.
- **History and culture fact-check** (give it curl access to Wikipedia): every claim in the article, facts, quiz (right answer right, distractors clearly wrong) and challenge, against the sources and recent changes; tone and taste for a Vietnamese reader.
- **Learning design** (give it `learner/SUMMARY.md`, `learner/NOTES.md` and the previous lesson too): does the lesson answer the data and what the learner said; is the load right; are hooks memorable and distinct; are there one-mark pairs, near-synonyms or clashing glosses taught together; is it fun and a little surprising; is the article interesting for an adult and the right length.

Apply every must-fix and the suggestions you agree with. If the changes are large, send the changed parts back to the Vietnamese reviewer. Then rerun `make_audio.py` and `check_lessons.py`.

## 5. Test

```sh
node --test
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 scripts/check_site.py
```

All five devices must pass (iPhone 15, iPhone SE, iPad Pro portrait in dark mode and landscape, desktop Safari). Look at the new lesson's screenshots in `.checks/` (the article with its cover, the quiz, a word card with its fact, the tone keys, results with the stamp) for overflow, clipped text, unreadable colours or a picture that does not read. If art or styles changed, also run `scripts/style_shots.py` and look at the sheets in `docs/styles/`.

## 6. Log, update the curriculum, publish

1. Add an entry at the top of `docs/LESSON_LOG.md`: date, lesson, the data used (sessions, meaning and spelling accuracy, weak words, confusions, quiz and article signals, feedback quotes), and each decision with its reason, including review changes.
2. Update `learner/curriculum.json`: mark the unit `active` with its lesson id, mark the previous one `done`, add notes, reorder upcoming units if the data suggests it, and set `updated`.
3. Commit and push:

```sh
git add -A web docs learner scripts .claude/skills
git commit -m "Add lesson NN: <title>"
git push
python3 scripts/ingest.py --close
```

`--close` closes the saved result issues with a comment. Wait for the deploy (`gh run list -R eman2XR/vietwars --limit 1`) and confirm it succeeded.

4. Tell the user in a few lines: the issue is live, its story, the words it covers, and why (the data behind the choices).

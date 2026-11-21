---
name: review-progress
description: Review the Viet Wars learner's progress across all sessions, adapt the curriculum, the known list and the planning rules, and report. Use when the user asks how they are doing, asks to adapt or re-plan the curriculum, or when scripts/status.py --decide says review-progress (every five sessions or seven days).
---

# Review progress

A deeper, less frequent look than a single lesson: trends across sessions, whether the curriculum still fits, and whether the rules in `docs/PEDAGOGY.md` need to change. Read `CLAUDE.md` and `docs/PEDAGOGY.md` first.

## 1. Gather

```sh
python3 scripts/ingest.py
python3 scripts/status.py
```

Read `learner/SUMMARY.md`, `learner/profile.json`, `learner/NOTES.md`, `learner/curriculum.json`, `web/lessons/known.json`, `docs/LESSON_LOG.md` and the previous `learner/REVIEW.md` if there is one. Skim the raw results in `learner/results/` for anything the summary hides (timings, hints, which exercise types fail, dictation versus typing from meaning, abandoned answers, the style the learner uses).

## 2. Analyse

Answer each question with numbers from the data:

- **Vocabulary size**: words met, on the known list, and holding up in reviews (meaning strength 0.8 or more). How far along the current phase target is the learner?
- **Retention**: are words coming back from spaced reviews correctly? Which words keep failing after two or more reviews (leeches)? A leech needs a new hook, a new picture or a note; propose them.
- **Meaning versus spelling**: is spelling lagging behind meaning? Is the learner using the tone keys? Which tone pairs and vowel marks fail?
- **Difficulty and fun**: trend of difficulty and fun ratings, battle results (wins, ranks, hearts lost, knockouts), session length. Too easy, too hard, or right?
- **Engagement**: how often the learner plays, reviews skipped or overdue, sessions abandoned.
- **Feedback**: every `wantNext` and `note` since the last review, and whether the lessons answered them.

## 3. Adapt

Make the changes the analysis supports, and only those:

- `learner/curriculum.json`: reorder units, add units the learner asked for, insert a remedial or consolidation lesson for leeches, split or merge units, adjust the pace, move to the next phase when its exit condition is met. Set `reviewedAt` and `updated` to today.
- `web/lessons/known.json`: add words only when the learner says they know them, or when a word was confirmed with "I know it" and never failed since. Never remove a word the learner put there without asking.
- `docs/PEDAGOGY.md`: change a rule when the data shows it does not work for this learner (for example lesson size, warm-up use, hook style, battle difficulty). Keep it short; record why in `learner/REVIEW.md`.
- Leech fixes: improve the hook, note or picture of a failing word in its lesson file, then run `scripts/make_audio.py` and `scripts/check_lessons.py`.
- Engine or design problems (an exercise type that does not teach, a confusing screen): fix them if they are small and run `scripts/check_site.py`; otherwise list them in the review for the user.

## 4. Report and publish

Write `learner/REVIEW.md` (replace it; earlier reviews live in git history):

```markdown
# Progress review, YYYY-MM-DD

## Where things stand
(vocabulary size, phase progress, retention, battles, in a few lines with numbers)

## What is working / what is not
## Changes made
(each with its reason and data)
## Suggestions for the learner
(one to three concrete things, such as reviewing more often or trying a certain style)
```

Add a one-line entry to the top of `docs/LESSON_LOG.md` pointing to the review. Commit and push (`git add -A learner docs web scripts .claude/skills`, then commit "Review progress YYYY-MM-DD" and push). Tell the user the main findings and changes in a few lines.

---
name: lesson-loop
description: One round of the Học tiếng Việt learning loop - answer the learner's questions, collect new results, review progress when due, and build the next lesson when the learner has played the newest one. Use when the user asks to check for results or keep the lessons coming, and as the prompt of a recurring /loop or scheduled job (for example "/loop 15m /lesson-loop").
---

# Lesson loop

One round, cheap when there is nothing to do. Read `CLAUDE.md` once per session.

## Round

1. `python3 scripts/status.py --decide`
2. Act on the answer, then decide again, until it says `wait` (at most three actions per round):
   - `answer-questions`: the learner asked something under Ask on the site. Answer every open question (see "Answering a question" below), then decide again.
   - `ingest`: run `python3 scripts/ingest.py`, then decide again.
   - `review-progress`: follow the `review-progress` skill, then decide again.
   - `adjust-lesson`: the learner closed the newest issue midway at least twice. Follow the "Adjusting an issue" section of the `next-lesson` skill: make the current issue easier or shorter instead of adding a new one.
   - `next-lesson`: follow the `next-lesson` skill. One lesson per round at most.
   - `wait`: nothing to do. Reply with one line, such as "No new results; issue 3 is waiting to be read." Do not repeat the status in detail.
3. If a step fails (no network, `gh` not signed in, a check that keeps failing after two fixes), stop, say what failed in one or two lines, and leave the working tree clean or committed. Never force-push, never delete results or history to get past a limit.

## Answering a question

The learner is waiting, often in the middle of an issue, so answer each question in this round and keep it short.

1. `python3 scripts/questions.py` lists the open questions with their issue numbers and context (the issue and word they were on when they asked). Read `learner/SUMMARY.md` for their level and known words.
2. Write the answer as JSON in a scratch file outside the repository:
   - `text`: two to five short paragraphs of plain Markdown, under 1,500 characters. Answer the question first, then one useful note: how it is used, a mistake to avoid, or how it sounds in Hà Nội. Northern words, spelling and pronunciation only (bát, cốc, vâng, không ạ); say so if the South differs and it matters. Bold for the Vietnamese, nothing fancy.
   - `phrases`: one to six things to say or hear, each `{"vi": "...", "en": "..."}`, written as a Hà Nội speaker would say them. The site gives each one a play button.
   - Be sure. Check facts about history or culture on Wikipedia (`curl -s "https://en.wikipedia.org/w/index.php?title=TITLE&action=raw"`, or vi.wikipedia.org). If a question has no single right answer, say what people commonly say and why. If you cannot answer it well, say so and suggest where it will come up in a later issue.
3. Before posting, have one subagent check the Vietnamese (spelling, tone marks, Northern usage, whether a Hà Nội speaker would say it that way). Give it the question and your JSON, not your reasoning; fix what it finds.
4. `python3 scripts/questions.py answer N FILE --dry-run` to check the comment, then without `--dry-run` to post it. That comments on the issue, closes it and updates `learner/questions.json`.
5. If a question asks for a topic, a change to the site or more practice of something, add it to `learner/NOTES.md` so the next lesson or review uses it. Commit `learner/` with the next lesson, or on its own if no lesson is due.

## Limits

- `scripts/status.py` enforces the pacing: one unplayed lesson at a time, at most two new lessons a day, a progress review every five sessions or seven days. Do not work around it; if the user asks for more, do it on their explicit request only.
- Publishing (pushing to `main`, which deploys the site) is part of the loop: on 2026-11-21 the owner asked for agents to keep creating lessons on their own. Only lessons that pass every check and all three reviews are published. Answers to the learner's questions are posted as soon as they are checked.

## Starting a loop

In a Claude Code session in this folder:

```
/loop 15m /lesson-loop
```

Every 15 minutes keeps answers to questions quick; a round with nothing to do costs one `status.py` call.

A session loop only runs while that session is open. For a loop that survives restarts, start it again in a new session.

---
name: lesson-loop
description: One round of the Học tiếng Việt learning loop - answer the learner's questions, collect new results, review progress when due, and build the next lesson when the learner has played the newest one. Use when the user asks to check for results or keep the lessons coming, and as the prompt of a recurring /loop or scheduled job (for example a job scheduled a few times a day).
---

# Lesson loop

One round, cheap when there is nothing to do. Read `CLAUDE.md` once per session.

## Round

1. `python3 scripts/status.py --decide`
2. Act on the answer, then decide again, until it says `wait` (at most three actions per round):
   - `answer-questions`: the learner asked something under Ask on the site. Answer every open question (see "Answering a question" below), then decide again.
   - `ingest`: run `python3 scripts/ingest.py`, then decide again. This also saves devices that asked for notifications and sends each a welcome notification (`scripts/push.mjs inbox`), and saves Talk transcripts (live conversations) to `learner/talks/`. Read new transcripts: anything the learner asked for, struggled with or said about the lessons or the site is feedback. Add it to `learner/NOTES.md` (dated) so the next plan uses it, and fix small site problems they mention.
   - `review-progress`: follow the `review-progress` skill, then decide again.
   - `adjust-lesson`: the learner closed the newest issue midway at least twice. Follow the "Adjusting an issue" section of the `next-lesson` skill: make the current issue easier or shorter instead of adding a new one.
   - `next-lesson`: follow the `next-lesson` skill. One lesson per round at most.
   - `wait`: nothing to do. Reply with one line, such as "No new results; issue 3 is waiting to be read." Do not repeat the status in detail.
3. Before replying, run `node scripts/reviews.mjs notify`: when words are due for review it sends one reminder to the learner's phone, at most once a day, and otherwise does nothing. Mention it in the reply only if it sent one.
4. If a step fails (no network, `gh` not signed in, a check that keeps failing after two fixes), stop, say what failed in one or two lines, and leave the working tree clean or committed. Never force-push, never delete results or history to get past a limit.

## Answering a question

The learner is waiting, often in the middle of an issue, so answer each question in this round and keep it short.

1. `python3 scripts/questions.py` lists the open questions with their issue numbers and context (the issue and word they were on when they asked). Read `learner/SUMMARY.md` for their level and known words.
2. Write the answer as JSON in a scratch file outside the repository:
   - `text`: two to five short paragraphs of plain Markdown, under 1,500 characters. Answer the question first, then one useful note: how it is used, a mistake to avoid, or how it sounds in Hà Nội. Northern words, spelling and pronunciation only (bát, cốc, vâng, không ạ); say so if the South differs and it matters. Bold for the Vietnamese, nothing fancy.
   - `phrases`: one to six things to say or hear, each `{"vi": "...", "en": "..."}`, written as a Hà Nội speaker would say them. The site gives each one a play button.
   - Be sure. Check facts about history or culture on Wikipedia (`curl -s "https://en.wikipedia.org/w/index.php?title=TITLE&action=raw"`, or vi.wikipedia.org). If a question has no single right answer, say what people commonly say and why. If you cannot answer it well, say so and suggest where it will come up in a later issue.
3. Before posting, have one subagent check the Vietnamese (spelling, tone marks, Northern usage, whether a Hà Nội speaker would say it that way). Give it the question and your JSON, not your reasoning; fix what it finds.
4. `python3 scripts/questions.py answer N FILE --dry-run` to check the comment, then without `--dry-run` to post it. That comments on the issue, closes it and updates `learner/questions.json`. Then tell the learner's phone: `node scripts/push.mjs send --title "Your question has an answer" --body "<the question, shortened>" --url "#/ask" --tag answer`.
5. If a question asks for a topic, a change to the site or more practice of something, add it to `learner/NOTES.md` so the next lesson or review uses it. Commit `learner/` with the next lesson, or on its own if no lesson is due.

## Limits

- `scripts/status.py` enforces the pacing: one unplayed lesson at a time, at most two new lessons a day, a progress review every five sessions or seven days. Do not work around it; if the user asks for more, do it on their explicit request only.
- Publishing (pushing to `main`, which deploys the site) is part of the loop: on 2026-11-21 the owner asked for agents to keep creating lessons on their own. Only lessons that pass every check and all three reviews are published. Answers to the learner's questions are posted as soon as they are checked.

## Starting a loop

In a Claude Code session in this folder:

ask for one round a few times a day; the owner chose this cadence on 2026-11-21. Claude schedules it with CronCreate as `13 8,12,17,21 * * *` (8:13, 12:13, 17:13 and 21:13 local time) and the prompt "Run one round of the Học tiếng Việt lesson loop in this folder: read and follow .claude/skills/lesson-loop/SKILL.md exactly." `/loop 4h /lesson-loop` is a simpler alternative. A round with nothing to do costs one `status.py` call. Questions from Ask wait until the next round, so answers take a few hours.

A scheduled round only runs while a Claude Code session is open and idle in this folder. The job is durable (saved in `.claude/scheduled_tasks.json`, not committed), so it comes back when Claude Code is started here again; check with CronList before creating another.

## Keeping the schedule alive

Scheduled jobs expire after seven days, so the job renews itself. Its prompt says the date it was created and the date to renew it (six days later). When a round runs on or after the renewal date, do this first (load CronCreate, CronList and CronDelete with ToolSearch if they are not available):

1. CronCreate: cron `13 8,12,17,21 * * *`, recurring, durable, with the same prompt but today's date as the created date and today plus six days as the renewal date.
2. CronList, then CronDelete every other lesson-loop job (its prompt starts with "Run one round of the Học tiếng Việt lesson loop").
3. Carry on with the round, and mention the renewal in the reply.

The prompt, with the two dates filled in:

```
Run one round of the Học tiếng Việt lesson loop in /Users/emanuelapple/Desktop/vietwars: read and follow .claude/skills/lesson-loop/SKILL.md exactly (it starts with python3 scripts/status.py --decide). This schedule was created on YYYY-MM-DD; on or after YYYY-MM-DD (six days later), first renew it as the skill's "Keeping the schedule alive" section says. If the decision is answer-questions, answer every open question as that skill describes. If it is next-lesson or review-progress, follow .claude/skills/next-lesson/SKILL.md or .claude/skills/review-progress/SKILL.md. If the decision is wait, reply with one line only.
```

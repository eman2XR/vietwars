---
name: lesson-loop
description: One round of the Học tiếng Việt learning loop - collect new results, review progress when due, and build the next lesson when the learner has played the newest one. Use when the user asks to check for results or keep the lessons coming, and as the prompt of a recurring /loop or scheduled job (for example "/loop 1h /lesson-loop").
---

# Lesson loop

One round, cheap when there is nothing to do. Read `CLAUDE.md` once per session.

## Round

1. `python3 scripts/status.py --decide`
2. Act on the answer, then decide again, until it says `wait` (at most three actions per round):
   - `ingest`: run `python3 scripts/ingest.py`, then decide again.
   - `review-progress`: follow the `review-progress` skill, then decide again.
   - `next-lesson`: follow the `next-lesson` skill. One lesson per round at most.
   - `wait`: nothing to do. Reply with one line, such as "No new results; issue 3 is waiting to be read." Do not repeat the status in detail.
3. If a step fails (no network, `gh` not signed in, a check that keeps failing after two fixes), stop, say what failed in one or two lines, and leave the working tree clean or committed. Never force-push, never delete results or history to get past a limit.

## Limits

- `scripts/status.py` enforces the pacing: one unplayed lesson at a time, at most two new lessons a day, a progress review every five sessions or seven days. Do not work around it; if the user asks for more, do it on their explicit request only.
- Publishing (pushing to `main`, which deploys the site) is part of the loop: on 2026-11-21 the owner asked for agents to keep creating lessons on their own. Only lessons that pass every check and both reviews are published.

## Starting a loop

In a Claude Code session in this folder:

```
/loop 1h /lesson-loop
```

A session loop only runs while that session is open. For a loop that survives restarts, start it again in a new session.

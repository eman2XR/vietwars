# Progress review, 2026-11-27

## Where things stand

- 23 sessions in seven days: 13 issues and 9 reviews (plus one issue closed midway in issue 4). The learner plays every day and keeps the review desk clear.
- 93 words met and 10 on the known list; 66 of the 93 hold up by meaning (0.8 or more), up from 54 of 85 yesterday. About 76 of the phase target of 300, a quarter of the way. Milestones: 75 reached, Tú tài at 100 is about 7 words away.
- First try is rising: 61%, 73%, 81% in issues 11 to 13. Listening after the two-at-a-time change: 15/18 and 15/19 (8/15 before). Real life 4/5 twice. Reviews 70%, 100%, 87%.
- Ratings: difficulty Just right twice (13 not rated), fun OK, OK after Good in issue 11, story Interesting three times running; 5.2 minutes on issue 13's story.

## What is working / what is not

- Working: four concrete words met two at a time, short issues (35 answers, about 10 to 13 minutes), the stories, real life, the new cues after a miss, Ask a question (used for real questions: muốn and về, đi and về, cô for an auntie).
- Not working:
  - **Say questions: 4 of 15 right over issues 9 to 13** (1/3, 1/3, 1/3, 1/3, 0/3). The typed answers show the problem is typing a whole sentence without a Vietnamese keyboard, not knowing it: "nam" for Năm nghìn, "toi di nga" for Mình muốn về nhà, "sin loi doi cha" for Xin lỗi chị, chợ ở đâu ạ?.
  - **Dialogue checks: right in issues 11 and 12, wrong in 8, 9, 10 and 13.** The two that worked asked for the reply the scene itself called for; issue 13's needed an inference (still choosing oranges, so at the market) and failed.
  - Rush hour gave no feedback per answer (the learner: "I don't see whether I am right or wrong").
  - Ask a question: the learner wanted it to greet first, a smaller sheet, and fewer microphone prompts.
  - Fun is stuck at OK outside issue 11.

## Changes made

- **Say questions take word tiles** (`sayTiles` in `web/js/lesson.js`): the words of the model answer plus two tone variants, tapped in order into the same answer box (typing still works; the tone keys appear only when typing). The learner is asked to say the line aloud first. Grading is unchanged; events record `tiles`. To beat: 2 of 3 say questions right.
- **Rush hour shows each answer**: the right option is marked, with "Right" or the word and its meaning, for 0.6 s (right) or 1.3 s (wrong) before the next one.
- **Ask a question** greets first, keeps the microphone for three minutes after a conversation (so it does not ask again right away), and stays at about half the screen with the transcript scrolling inside.
- **docs/PEDAGOGY.md**: dialogue checks ask for the reply the scene states, not one that needs an inference; the load ladder keeps issue 14 at four words (issue 12 was 73%, under the 75% needed twice for +1).

## Suggestions for the learner

- On a say question, say the line out loud before you tap the tiles: the tiles check what you said.
- To stop the microphone prompt for good, allow the microphone for the site in Safari (on the iPhone: the aA button in the address bar, then Website Settings, then Microphone: Allow).

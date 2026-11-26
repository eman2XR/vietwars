# Progress review, 2026-11-26

## Where things stand

- 18 sessions in six days: 11 issues and 6 reviews (plus one issue closed midway in issue 4). The learner plays every day and clears the review desk most days.
- 85 words met, 10 on the known list; 54 of the 85 hold up by meaning (0.8 or more). With the known words that is about 64 of the phase target of 300, a fifth of the way.
- Spaced reviews: 63%, 91%, 69%, 83%, 83%, 80% first try. Retention is steady; the misses are number words (nghìn, triệu, linh, ba), cân and chuối, phải and gần, bao nhiêu.
- Ratings, issues 6 to 11: difficulty Too hard, Too hard, Just right, (none), Too hard, Just right; fun OK, Boring, Boring, OK, Boring, **Good**; story OK five times, then Interesting in issues 9 and 11.
- Conversation checks: wrong in issues 8, 9 and 10, right in issue 11.

## What is working / what is not

- Working: issue 11's recipe (four concrete, picturable words; the frame ... quá!; reaction lines to say; a story with surprises; a dialogue check that follows from the scene), short issues (32 answers, 7.8 active minutes), the say questions, spelling (3/3 in issues 10 and 11), the review desk, and Ask a question (eight conversations so far, most of them feedback the editors acted on: the egg picture, too many extra words, the back button, the blank say screen).
- Not working:
  - **New words are confused with each other right after they are taught**, in every recent issue. Issue 10: 5 of 9 listening answers on new words wrong (chào taken for gặp, biết for chào, gặp for khỏe). Issue 11: nóng and đói taken for đẹp, nóng for rét, đói for nóng in reverse. Cause: the engine met new words four at a time and then asked about them with only those same new words as options, so the first questions tested four fresh meanings against each other.
  - **Small prices are heard ten times too big**: ba nghìn picked as 30.000₫ and sáu nghìn as 60.000₫ in issue 11, and real life was 1/5 there. Earlier issues trained tens (hai mươi, hai lăm), so a bare number before nghìn now sounds like tens.
  - The review desk filled up again right after a review ("seems like a bug"): a review took at most 20 words, and missed words came back after 10 minutes.
  - Ask a question once answered in mixed Vietnamese and English ("Hot tea, 3,000 một glass, sir") when asked to repeat a phrase.

## Changes made

- **New words are met two at a time** (`lessonSteps` in `web/js/lesson.js`): meet two, hear each against words already met and the review words, then the next two. It adds two answers to an issue (issue 11: 32 to 34).
- **A review clears the desk**: it takes every due word, and a missed word comes back the next day instead of after 10 minutes (it is retried within the session anyway). `web/js/srs.js`, `web/js/main.js`.
- **Ask a question stays in English** for explanations, and repeats a phrase slowly, then at normal speed, then gives its meaning (`web/js/talk.js`).
- **docs/PEDAGOGY.md**: a new section keeps issue 11's recipe, records the confusion of new words, and asks every issue for at least one plain nghìn amount under 10.000₫ against its tens, with the rule in the note.
- **Curriculum**: verbs next, as planned, with a note to keep issue 11's recipe (visible actions, a frame like Cháu muốn ...).
- Known list unchanged.

## Suggestions for the learner

- When a seller says a price, count the words before nghìn: one number (ba nghìn) is a few thousand, two (ba mươi nghìn) is tens of thousands.
- Keep using Ask a question: every comment so far changed something on the site.

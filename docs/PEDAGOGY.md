# How lessons are planned

The learner is an English-speaking adult, an upper beginner in **Northern (Hà Nội) Vietnamese**. They know some words and the tones, have no Vietnamese keyboard on the Mac, and use the site on iPhone, iPad and Mac. The goal of the first phase is a **large working vocabulary**; short sentence patterns and conversation come after (`learner/curriculum.json` holds the phases and the planned units, and agents keep it up to date).

Every lesson is planned from data: `learner/SUMMARY.md` (built from the results the site posts), `learner/NOTES.md` (what the learner said outside the app), `web/lessons/known.json` (words the learner already knows) and the last entries of `docs/LESSON_LOG.md`.

## What the learner told us so far

- Lessons must be **fun and unexpected**; the site is called Viet Wars, so every lesson is a battle against a villain.
- Do not show words they already know. The known list is never taught, reviewed or drilled again.
- Spelling slips are not the same as not knowing a word. Judge **meaning** and **spelling** separately.
- More pictures and visuals.

## How a lesson plays (the engine does this; a lesson only supplies content)

1. **The foe**: a villain is introduced with a taunt. Right answers hit it (three in a row land a critical hit), wrong answers cost one of five hearts (lose all five and it heals a little). Random **ambushes** (seven-second questions) and **power-ups** (a known food word that restores a heart) appear after correct answers.
2. **Warm-up** (optional `warmup`): a quick listening check of words the learner probably knows. Only misses go into the review deck. Use it for basics you would otherwise re-teach (numbers 0 to 10, everyday greetings).
3. **Meet the words in groups of four**: picture, word in tone colours, tone contour, gloss, memory hook, Hà Nội pronunciation tip, audio (normal and slow). The learner says it aloud. "I know it" skips the word's drills; one typed check confirms it, and a confirmed word never enters the review deck.
4. Quick check after each group, then: **listen and pick the meaning**; **pick the spelling heard** among `contrast` words, or pick the Vietnamese for a picture and gloss; **type it from memory** with on-screen tone and vowel keys (Telex works too). Missed items come back three or four steps later.
5. **One grammar rule**, then **combos** (phrases from known words), then the **boss round**: 45 seconds of listening; streaks hit harder; win it to defeat the foe.
6. Results (rank S, A, B or C), then feedback: difficulty, fun, hardest words, what to learn next, a note.
7. Afterwards each word enters a **Leitner spaced-repetition deck** (0, 1, 3, 7, 14, 30, 60, 120 days). Reviews are a battle against Ma Quên, the Ghost of Forgetting.

## Rules for a new lesson

**Size and difficulty**
- 12 to 14 new words by default. Judge difficulty on **meaning** (listen and reverse), not on spelling: if meaning accuracy was above 85% and the learner said "Too easy", go up to 16 and make the combos harder. Below 60% or "Too hard": 8 to 10 new words and more review.
- Put 3 to 8 earlier words in `review`, chosen by **meaning weakness** first (`weakMeaning`), then words the learner marked hardest, then meaning confusions. Drill **spelling weakness** (`weakSpelling`) through the new words' contrasts instead of re-teaching.
- Never put a known-list word in `words` or `review` (the checker enforces this). Known words may appear in combos, foe lines and warm-ups.
- If the learner is likely to know a basic set already, make it a `warmup` instead of new words.

**Choosing words**
- Follow the learner's `wantNext` when it is reasonable; otherwise take the next planned unit in `learner/curriculum.json`.
- Prefer high-frequency, concrete words that combine with what is already known. Every new word should be usable in at least one combo.
- **Never teach together as new**: pairs that differ by one mark (nữa and nửa), near-synonyms (mươi and chục) or two words with the same gloss. Teach one; use the other as its contrast.
- Northern words only: bát not chén or tô, lợn not heo, quả not trái, hoa not bông, cốc not ly, thìa not muỗng, mẹ and bố not má and ba, vâng for a polite yes, đắt not mắc, ngô not bắp, lạc not đậu phộng, mũ not nón, nghìn not ngàn, linh not lẻ in 105, tắc đường not kẹt xe, muộn not trễ, ốm not bệnh. `scripts/check_lessons.py` warns about common Southern words.
- Glosses: short, the most common Northern meaning first. Two words in a lesson (warm-up and combos included) must not share or nearly share a gloss.

**Memory hooks** (keyword method)
- One Vietnamese sound-alike plus one concrete, vivid, slightly absurd image. Tie the tone shape in: ngang calm and level; huyền a sigh or settling down; sắc calling out; hỏi a doubtful question; ngã a voice cracking then jumping; nặng a heavy thud or sudden stop.
- Never teach a wrong sound: no wrong vowel length, extra syllable, English cluster (tr, gr) or wrong tone direction. Read each hook aloud the way an English speaker would and check what comes out.
- Keep images distinct within a lesson (lesson 1's seagull for cá and hen for gà were both birds, and the learner mixed them up).
- Reviews show the `note`, not the hook, so give a weak word a short `note` that anchors the meaning (for example "c as in carp: cá is fish").

**Pronunciation tips**
- Hà Nội speech: r, d and gi all sound like z; tr and ch are the same (no puff of air); s and x are the same; final c, t and p are not released; after u and ô, final c and ng close with the lips; ph is f; ng and ngh are the ng of "sing"; nh is the ny of "canyon"; anh sounds close to "ain" with a soft ng.
- Describe tones by shape and feel.

**Contrast words** ("which spelling did you hear?")
- Real, reasonably common words, same letters as the target, different tone or vowel mark (bún and bùn, rau and râu, rẻ and rẽ, hơn and hôn).
- They must sound different in Hà Nội: never contrast only r/d/gi, tr/ch or s/x.
- **Avoid hỏi against huyền** for now. In Hà Nội, hỏi starts at about normal pitch and drops further and faster than huyền, sometimes with a creak, and lifts a little only when said alone; huyền starts a little lower, falls gently, is often breathy and never rises. The Linh voice gives both the same start and slope, so its clips barely differ (this is probably why the learner picked phờ for phở). Hỏi against ngã is fine. Describe hỏi as a drop in tips and hooks, not as an English question rise (that is the Southern hỏi).
- One to three per word, each with a gloss.

**Pictures**
- Every new word gets a `picture`. Kinds are in `web/js/pictures.js` (icons for things, diagrams for quantities: dots, blocks, big, notes, coin, tag, question, digits, halves, plus, half, compare). If no kind fits, add a drawing there (original SVG, coloured with the style classes, readable at 40 px) rather than leaving a word without one.

**The foe**
- Each lesson has an original villain tied to the theme and to everyday Hà Nội life (a nosy neighbour, a traffic jam, Lady Drizzle). No characters, names or lines from films, games or other works.
- Write the foe's taunts and its win and lose lines **only with words the learner knows or is learning in this lesson**, so the lines are comprehensible practice. Two or three taunts.
- Art: name one of the drawings in `web/js/sprites.js`. A new villain usually deserves a new drawing; add it there (original SVG, 100 by 100, recognisable at 40 px).

**Combos and grammar**
- At least four combos from this lesson's and earlier words (warm-up and known words count). Make them useful and a little surprising (real prices, real orders, a trap like hai mươi năm, twenty years, against hai mươi lăm, 25). A combo with a new syllable needs a `note`.
- One grammar rule per lesson, tied to the combos, in two or three short sentences.

**Feedback**
- Low fun: more surprising combos and foe lines, a theme from `wantNext`, new art.
- Typing: many "marks" or "tone" grades are a spelling issue, not a meaning issue. "sound" grades (cha for trà) mean the learner hears correctly. Watch the share of answers typed with the tone keys.
- Repeated tone confusions: choose contrasts that practise that pair (except hỏi against huyền, see above).
- Record every decision and the data behind it in `docs/LESSON_LOG.md`, and update `learner/curriculum.json` (unit status, notes, reordering).

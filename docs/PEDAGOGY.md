# How lessons are planned

The learner is an English-speaking adult, an upper beginner in **Northern (Hà Nội) Vietnamese**. They know some words and the tones, have no Vietnamese keyboard on the Mac, and use the site on iPhone, iPad and Mac. The goal of the first phase is a **large working vocabulary**; short sentence patterns and conversation come after (`learner/curriculum.json` holds the phases and the planned units, and agents keep it up to date).

Every lesson is planned from data: `learner/SUMMARY.md` (built from the results the site posts), `learner/NOTES.md` (what the learner said outside the app), `web/lessons/known.json` (words the learner already knows) and the last entries of `docs/LESSON_LOG.md`.

## What the learner told us so far

- Lessons must be **fun and unexpected**, but **grown-up**: cartoon villains looked like something made for a child, so the site became a small culture magazine. Cartoons and illustrations are welcome **only in context** (a phở stall for a food issue, Đồng Xuân market for money), never random animals or mascots.
- They want **interesting things about Vietnamese history and culture** in every lesson, with images.
- Do not show words they already know. The known list is never taught, reviewed or drilled again.
- Spelling slips are not the same as not knowing a word. Judge **meaning** and **spelling** separately.

## How an issue plays (the engine does this; a lesson file only supplies content)

1. **The article** (`feature`): a cover illustration, a kicker, a headline, a standfirst (`dek`), two to five short paragraphs with a drop cap, one pull quote and its sources. The reading time is recorded.
2. **The quiz** (`quiz`): two to six trivia questions on the article, each with a one-line explanation after the answer. Not scored as vocabulary.
3. **Warm-up** (optional `warmup`): a quick listening check of words the learner probably knows; only misses go into the review deck.
4. **Meet the words in groups of four**: picture, word in tone colours, tone contour, gloss, memory hook, Hà Nội pronunciation tip, a **did-you-know** `fact`, audio. "I know it" skips a word's drills after one typed check.
5. Drills: listen and pick the meaning; pick the spelling heard among `contrast` words, or the Vietnamese for a picture; type from memory with the on-screen tone and vowel keys. Missed items come back three or four steps later. **Every three right answers in a row, a fact card appears** (facts about words already met, and the pull quote).
6. **Grammar note**, then **in context** (combos), then **Giờ cao điểm** (rush hour): 45 seconds of listening, streaks score up to five times.
7. Results: first-try accuracy, best streak, quiz and rush hour scores, a **stamp** for the passport (graded complete, merit or distinction), and the **challenge**: one real thing to try in Hà Nội. Then feedback, including a rating of the article.
8. Afterwards each word enters a **Leitner spaced-repetition deck** (0, 1, 3, 7, 14, 30, 60, 120 days), reviewed from the home screen.

## Writing an issue

**The article**
- One true, specific, surprising story tied to the theme and the words: history, food, language, customs, places in Hà Nội. Prefer stories with a hook ("younger than the Eiffel Tower", "a currency named after a metal nobody carries").
- 150 to 350 words in two to five paragraphs, plain and lively English, Vietnamese words in their proper spelling. One pull quote: the most surprising sentence.
- Every claim must come from a reliable source listed in `feature.sources` (English or Vietnamese Wikipedia is fine; both are reachable from this sandbox with curl). Say "is said to", "is thought to" or "possibly" when the source does; never present a legend as fact. Check for recent changes (for example the 2025 merger of provinces).
- Respectful and adult. Mainstream history (the Hùng kings and legends, Hai Bà Trưng, Ngô Quyền, the Lý capital at Thăng Long, Trần Hưng Đạo, Lê Lợi and Hoàn Kiếm Lake, Quang Trung, the alphabet) and everyday culture are good ground. Avoid present-day politics, avoid glib lines about hardship, and do not treat the 20th-century wars lightly.
- **Did-you-know facts** on most words: one or two sentences, true, specific, and preferably tied to Hà Nội or the Northern dialect (for example tiền mừng tuổi in the North against lì xì in the South).
- **Quiz**: answerable from the article, with one clearly right option and plausible, clearly wrong distractors; each with an `explain` line that adds something.
- **Challenge**: one concrete, polite thing to do or say, with the Vietnamese spelled out and glossed.
- **Cover and stamp**: an illustration in context, from `web/js/pictures.js` (scenes for covers, icons and diagrams for stamps). A new theme usually deserves a new scene: draw it there as original SVG in the same flat style (style colour classes, 400 by 250, readable at 112 px wide, checked in the dark styles too).
- **Photos**: Wikimedia Commons is blocked from this sandbox at the moment. If it becomes reachable, use only freely licensed images, resize them with `sips -Z 1200`, store them in `web/images/` and record title, author, licence and source URL in `web/images/credits.json`, shown as a caption.
- Every issue gets three reviews before it ships: Vietnamese accuracy, learning design, and a history and culture fact-check against the sources.

## Rules for a new lesson

**Size and difficulty**
- 12 to 14 new words by default. Judge difficulty on **meaning** (listen and reverse), not on spelling: if meaning accuracy was above 85% and the learner said "Too easy", go up to 16 and make the combos harder. Below 60% or "Too hard": 8 to 10 new words and more review.
- Put 3 to 8 earlier words in `review`, chosen by **meaning weakness** first (`weakMeaning`), then words the learner marked hardest, then meaning confusions. Drill **spelling weakness** (`weakSpelling`) through the new words' contrasts instead of re-teaching.
- Never put a known-list word in `words` or `review` (the checker enforces this). Known words may appear in combos, facts, the article and warm-ups.
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
- Every new word gets a `picture`. Kinds are in `web/js/pictures.js` (icons for things, diagrams for quantities: dots, blocks, big, notes, coin, tag, question, digits, halves, plus, half, compare). If no kind fits, add a drawing there (original SVG, coloured with the style classes, readable at 40 px) rather than leaving a word without one. Drawings must belong to the word or the story; no random animals or mascots.

**Combos and grammar**
- At least four combos from this lesson's and earlier words (warm-up and known words count). Make them useful and a little surprising (real prices, real orders, a trap like hai mươi năm, twenty years, against hai mươi lăm, 25). A combo with a new syllable needs a `note`.
- One grammar rule per lesson, tied to the combos, in two or three short sentences.

**Feedback**
- Low fun: more surprising stories, facts and quiz questions, a theme from `wantNext`, a new cover scene. A low article rating, or a reading time of a few seconds: shorter, punchier articles.
- Typing: many "marks" or "tone" grades are a spelling issue, not a meaning issue. "sound" grades (cha for trà) mean the learner hears correctly. Watch the share of answers typed with the tone keys.
- Repeated tone confusions: choose contrasts that practise that pair (except hỏi against huyền, see above).
- Record every decision and the data behind it in `docs/LESSON_LOG.md`, and update `learner/curriculum.json` (unit status, notes, reordering).

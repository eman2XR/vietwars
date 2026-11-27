# How lessons are planned

The learner is an English-speaking adult, an upper beginner in **Northern (Hà Nội) Vietnamese**. They know some words and the tones, have no Vietnamese keyboard on the Mac, and use the site on iPhone, iPad and Mac. The goal of the first phase is a **large working vocabulary**; short sentence patterns and conversation come after (`learner/curriculum.json` holds the phases and the planned units, and agents keep it up to date).

Every lesson is planned from data: `learner/SUMMARY.md` (built from the results the site posts), `learner/NOTES.md` (what the learner said outside the app), `web/lessons/known.json` (words the learner already knows) and the last entries of `docs/LESSON_LOG.md`.

## What the learner told us so far

- **Fun but grown-up**: a small culture magazine, not a children's game. Cartoons and illustrations only **in context** (a phở stall, a market, the legend being told), never random animals or mascots.
- **History and culture in every issue**, told as a **short intro and then story beats through the lesson**, so it feels integrated. **No quizzes about the article.**
- **More and better hints and memory hooks.** **Less focus on tones.** **More real-life use**: a waiter says a price and the learner understands it.
- They needed the basics (1 to 10) taught properly: do not assume basics are known just because they are common; test them in a warm-up and teach them if missed.
- Never show words on the known list. Judge **meaning** and **spelling** separately.
- Sessions must be finishable: under 20 to 25 minutes, and they can stop and resume.

## How an issue plays (the engine does this; a lesson file only supplies content)

1. **The opening**: cover illustration, kicker, headline, standfirst (`dek`) and a two- or three-sentence `intro`. Reading time is recorded.
2. **Warm-up** (optional `warmup`): a quick listening check of words the learner probably knows; misses go into the review deck.
3. **Parts**: more than 8 new words are split into two parts. In each part: meet the words in groups of four (picture, word in tone colours, tone line, gloss, memory hook, Hà Nội tip, did-you-know `fact`, audio, "I know it"), a quick check after each group, then practice: listen and pick the meaning, at most three "which spelling did you hear" questions (others are picture questions), and typing from memory.
4. **Story beats** (`feature.beats`) always play in file order. A beat tied to a word waits until the group with that word has been met; an untied beat waits for the next part, practise or real-life screen; whatever is left goes on the results page. `node scripts/plan.mjs` shows where each beat lands.
5. **Typing** is lenient by default: right letters count as right and the marks are shown (Settings can make it strict). Hints come in three levels: the memory hook, the consonants, then the answer. A wrong typed word comes back once as syllable tiles.
6. **Grammar note** (the issue's sentence frame), then **in context** (combos), then **Conversation** (`dialogues`: a short exchange, each line playable, English hidden until asked, ending with what you would say), then **Real life** (`situations`: a seller, waiter or driver says a line; the learner picks the price, types it in digits (a hint splits the line at nghìn; 25k counts as 25000), or picks what to say back, which is then played), then **Giờ cao điểm** (rush hour, 45 seconds).
7. **Results**: first-try accuracy, best streak, real-life and rush hour scores, a **stamp** (complete, merit, distinction), the last story beat, the **challenge** and the sources. Then feedback, including a rating of the story.
8. The learner can close the issue at any point and resume it later. Words then enter the spaced-repetition deck (0, 1, 3, 7, 14, 30, 60, 120 days).

## Conversation: the goal

The learner's goal (2026-11-22): basic conversation at a dinner table and understanding basic street talk. Vocabulary keeps growing, but from issue 6 every issue also teaches talk, using methods with good evidence behind them:

- **Chunks first** (the lexical approach): whole phrases taught as units (Cháu no rồi ạ, Bao nhiêu tiền?) before they are taken apart. Most everyday talk is made of ready-made phrases.
- **Comprehensible input**: dialogues use almost only known words, plus at most two new ones glossed in a note; listening comes first (the English stays hidden until asked or answered).
- **One sentence frame per issue**, a pattern with a slot (Mời ... ăn cơm, ... nữa không?, Tôi muốn ..., ... ở đâu?, Có ... không?, Cho tôi ...). It is the grammar note, with two examples, and it is used in the issue's dialogue and real-life lines.
- **One short dialogue per issue** (`dialogues`, 2 to 6 lines, `setting` table or street), alternating issue by issue between a meal with a family or friends (invitations, offering more, food talk, toasts) and the street (market, café, xe ôm and taxi, asking the way, neighbours). It ends with a check: pick what you would say next, so the learner produces a reply, not only recognises one (retrieval practice).
- **Spaced and interleaved**: a frame comes back in later issues on an expanding schedule (the next issue, about three issues later, about seven issues later), mixed into other dialogues and real-life lines rather than drilled alone, the way the review desk spaces words. Record in the lesson log which frames each issue brings back.
- **Shadowing**: every line has its own play button, and the Conversation screen asks the learner to say each line after the voice; challenges can ask for it at a real table or stall.
- **A real task in every challenge**, using the issue's frame.
- **A consolidation issue every five or six issues** (with the progress review): few new words and a longer dialogue (up to 8 lines) that recombines the recent frames.

## Lessons from issues 6 and 7

- Both were rated "Too hard" (88% and 72% first try) and issue 7 "Boring": most misses were new short words mistaken for each other by meaning (gần, bớt, đắt, phải, rẽ in one issue), and nine minutes of drills. Do not teach more than two short one-syllable words with similar sounds or uses in one issue, give each a picture that could not belong to another, and keep drills short (about 35 answers when the words are new and abstract).
- The learner asked for the story to be tied to the lesson: "Would be nice if the article was tied in better with the content of the lesson." Each beat should use or explain the word or price form it follows, not only share a theme; a story about a place (a bridge, a temple) must still show the issue's words at work there.
- When the learner asks how something works ("when to use lăm or rưỡi or năm"), answer it with a short clinic issue: few new words, the rule set out plainly once, and practice that tests that rule only.

## Fun, and the learner doing the talking (review of 2026-11-24)

- Fun went Good, Good, Good (issues 3 to 5), then OK, Boring, Boring (6 to 8), while difficulty settled. Drills became 40 to 55% of active time and every issue had the same shape. Treat fun as an outcome to improve: each issue brings **one thing to play that recent issues did not have** (a haggle with a running tally, a seller who answers back, a twist in the story), and the plan says what it is. After issue 1 the learner asked for "fun and unexpected (hint: the website name is Viet wars)": friendly contests (haggling, a race, a duel of prices) fit; violence does not.
- **The learner says things, not only understands them.** Every issue has two or three `say` questions in real life (production: type how a price or a line is said; docs/LESSON_FORMAT.md), with the seller's `reply` where it makes a small scene. The learner asked: "what the lessons are missing is asking me to say a price? eg how do you say 25, 150".
- **Count every extra word, not only the new ones** (learner, 2026-11-25, on issue 9: "there's just a lot of new words in here"). Issue 9 taught four words but its dialogue and real-life lines added about ten more glossed in notes (về, đấy, có ... không, xoài, nải, mấy, lên xe, thịt gà, bạc thật). Keep an issue's dialogue and real-life lines to known words plus at most three extras in total, and reuse the same extras rather than adding new ones.
- A form missed in three issues by recognition (here "X mươi, một [unit]") is next taught by production: the learner says it.

## What issue 11 got right (review of 2026-11-26)

- Issue 11 was the first "Just right", fun "Good" and story "Interesting" together (after Boring, OK, Boring), at 7.8 active minutes. Its recipe, to keep: **four concrete words you can picture**, of different kinds (hot, cold, beautiful, hungry), **one short frame the learner can shout** (... quá!), **reaction lines to say** (So hot! How beautiful!), a story with real surprises (snow on Ba Vì), and a **dialogue check whose answer follows from the scene** (the first right one in four issues). Issue 10, five abstract social words with no picture of their own (chào, biết, khỏe, xin lỗi, gặp), was "Too hard" and "Boring".
- **New words are confused with each other right after they are taught**, in every recent issue (issue 10: chào taken for gặp, biết for chào; issue 11: nóng and đói taken for đẹp). The engine now meets new words two at a time and asks each against words already met, not against new words still to come. Still avoid teaching words that share a first sound and a tone class together when another choice fits (đói, đẹp).
- **Small prices are heard ten times too big** (issue 11: ba nghìn picked as 30.000₫, sáu nghìn as 60.000₫; the review desk keeps missing nghìn and triệu). Every issue's price lines include at least one plain nghìn amount under 10.000₫ against its tens (3.000 against 30.000), and the note says the rule: a single number before nghìn is that many thousand.

## Variety: a different thing to play in every issue (review of 2026-11-27)

Fun was "Good" in issues 3 to 5, 9 (the haggle) and 11 (... quá! reactions), and "OK" or "Boring" whenever an issue had the same shape as the one before. So every issue has one **headline format**, named in the plan and the log, that none of the three issues before it used. Formats so far and ideas (build the engine part the first time a format is used, as the say questions were in issue 9):

| Format | What the learner does | Used |
| --- | --- | --- |
| Haggle | says counter-offers; the seller answers back; a tally of đồng saved | 9 |
| Reactions | says short exclamations in scenes (So hot! How beautiful!) | 11, 12 |
| Ask the way | asks, hears the answer, then picks the way | 13 |
| Order chain | orders in three turns at one stall or café (order, answer a question, pay the total); one scene, the seller replies each time | |
| Phone call | hears a call from Bà or a friend with no picture cues, answers two questions about it | |
| Read the board | reads a menu board, a price list or a street sign drawn in the inked style, and picks or works something out (what can you afford, which is cheapest) | |
| Overheard | hears two locals talk (a short exchange between others) and answers who, what or how much | |
| Map walk | follows spoken directions on a small drawn map and taps where they end up | |
| Match rush | a rush-hour variant: match pictures to words heard, against the clock | |
| Two endings | the dialogue branches on the learner's choice, each with its own reply | |

**Rhythm.** Alternate table and street (Conversation, above). Vary the kind of story (history or legend, food, a place, language, people, a craft). And every fifth issue is a **clinic** (issue 8 was one, "Just right"): no new topic, its words are the learner's leeches and mix-ups (the review desk's confusions and the struggle table), taught with new hooks, `remember` cues and pictures, in a format that has not been used recently.

## Adapting between issues (automatic)

- The review desk now adapts by itself: it adds **mix-ups** (pairs the learner has taken for each other, from the answers so far, shown side by side and then told apart by ear; practice, not scored) and **real life again** (up to three real-life lines from issues already played, the ones missed first, never one from the last review). Planning can rely on this for old real-life lines and leave room in new issues for new ones.
- **Milestones** (`web/milestones.json`): every 25 to 50 words a rank from the old imperial exams, a sourced fact and a saying with the learner's known words underlined. Add milestones above 1,000 the same way when the learner gets close; each needs the Vietnamese and fact reviews.

## Using the data

`learner/SUMMARY.md` has a **Where the learner struggles** table (struggle score from failed first tries, slow answers, hints, replays and revealed answers), accuracy and speed by **exercise type**, time per phase, long pauses, unfinished attempts, tone and meaning confusions, and every feedback note. Plan from it: review the highest-struggle words, give them new hooks or pictures, and lean on the exercise types that work (listening and real life) when another type is failing.

## Writing an issue

**The story**
- One true, specific, surprising story tied to the theme: history, legend, food, language, customs, places in Hà Nội. A two- or three-sentence `intro` that sets it up, then three to six `beats` of one to three sentences each. Tie at least two beats to words (`"word": "chín"`) so each appears right after that word is taught. Plan the beats in the order the engine plays them, spread through the whole issue: run `node scripts/plan.mjs lesson-NN` and move or untie a beat that lands next to another (the checker warns when two play back to back). A beat tied to a word late in the lesson holds back every beat after it.
- Every claim comes from a reliable source listed in `feature.sources` (English or Vietnamese Wikipedia, reachable from this sandbox with curl). Say "is said to", "is thought to" or "legend says" when the source does. Check for recent changes (for example the 2025 merger of provinces).
- Respectful and adult. Avoid present-day politics, glib lines about hardship, and treating the 20th-century wars lightly.
- **No pop-up facts**: the learner found the did-you-know cards that popped up during drills annoying (2026-11-22), so the engine no longer shows them. Facts appear only in the did-you-know box on a word's card; write them only where a fact is genuinely surprising. Give story beats and real-life lines a `picture` instead: the learner asked for more illustrations.
- **Did-you-know facts**, where used, on words: one or two sentences, true, specific, preferably about Hà Nội or the Northern dialect, and not repeating a beat.
- **Real life**: five to eight `situations` with everyday Hà Nội lines a learner will actually hear, using this issue's and earlier words. Mix picking from options and typing digits, and make about a third reactions or orders, not prices (a tourist price: Đắt quá!). Distractors should sound like the answer (19 against 90, 30 against 300, 15 against 50) or repeat the learner's own mix-ups from the warm-up and confusion lists. Never put the answer in `placeholder`.
- **Every new and review word** appears at least once in a situation, a combo or a beat, so it is heard in use, not only drilled.
- **Prices by ear are the weakest skill** (60% right at about 27 seconds an answer, review of 2026-11-22), and the learner asked for them: every issue has at least five price lines, and once the spoken forms are taught (dropped nghìn, shortened hundreds), use them the way Hà Nội sellers say them, each form confirmed by the Vietnamese reviewer.
- **Challenge**: one concrete, polite thing to do or say, with the Vietnamese spelled out and glossed.
- **Scenes for moments**: the learner asked for "more illustrations of market scenes and scenarios" (2026-11-24). Each issue should add at least two new small scenes for its real-life lines or story beats (a seller at her stall, weighing fruit, handing over change, a driver waiting at a corner), drawn as icons in the inked style, rather than reusing a single object such as a bowl or a price tag.
- **Cover and stamp**: an illustration of the story or the theme, from `web/js/pictures.js`. A new story usually deserves a new scene. Every picture uses the same three layers: a flat colour field (`warm` for food and people, `cool` for water and sky, `earth` for bread, coffee, money and counting, `leaf` for plants and tea), an irregular paper cut-out behind the subject (`blob()`), and bold ink lines with rounded ends that get a slight dip-pen tremor (the drawing goes in `ink`; dots, numbers and labels go in `crisp` so they stay sharp). One subject per picture, flat (no gradients or shadows), simple naive shapes, a margin of field around the subject; ink may cross the edge of the paper. Covers are 400 by 250, are cropped to fill wider frames (keep the subject in the middle 300), and are shown up to 800 px wide on a Mac, so they need fine lines and real detail: main lines about 2.2 units, details 1.2 to 1.6, shading by pen hatching (`hatch()`), distance by a pale shape behind (`back`), flat shadows on the paper (`under`), and patterns where a big area would look empty (`scales()` for water, as in woodblock prints). Look at them large with `scripts/picture_sheet.py --covers`; the learner judged the first, crude version on a Mac. Check new art in every style with `scripts/picture_sheet.py` (it draws every picture in every style, dark ones included) before running `check_site.py`.
- **Photos**: Wikimedia Commons is blocked from this sandbox at the moment. If it becomes reachable, use only freely licensed images, resize them with `sips -Z 1200`, store them in `web/images/` and record title, author, licence and source URL in `web/images/credits.json`, shown as a caption.
- Every issue gets three reviews before it ships: Vietnamese accuracy, learning design, and a history and culture fact-check.

## Rules for a new lesson

**Size and difficulty**
- **New words follow a ladder, set from the last two issues** (review of 2026-11-27; issues 10 to 13 showed four concrete words at about 35 answers is "Just right", while five abstract ones were "Too hard"). Start from the last issue's count and move one step: **+1** after two issues in a row with first-try accuracy of 75% or more, meaning (listen and reverse) of 80% or more, and no "Too hard"; **-1** after "Too hard", an unfinished issue, first-try accuracy under 65%, or a session over 20 active minutes; otherwise keep it. Range 3 to 7 (issues over 8 are split into two parts automatically). Abstract words (greetings, question words, feelings without a picture) count as one and a half. Write the step and its reason in the plan. Judge difficulty on **meaning** and the struggle data, not on spelling.
- **Limit an issue by answers, not words**: about 45 first-try answers before rush hour (issue 4, at 58, felt "a bit too long"). `node scripts/plan.mjs` counts them; the checker warns above 50. Review words all land in the last part (each adds a listening and a typing question there), so many review words make that part long.
- Review words are heard and used in an issue (listening, real life, combos) but not typed: typing them from memory is the spaced reviews' job, and in issue 4 typing the same number words again failed every time without improving.
- Put 3 to 8 earlier words in `review`, chosen by the **struggle score** and **meaning weakness** first, then words the learner marked hardest, then meaning confusions. Judge typing on the lenient grades: a `wrong` typed answer (another word came out, such as tram for nghìn) is a recall failure worth reviewing; tone and mark slips are not. Do not drill spelling weakness hard: the learner asked for less focus on tones. Words the review desk already schedules can wait for a better-fitting issue (triệu and rưỡi suit telling the time).
- Never put a known-list word in `words` or `review` (the checker enforces this). Known words may appear in combos, facts, the article and warm-ups.
- If the learner is likely to know a basic set already, make it a `warmup` instead of new words.

**Choosing words**
- Follow the learner's `wantNext` when it is reasonable; otherwise take the next planned unit in `learner/curriculum.json`.
- Prefer high-frequency, concrete words that combine with what is already known. Every new word should be usable in at least one combo.
- **Never teach together as new**: pairs that differ by one mark (nữa and nửa), near-synonyms (mươi and chục) or two words with the same gloss. Teach one; use the other as its contrast.
- Northern words only: bát not chén or tô, lợn not heo, quả not trái, hoa not bông, cốc not ly, thìa not muỗng, mẹ and bố not má and ba, vâng for a polite yes, đắt not mắc, ngô not bắp, lạc not đậu phộng, mũ not nón, nghìn not ngàn, linh not lẻ in 105, tắc đường not kẹt xe, muộn not trễ, ốm not bệnh. `scripts/check_lessons.py` warns about common Southern words.
- Glosses: short, the most common Northern meaning first. Two words in a lesson (warm-up and combos included) must not share or nearly share a gloss.

**Memory hooks** (keyword method)
- One real English sound-alike with a single common pronunciation ("bone" for bốn, "numb" for năm), plus one concrete, vivid image that carries the meaning (fingers numb with cold for five). Tie the tone shape in with at most one word: ngang calm and level; huyền a sigh or settling down; sắc calling out; hỏi a sharp drop (not a question rise); ngã a voice cracking then jumping; nặng a heavy thud or sudden stop.
- No two hooks in an issue share an image category or a pattern (two animals, two birds, two "say X without Y"); the tone cue (calling out for sắc) may repeat. Avoid baby talk, and leave mouth shape to the tip.
- Never teach a wrong sound: no wrong vowel length, extra syllable, English cluster (tr, gr) or wrong tone direction. Read each hook aloud the way an English speaker would and check what comes out.
- Keep images distinct within a lesson (lesson 1's seagull for cá and hen for gà were both birds, and the learner mixed them up).
- Reviews show the `note`, not the hook, so give a weak word a short `note` that anchors the meaning (for example "c as in carp: cá is fish").

**Pronunciation tips**
- Hà Nội speech: r, d and gi all sound like z; tr and ch are the same (no puff of air); s and x are the same; final c, t and p are not released; after u and ô, final c and ng close with the lips; ph is f; ng and ngh are the ng of "sing"; nh is the ny of "canyon"; anh is a short, open a (as in "cat") gliding towards ee, with a soft ng: not the vowel of "cane", which is nearer ê.
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
- Low fun: more surprising stories, facts and real-life moments, a theme from `wantNext`, a new cover scene. A low story rating, or story beats read in a few seconds: shorter, punchier beats.
- Typing: many "marks" or "tone" grades are a spelling issue, not a meaning issue. "sound" grades (cha for trà) mean the learner hears correctly. Watch the share of answers typed with the tone keys.
- Repeated tone confusions: choose contrasts that practise that pair (except hỏi against huyền, see above).
- Record every decision and the data behind it in `docs/LESSON_LOG.md`, and update `learner/curriculum.json` (unit status, notes, reordering).

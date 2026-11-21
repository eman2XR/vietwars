# How lessons are planned

The learner is an English-speaking adult, an upper beginner in **Northern (Hà Nội) Vietnamese**. They know some words and the tones exist, but not much more. The goal of this first phase is a **large working vocabulary**; sentences and conversation come after (see the roadmap below). Lessons should be fun and memorable, and every one is planned from the learner's saved results and feedback (`learner/SUMMARY.md`).

## Techniques the app already uses

The engine (`web/js/lesson.js`) builds the exercises from the lesson file, so a lesson only supplies content. Its sequence:

1. **Meet the words in groups of four** (chunking), each with audio, its tone colour and contour, a memory hook and a pronunciation tip. The learner says the word aloud (production), and can mark a word as already known.
2. **A quick check after each group** (retrieval right after first exposure).
3. **Listen and pick the meaning** (comprehension first, audio before text).
4. **Pick the spelling you heard** among `contrast` words (tone and vowel minimal pairs), or pick the Vietnamese for a meaning.
5. **Type it from memory** (recall, the hardest and most effective step). Graded per syllable: perfect, wrong tone, missing marks, wrong. Telex typing is accepted.
6. **One small grammar rule**, then **combos**: phrases built from known words (generative vocabulary).
7. **A 45-second speed round** with streak multipliers (fluency, fun).
8. Missed items come back about three steps later (expanding retrieval inside the lesson).
9. After the lesson every word enters a **Leitner spaced-repetition deck** (intervals 0, 1, 3, 7, 14, 30, 60, 120 days), placed by how well it went. Reviews run from the home screen.

Tones are colour-coded everywhere: ngang grey, huyền blue, sắc red, hỏi purple, ngã amber, nặng teal.

## Rules for a new lesson

**Size and difficulty**
- 10 to 12 new words by default. If the last lesson's first-try accuracy was above 85% and felt "Too easy", go up to 14. Below 60% or "Too hard": 8 new words and more review.
- Put 4 to 8 earlier words in `review`: the weakest by `strength`, words in recent confusions, and words the learner listed as hardest. Never re-teach an earlier word as new.
- Skip words similar to ones the learner marked "I know it" (`knewIt`) if they did well on them.

**Choosing words**
- Follow the learner's `wantNext` feedback when it is reasonable; otherwise take the next roadmap theme.
- Prefer high-frequency, concrete, useful words that combine with what is already known.
- Northern words only. Use Hà Nội vocabulary (bát not chén or tô, lợn not heo, quả not trái, hoa not bông, cốc not ly, thìa not muỗng, mẹ and bố not má and ba, vâng for a polite yes, đắt not mắc, ngô not bắp, lạc not đậu phộng, mũ not nón). `scripts/check_lessons.py` warns about common Southern words.
- Glosses: short, the most common Northern meaning first; add a second meaning only if the learner will meet it soon. Two words in a lesson must not share a gloss.

**Memory hooks** (keyword method)
- Concrete, vivid, a little absurd, one image. Link the sound to an English sound-alike and the meaning to an image.
- Tie the tone shape into the hook where possible: ngang is calm and level; huyền is a sigh or settling down; sắc is calling out or surprise; hỏi is a doubtful question; ngã is a voice cracking and jumping up; nặng is a heavy thud or a sudden stop.
- A hook must not teach a wrong sound or tone. Sound-alikes are loose, but never suggest the wrong vowel length, the wrong number of syllables or the wrong tone direction.

**Pronunciation tips**
- Hà Nội speech: r, d and gi all sound like z; tr and ch are the same (unaspirated, like ch in "chip" with no puff of air); s and x are the same; final c, t and p are not released; ph is f; ng and ngh are the ng in "sing"; nh is like the ny in "canyon"; anh sounds close to "ain" with a soft ng.
- Describe tones by shape and feel, not by musical notes.

**Contrast words** (for "which spelling did you hear?")
- Real, reasonably common words, same letters as the target, different tone or vowel mark (bún and bùn, rau and râu, phở and phố).
- They must sound different in Hà Nội. Never contrast only r/d/gi, tr/ch or s/x: in Hà Nội these sound the same.
- One to three per word; give a gloss for each. Words without a good contrast get a "which one means this?" question instead.

**Combos and grammar**
- At least four combos, made from this lesson's and earlier words. A combo that adds a new syllable needs a `note` explaining it.
- One grammar rule per lesson, tied to the combos, in two or three short sentences.

**Feedback**
- Low fun: more vivid hooks, more combos, a theme from `wantNext`.
- Many typing errors of the "marks" or "tone" kind with few perfect answers usually means no Vietnamese keyboard; keep the Telex tip in mind and do not treat it as not knowing the word.
- Repeated tone confusions (for example hỏi against ngã, or a against â): choose new words and contrasts that practise that pair.
- Record every decision and the data behind it in `docs/LESSON_LOG.md`.

## Roadmap

A default order of themes, to be bent by feedback. About 12 words each; around lesson 20 (roughly 250 words) start mixing in short sentence patterns, and around 400 to 500 words move to a sentences-and-conversation phase (classifiers, the pronoun system in use, question patterns, short dialogues).

1. Food and drink (done)
2. Numbers 0 to 10, and "how much?" (bao nhiêu)
3. People and family: tôi, bạn, anh, chị, em, ông, bà, bố, mẹ, con
4. Greetings and politeness: xin chào, cảm ơn, xin lỗi, vâng, không, tạm biệt
5. Numbers to a thousand, money (nghìn, đồng), prices
6. Everyday verbs: ăn, uống, đi, đến, có, là, muốn, thích, biết, nói, nghe, xem
7. Describing words: to, nhỏ, nóng, lạnh, đẹp, đắt, rẻ, nhiều, ít, mới, cũ, vui
8. Places in the city: nhà, phố, chợ, quán, trường, bệnh viện, ga, sân bay, khách sạn, hồ
9. Time: hôm nay, ngày mai, hôm qua, giờ, phút, sáng, trưa, chiều, tối, tuần
10. Question words: gì, ai, đâu, nào, bao giờ, sao, mấy
11. Getting around: xe máy, ô tô, xe buýt, taxi, đường, rẽ trái, rẽ phải, thẳng
12. At the market: quả, rau, thịt, mua, bán, cân, mặc cả
13. Colours and clothes
14. The body and feeling unwell
15. Weather and seasons in Hà Nội
16. Home and household things
17. Feelings and states
18. Work and study
19. More verbs of daily life
20. Hobbies, music, phones and the internet

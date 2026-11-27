# Lesson format

Each lesson is one JSON file in `web/lessons/`, listed in order in `web/lessons/index.json`. The site builds every exercise from it; no code changes are needed for a new lesson unless it needs new art. `scripts/check_lessons.py` enforces this format. `web/lessons/lesson-02.json` is a full example.

All Vietnamese text must be NFC-normalised (the checker catches mistakes).

```jsonc
{
  "id": "lesson-03",              // matches the index entry; file lesson-03.json
  "number": 3,                    // issues are numbered 1, 2, 3... in index order
  "title": "People and family",   // the word set's name, up to 60 characters
  "vi": "Gia đình",               // Vietnamese title, shown in tone colours
  "theme": "people and family",
  "intro": "...",                 // up to 300 characters, a one-line summary
  "cover": { "picture": { "kind": "scene", "name": "phoStall" } },   // a scene in web/js/pictures.js
  "feature": {                    // the issue's story, told in parts through the lesson
    "kicker": "Legends and numbers",
    "title": "The bride price of nines",
    "dek": "...",                 // the standfirst, one or two sentences
    "intro": "...",               // two or three sentences on the opening screen, under 420 characters
    "beats": [                    // 3 to 6 short parts, each under 600 characters
      { "word": "chín", "text": "...", "picture": { "kind": "icon", "name": "..." } },   // shown right after the group that teaches chín; picture optional
      { "text": "..." }                    // untied: shown on a part, real-life or results screen
    ],
    "pull": "...",                // optional: the most surprising line (not shown as a pop-up)
    "sources": [{ "title": "Sơn Tinh – Thủy Tinh", "url": "https://en.wikipedia.org/wiki/..." }]
  },
  "situations": [                 // 5 to 8 real-life lines; about a third replies or orders, not prices
    { "who": "Phở seller", "picture": { "kind": "icon", "name": "bowl" }, "vi": "Phở bò năm mươi nghìn.", "en": "Beef phở is 50,000.",
      "ask": "How much is the beef phở?", "options": ["50.000₫", "15.000₫", "5.000₫", "500.000₫"], "answer": "50.000₫" },
    { "who": "Taxi driver", "vi": "Hết tám mươi nghìn.", "en": "That's 80,000 altogether.", "note": "...", "ask": "Type the fare in digits.", "digits": "80000" },
    { "who": "You, buying mangoes", "say": "25.000₫", "vi": "Hai lăm nghìn.", "accept": ["Hai lăm nghìn.", "Hai nhăm nghìn.", "Hai mươi lăm nghìn.", "Hai lăm.", "Hai nhăm."], "en": "25,000 dong", "ask": "The seller holds up two fingers and a five. Say the price back.", "note": "..." },
    { "who": "Fruit seller", "vi": "Cam ba trăm nghìn một cân.", "en": "Oranges, 300,000 a kilo.", "ask": "What do you say?",
      "options": ["Đắt quá!", "Rẻ quá!", "Ngon quá!"], "answer": "Đắt quá!" }   // a reply in words is played after the answer
  ],
  "dialogues": [                  // one short exchange per issue (from issue 6), after the combos, before real life
    { "title": "Dinner at Bà's", "setting": "table",            // table or street
      "picture": { "kind": "icon", "name": "ricebowl" },
      "lines": [                                              // 2 to 8 lines; almost only known words
        { "who": "Bà", "vi": "...", "en": "..." },
        { "who": "Anh", "vi": "...", "en": "...", "you": true }  // the learner's lines are highlighted
      ],
      "check": { "ask": "You are full. What do you say?", "options": ["...", "...", "..."], "answer": "...", "note": "optional, shown after answering" } }
  ],
  "challenge": { "title": "Street challenge", "text": "..." },        // one real thing to try
  "stamp": { "label": "Gia đình", "picture": { "kind": "icon", "name": "tea" } },
  "warmup": [{ "vi": "bố", "en": "dad" }],      // optional quick check of probably-known words
  "words": [                      // 4 to 16 new words, never taught before, never on the known list
    {
      "vi": "ông",
      "en": "grandfather; you (to an old man)",   // up to 80 characters, unique in the issue
      "picture": { "kind": "icon", "name": "..." },
      "hook": "...",              // memory hook, up to 260 characters
      "remember": "...",          // optional: a second, different cue, shown after a miss instead of the hook (for words the learner keeps missing)
      "tip": "...",               // Hà Nội pronunciation tip, up to 260 characters
      "fact": "...",              // did you know, up to 260 characters
      "note": "...",              // optional usage note, up to 200 characters; shown in reviews
      "contrast": [{ "vi": "ống", "en": "pipe, tube" }]
    }
  ],
  "grammar": { "title": "...", "text": "...", "examples": [{ "vi": "...", "en": "..." }] },
  "combos": [{ "vi": "...", "en": "...", "note": "needed when a syllable is not a taught or known word" }],
  "review": ["gà", "cá"]          // earlier words (not on the known list) to practise again
}
```

Index entry: `{ "id": "lesson-03", "file": "lesson-03.json", "added": "YYYY-MM-DD" }`.

Picture kinds: `icon` (with `name`: one of the drawings in `web/js/pictures.js`), `scene` (with `name`, 400 by 250, for covers), `dots` (`n` up to 100), `blocks` (a thousand), `big` (`label`), `notes` (banknotes), `coin`, `tag` (`label`, `mood`: high, low or ask), `question` (`n`), `digits` (`label`, `mark` index), `halves` (`n`), `plus` (`n`), `half`, `compare`.

Other content files:
- `web/lessons/known.json`: `{ "words": [...] }`, words the learner already knows.

After writing or changing any Vietnamese text, run `python3 scripts/make_audio.py` so every spoken string (words, contrasts, warm-up, combos, grammar examples) has a clip.

## Result format (schema 3)

After each session the site saves a result and posts it as a GitHub issue (marker `<!-- vietwars-result -->` followed by a JSON block). Every device also reads these issues back to sync progress. `scripts/ingest.py` saves each one to `learner/results/` and builds `learner/profile.json` and `learner/SUMMARY.md`. Fields:

- `resultId`, `kind` (`lesson` or `review`), `lessonId`, `startedAt`, `finishedAt`, `durationSec`, `device`, `style`
- `summary`: `firstTryAccuracy` (0 to 1, typing partly counted), `exercises`, `bestStreak`, `grade` (complete, merit or distinction), `speedScore`, `speedAnswered`, `speedCorrect`, `bestCombo` (rush hour)
- `article`: `readSec` (time on the opening), `factsShown` (always 0 since the pop-ups went); `situations` and `dialogues`: `correct`, `total`; `timing`: seconds per phase (article, warmup, words, drills, reallife, rush), `pauses` (gaps over a minute), `longestPauseSec`; `toneMarks` (relaxed or strict); `partial` and `progress` for an issue closed midway
- `words[]`: `vi`, `en`, `share` (first-try credit), `meaning` (listen and reverse), `form` (spelling and typing), `stars`, `firstTry` per exercise, `attempts`, `failures`, `timeSec`, `replays`, `hints`, `revealed`, `studySec` (time on the word card), `msMedian`, `known` (tapped "I know it")
- `warmup[]`: `vi`, `ok`, `ms`
- `toneConfusions[]`, `meaningConfusions[]`, `typed[]` (target, answer, grade: perfect, tone, marks, sound or wrong; hints; keys pressed; dictation)
- `feedback`: `difficulty`, `fun`, `article` (the story: Skipped it, OK, Interesting, Loved it), `hardest[]`, `wantNext`, `note` (or null if skipped)
- `events[]`: every answer in order (`t`: listen, spell, reverse, type, situation, say (a price said aloud by typing it; `w` is the price shown, `g` the closest grade over `accept`), speed, meet (time on a word card), story (time on a beat), known; `w` word, `ok` or `g`, `a` answer, `ms` time to answer, `plays` audio replays, `hints`, `firstKeyMs`, `deletes`, `revealed`, `tiles`, and flags `retry`, `warmup`, `dictation`, `mixup` (a review's mix-up practice, recorded with `retry` so it is not a first try))

Schema 1 (lesson 1) and schema 2 (the short-lived battle version, with a `battle` object) are still read by `ingest.py` and by the site's sync.

## Questions and answers

A question from Ask is an issue labelled `question` with the text, an optional `Context:` line, and the marker `<!-- vietwars-question -->` followed by a JSON block: `questionId`, `askedAt`, `text`, `context` (for example "issue 3, One to ten, properly; word: một (one)", or null). An answer is a comment on that issue: Markdown for the learner, then `<!-- vietwars-answer {"phrases": [{"vi": "...", "en": "..."}]} -->`, which the site turns into play buttons. `scripts/questions.py answer N FILE` writes it; the site shows the newest comment with an answer block, or else the newest comment. `learner/questions.json` keeps every question with its answer.

A `say` situation shows a price in figures, or a short English cue (Hello! to an old man), and asks the learner to type how it is said. A one-letter slip in a word (douc for được) counts as said the way it sounds. Every form in `accept` counts (grading is the same as typing a word: missing marks are right when tone marks are relaxed; a closing em, anh, chị, ạ or nhé may be added or left out, so `accept` needs no variants for them); `vi`, one of them, is played and shown afterwards. Use it for production practice: two or three per issue at most, mixed with listening ones. Optional: `reply` (`who`, `vi`, `en`), what the other person says back, shown and played after the model answer (`replyMissed` instead when the answer was wrong), and `saves`, the đồng a right counter-offer takes off; the results page adds them up as "haggled off" and the result records `savedDong`.


## Milestones (`web/milestones.json`)

A list of `{ words, rank?, fact, saying, sources }`, rising by `words`. `rank` is `{ vi, en }` (a title from the old imperial exams; a milestone without one keeps the rank before it). `fact` is one or two sourced sentences. `saying` is `{ vi, literal, meaning }`: a well-known Vietnamese saying, its word-for-word English and what it means; its audio is made by `scripts/make_audio.py`, and the words the learner has met are underlined. `scripts/check_lessons.py` checks the file.

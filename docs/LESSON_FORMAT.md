# Lesson format

Each lesson is one JSON file in `web/lessons/`, listed in order in `web/lessons/index.json`. The site builds every exercise from it; no code changes are needed for a new lesson unless it needs new art. `scripts/check_lessons.py` enforces this format. `web/lessons/lesson-02.json` is a full example.

All Vietnamese text must be NFC-normalised (the checker catches mistakes).

```jsonc
{
  "id": "lesson-03",              // matches the index entry; file lesson-03.json
  "number": 3,                    // lessons are numbered 1, 2, 3... in index order
  "title": "The nosy neighbour",  // English, up to 60 characters
  "vi": "Gia đình",               // Vietnamese title, shown in tone colours
  "theme": "people and family",
  "intro": "...",                 // up to 300 characters, shown on the first screen
  "foe": {
    "name": "Cô Hàng Xóm",        // Vietnamese name, shown in tone colours
    "en": "the Nosy Neighbour",
    "art": "shadow",              // a drawing in web/js/sprites.js
    "intro": "...",               // one or two sentences about the villain
    "taunts": [{ "vi": "...", "en": "..." }],   // two or three, in known words only
    "win": { "vi": "...", "en": "..." },        // said when the learner defeats it
    "lose": { "vi": "...", "en": "..." }        // said when it gets away
  },
  "warmup": [{ "vi": "bố", "en": "dad" }],      // optional quick check of probably-known words
  "words": [                      // 4 to 16 new words, never taught before, never on the known list
    {
      "vi": "ông",                // the word as written
      "en": "grandfather; you (to an old man)",   // up to 80 characters, unique in the lesson
      "picture": { "kind": "icon", "name": "..." }, // see web/js/pictures.js
      "hook": "...",              // memory hook, up to 260 characters
      "tip": "...",               // Hà Nội pronunciation tip, up to 260 characters
      "note": "...",              // optional usage note, up to 200 characters; shown in reviews
      "contrast": [{ "vi": "ống", "en": "pipe, tube" }]   // optional; same letters, different marks
    }
  ],
  "grammar": { "title": "...", "text": "...", "examples": [{ "vi": "...", "en": "..." }] },
  "combos": [{ "vi": "...", "en": "...", "note": "needed when a syllable is not a taught or known word" }],
  "review": ["gà", "cá"]          // earlier words (not on the known list) to practise again
}
```

Index entry: `{ "id": "lesson-03", "file": "lesson-03.json", "added": "YYYY-MM-DD" }`.

Picture kinds: `icon` (with `name`: one of the drawings in `web/js/pictures.js`), `dots` (`n` up to 100), `blocks` (a thousand), `big` (`label`), `notes` (banknotes), `coin`, `tag` (`label`, `mood`: high, low or ask), `question` (`n`), `digits` (`label`, `mark` index), `halves` (`n`), `plus` (`n`), `half`, `compare`.

Other content files:
- `web/lessons/known.json`: `{ "words": [...] }`, words the learner already knows.
- `web/lessons/game.json`: battle callouts (shown during battles) and `reviewFoe`, the villain of review sessions.

After writing or changing any Vietnamese text, run `python3 scripts/make_audio.py` so every spoken string (words, contrasts, warm-up, combos, grammar examples, foe lines) has a clip.

## Result format (schema 2)

After each session the site saves a result and posts it as a GitHub issue (marker `<!-- vietwars-result -->` followed by a JSON block). `scripts/ingest.py` saves each one to `learner/results/` and builds `learner/profile.json` and `learner/SUMMARY.md`. Fields:

- `resultId`, `kind` (`lesson` or `review`), `lessonId`, `startedAt`, `finishedAt`, `durationSec`, `device`, `style`
- `summary`: `firstTryAccuracy` (0 to 1, typing partly counted), `exercises`, `xp`, `speedScore`, `speedAnswered`, `speedCorrect`, `bestCombo`
- `battle`: `foe`, `won`, `foeHpLeft`, `heartsLost`, `knockouts`, `crits`, `ambushWon`, `ambushLost`, `powerups`, `rank`
- `words[]`: `vi`, `en`, `share` (first-try credit), `meaning` (listen and reverse), `form` (spelling and typing), `stars`, `firstTry` per exercise, `attempts`, `msMedian`, `known` (tapped "I know it")
- `warmup[]`: `vi`, `ok`, `ms`
- `toneConfusions[]`, `meaningConfusions[]`, `typed[]` (target, answer, grade: perfect, tone, marks, sound or wrong; hints; keys pressed; dictation)
- `feedback`: `difficulty`, `fun`, `hardest[]`, `wantNext`, `note` (or null if skipped)
- `events[]`: every answer in order (`t` type, `w` word, `ok` or `g`, `a` answer, `ms`, and flags `retry`, `warmup`, `ambush`, `dictation`, `timeout`)

Schema 1 results (lesson 1) have no `battle`, `warmup`, `meaning` or `form`; `ingest.py` handles both.

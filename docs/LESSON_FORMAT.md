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
  "feature": {                    // the issue's article
    "kicker": "Family and manners",
    "title": "Who are you calling older brother?",
    "dek": "...",                 // the standfirst, one or two sentences
    "body": ["...", "...", "..."],// 2 to 5 paragraphs, 150 to 350 words in all, each under 800 characters
    "pull": "...",                // the pull quote: the most surprising sentence
    "sources": [{ "title": "Vietnamese pronouns", "url": "https://en.wikipedia.org/wiki/Vietnamese_pronouns" }]
  },
  "quiz": [                       // 2 to 6 trivia questions on the article
    { "q": "...", "options": ["...", "...", "..."], "answer": 1, "explain": "..." }
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
- `article`: `readSec` (time on the article), `factsShown`; `quiz`: `correct`, `total`
- `words[]`: `vi`, `en`, `share` (first-try credit), `meaning` (listen and reverse), `form` (spelling and typing), `stars`, `firstTry` per exercise, `attempts`, `msMedian`, `known` (tapped "I know it")
- `warmup[]`: `vi`, `ok`, `ms`
- `toneConfusions[]`, `meaningConfusions[]`, `typed[]` (target, answer, grade: perfect, tone, marks, sound or wrong; hints; keys pressed; dictation)
- `feedback`: `difficulty`, `fun`, `article` (Skipped it, OK, Interesting, Loved it), `hardest[]`, `wantNext`, `note` (or null if skipped)
- `events[]`: every answer in order (`t` type including `quiz`, `w` word, `ok` or `g`, `a` answer, `ms`, and flags `retry`, `warmup`, `dictation`)

Schema 1 (lesson 1) and schema 2 (the short-lived battle version, with a `battle` object) are still read by `ingest.py` and by the site's sync.

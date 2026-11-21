# Lesson format

Each lesson is one JSON file in `web/lessons/`, listed in order in `web/lessons/index.json`. The site builds every exercise from it; no code changes are needed for a new lesson. `scripts/check_lessons.py` enforces this format. See `web/lessons/lesson-01.json` for a full example.

All Vietnamese text must be NFC-normalised (the default when typing on Apple devices; the checker catches mistakes).

```jsonc
{
  "id": "lesson-02",            // matches the index entry; file lesson-02.json
  "number": 2,                  // lessons are numbered 1, 2, 3... in index order
  "title": "Counting to ten",   // English, up to 60 characters
  "vi": "Đếm số",               // Vietnamese title, shown in tone colours
  "theme": "numbers",
  "intro": "...",               // up to 300 characters, shown on the first screen
  "words": [                    // 4 to 16 new words, never taught in an earlier lesson
    {
      "vi": "một",              // the word as written
      "en": "one",              // short gloss, up to 80 characters, unique within the lesson
      "hook": "...",            // memory hook, up to 260 characters
      "tip": "...",             // Hà Nội pronunciation tip, up to 260 characters
      "note": "...",            // optional usage note, up to 200 characters
      "contrast": [             // optional: same letters, different tone or vowel mark
        { "vi": "mốt", "en": "fashion, trend" }
      ]
    }
  ],
  "grammar": {                  // optional: one rule
    "title": "...",
    "text": "...",
    "examples": [{ "vi": "...", "en": "..." }]
  },
  "combos": [                   // none, or at least 4; built from this lesson's and earlier words
    { "vi": "...", "en": "...", "note": "needed when a syllable is not a taught word" }
  ],
  "review": ["phở", "rau"]      // earlier words to practise again in this lesson
}
```

Index entry: `{ "id": "lesson-02", "file": "lesson-02.json", "added": "YYYY-MM-DD" }`.

After writing a lesson, run `python3 scripts/make_audio.py` so every `vi` string (words, contrasts, combos, grammar examples) has a clip.

## Result format

After each session the site saves a result and posts it as a GitHub issue (marker `<!-- vietwars-result -->` followed by a JSON block). `scripts/ingest.py` saves each one to `learner/results/` and builds `learner/profile.json` and `learner/SUMMARY.md`. Fields:

- `resultId`, `kind` (`lesson` or `review`), `lessonId`, `startedAt`, `finishedAt`, `durationSec`, `device`
- `summary`: `firstTryAccuracy` (0 to 1, typing partly counted), `exercises`, `xp`, `speedScore`, `speedAnswered`, `speedCorrect`, `bestCombo`
- `words[]`: `vi`, `en`, `share` (first-try credit), `stars` (0 to 3), `firstTry` per exercise type, `attempts`, `msMedian`, `known` (tapped "I know it")
- `toneConfusions[]` (heard, picked), `meaningConfusions[]`, `typed[]` (target, answer, grade, hints)
- `feedback`: `difficulty`, `fun`, `hardest[]`, `wantNext`, `note` (or null if skipped)
- `events[]`: every answer in order (`t` type, `w` word, `ok` or `g` grade, `a` answer, `ms`, `retry`)

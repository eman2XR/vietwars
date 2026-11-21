# Học tiếng Việt (repository: vietwars): working instructions

A personal site for learning **Northern (Hà Nội) Vietnamese**, for one learner (the owner), on iPhone, iPad and Mac. It is a small magazine: every lesson is an issue with an article on Vietnamese history or culture, a quiz, a fact for every word, drills, a rush-hour round, a stamp and a real-world challenge. Static site in `web/`, deployed to GitHub Pages (https://eman2xr.github.io/vietwars/) by `.github/workflows/pages.yml` on every push to `main`. Repository: https://github.com/eman2XR/vietwars (public).

## The loop

1. The learner reads and practises an issue, or a review. Every answer, timing, tone confusion, typed answer, quiz score, article reading time and their end-of-issue feedback is saved on the device and posted as a GitHub issue (`web/js/sync.js`, using a fine-grained token with Issues read and write, entered in Settings on each device). Every device reads those issues back on open and rebuilds progress from them, so devices stay in sync (no token needed to read; the repository is public).
2. `python3 scripts/ingest.py` saves new results to `learner/results/` and rebuilds `learner/profile.json` and `learner/SUMMARY.md` (meaning and spelling strength per word, known words, warm-up misses, typing, quiz and article signals, feedback, and `learner/NOTES.md`).
3. `python3 scripts/status.py --decide` says what to do: `ingest`, `review-progress`, `next-lesson` or `wait`. It keeps exactly one unplayed lesson waiting, at most two new lessons a day, and a progress review every five sessions or seven days.
4. Skills in `.claude/skills/`: `next-lesson` (plan, research, write, review with three subagents, test, publish), `review-progress` (trends, curriculum and rule changes, `learner/REVIEW.md`), `lesson-loop` (one round of the above; run it as `/loop 1h /lesson-loop`).

Agents may publish lessons on their own (the owner asked for this on 2026-11-21), but only issues that pass every check and all three reviews.

## Layout

- `web/index.html`, `web/style.css` (six styles named after Vietnamese materials, as CSS variables on `[data-style]`), `web/sw.js` (offline cache), `web/manifest.webmanifest`, `web/icons/`.
- `web/js/main.js` (routing, the magazine home with the passport of stamps, words, settings and the style picker, saving and replaying results, syncing between devices, known words), `lesson.js` (the issue engine: article, quiz, drills, facts on streaks, rush hour, results and stamps), `vi.js` (tones, colouring, grading, Telex, the on-screen tone keys), `srs.js` (Leitner intervals), `store.js` (localStorage), `audio.js` (clips, in-memory preload, speech fallback), `sync.js` (posting and reading result issues), `pictures.js` (word pictures, diagrams and cover scenes).
- `web/lessons/index.json`, `lesson-NN.json` (content only), `known.json` (words the learner knows). `web/audio/`: clips named by a hash of their text, listed in `audio/index.json`.
- `scripts/make_audio.py` (macOS `say -v Linh`), `check_lessons.py` (format, dialect, known words, pictures, articles, quizzes, audio), `check_site.py` (WebKit play-through on iPhone 15, iPhone SE, iPad Pro portrait and landscape, desktop Safari, including a second device syncing; screenshots in `.checks/`), `style_shots.py` (a sheet per style in `docs/styles/`), `make_icons.py`, `ingest.py`, `status.py`.
- `learner/`: results, profile, summary, `NOTES.md` (what the learner said outside the app), `curriculum.json` (phases and planned units; agents keep it current), `REVIEW.md` (latest progress review).
- `docs/PEDAGOGY.md` (teaching rules), `docs/LESSON_FORMAT.md` (lesson and result formats), `docs/LESSON_LOG.md` (why each lesson is the way it is), `docs/STYLES.md`.
- `tests/`: `node --test` unit tests for grading, Telex, tone placement, the tone keys and spaced repetition.

## Verify

```sh
node --test
python3 scripts/check_lessons.py
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 scripts/check_site.py
```

`check_site.py` and `style_shots.py` need the Framework Python (it has Playwright and WebKit). Look at the screenshots after visual changes. Run `scripts/make_audio.py` after any change to Vietnamese text. The iOS Simulator works from this sandbox with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` and `$DEVELOPER_DIR/usr/bin/simctl` (boot a device, `simctl openurl booted <url>`, `simctl io booted screenshot <file>`); it can only open the deployed site, since the sandbox cannot serve local files.

## Rules

- Northern dialect only, in words, glosses, tips, articles and audio. Every new issue gets three independent reviews before it ships: Vietnamese accuracy, learning design, and a history and culture fact-check.
- Articles and facts must be true and sourced (`feature.sources`); English and Vietnamese Wikipedia are reachable from the sandbox. Wikimedia Commons images are not reachable yet; until they are, illustrations are original SVG in `web/js/pictures.js`.
- Audio is the macOS voice Linh, used with the owner's agreement for this personal site. Its hỏi tone falls like huyền, so lessons avoid hỏi against huyền contrasts.
- Never teach or review a word on the known list. Judge meaning and spelling separately.
- All art is original and in context: drawings belong to the word or the story (a phở stall, a market), never random animals or mascots. No characters, names, art or lines from existing films, games or books.
- The site must work in Safari on iPhone, iPad and Mac and as a Home Screen app: tap targets of at least 44 px, safe-area padding, inputs of 16 px or more, audio started from a tap, no hover-only controls. The Content-Security-Policy in `web/index.html` allows only the site itself, `blob:` audio and `api.github.com`; no inline scripts or styles (set styles from JavaScript through `element.style`).
- Keep result formats readable by `ingest.py`; bump `schema` when a field changes meaning.
- Bump the cache names in `web/sw.js` when the list of app files changes.
- Result issues are public (the repository is public). They hold only lesson data and feedback.
- Commit with the repository's local git identity; signing is off for this repository only. Never force-push.

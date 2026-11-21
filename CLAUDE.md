# Học tiếng Việt: working instructions

A personal site for learning **Northern (Hà Nội) Vietnamese**, for one learner (the owner), on iPhone, iPad and Mac. Static site in `web/`, deployed to GitHub Pages (https://eman2xr.github.io/vietwars/) by `.github/workflows/pages.yml` on every push to `main`. Repository: https://github.com/eman2XR/vietwars (public).

## The loop

1. The learner does a lesson or review on the site. Every answer, timing, tone confusion, typed answer and their end-of-lesson feedback is saved on the device and posted as a GitHub issue (`web/js/sync.js`, needs a fine-grained token with Issues read and write, entered in the site's Settings on each device).
2. `python3 scripts/ingest.py` saves new results to `learner/results/` and rebuilds `learner/profile.json` and `learner/SUMMARY.md`.
3. The `/next-lesson` skill (`.claude/skills/next-lesson/SKILL.md`) plans and writes the next lesson from that data, following `docs/PEDAGOGY.md` and `docs/LESSON_FORMAT.md`, has it reviewed, checks it, and publishes it.

## Layout

- `web/index.html`, `web/style.css`, `web/sw.js` (offline cache), `web/manifest.webmanifest`, `web/icons/`.
- `web/js/main.js` (routing, home, words, settings, saving results), `lesson.js` (exercise engine), `vi.js` (tones, colouring, grading, Telex), `srs.js` (Leitner intervals), `store.js` (localStorage), `audio.js` (clips, in-memory preload, speech fallback), `sync.js` (GitHub issues).
- `web/lessons/index.json` and `lesson-NN.json`: lesson content only. `web/audio/`: clips named by a hash of their text, listed in `audio/index.json`.
- `scripts/make_audio.py` (macOS `say -v Linh`), `scripts/check_lessons.py` (format and dialect checks), `scripts/check_site.py` (WebKit play-through as iPhone 15 and iPad Pro 11, screenshots in `.checks/`), `scripts/make_icons.py`, `scripts/ingest.py`.
- `learner/`: saved results and the derived profile. `docs/LESSON_LOG.md`: why each lesson was planned the way it was.
- `tests/`: `node --test` unit tests for grading, Telex and spaced repetition.

## Verify

```sh
node --test
python3 scripts/check_lessons.py
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 scripts/check_site.py
```

`check_site.py` needs the Framework Python (it has Playwright and WebKit). Look at the screenshots after visual changes. Run `scripts/make_audio.py` after any change to Vietnamese text.

## Rules

- Northern dialect only, in words, glosses, tips and audio. Every new lesson gets an independent Vietnamese accuracy review before it ships.
- Audio is the macOS voice Linh, used with the owner's agreement for this personal site.
- The site must work on iPhone and iPad Safari and as a Home Screen app: tap targets of at least 44 px, safe-area padding, 16 px or larger inputs (no zoom), audio started from a tap, no hover-only controls. The Content-Security-Policy in `web/index.html` allows only the site itself and `api.github.com`; no inline scripts or styles.
- Keep the lesson format stable; old results must stay readable by `ingest.py`. If a field changes, bump `schema` in results and handle both.
- Result issues are public (the repository is public). They hold only lesson data and feedback.
- Bump the cache names in `web/sw.js` when the list of app files changes.
- Commit as the repository's local git identity; signing is off for this repository only. Never force-push.

# Viet Wars

A personal site for learning Northern (Hà Nội) Vietnamese, built for iPhone, iPad and Mac. Open it in Safari and choose Share, Add to Home Screen to use it like an app; it works offline once opened.

Site: https://eman2xr.github.io/vietwars/

Every lesson is a battle against an original cartoon villain. You meet about a dozen words with pictures, audio, colour-coded tones, memory hooks and Hà Nội pronunciation tips, then fight with them: listening, picking the spelling you heard, typing from memory with on-screen tone keys, combining words into real phrases, and a 45-second boss round. Ambushes and power-ups turn up at random. Learned words come back in spaced reviews against the Ghost of Forgetting. Eight visual styles are in Settings ([see them all](docs/STYLES.md)).

After each session your results and feedback are posted to this repository as an issue. Claude Code agents read them and plan the next lesson, adapting the curriculum to what you know, what you miss and what you ask for (`/lesson-loop`, `/next-lesson`, `/review-progress`).

To send results from a device, create a fine-grained GitHub token for this repository with Issues read and write, and paste it into the site's Settings.

For development notes see [CLAUDE.md](CLAUDE.md); for how lessons are planned see [docs/PEDAGOGY.md](docs/PEDAGOGY.md).

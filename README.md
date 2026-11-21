# Học tiếng Việt

A small magazine for learning Northern (Hà Nội) Vietnamese, built for iPhone, iPad and Mac. Open it in Safari and choose Share, Add to Home Screen to use it like an app; it works offline once opened.

Site: https://eman2xr.github.io/vietwars/

Every lesson is an issue. It opens with a short, sourced story from Vietnamese history or culture ("Younger than the Eiffel Tower": why phở is newer than you think; "Copper, paper, plastic": a currency named after a metal nobody carries), then a trivia quiz. Then a dozen words with pictures, audio, colour-coded tones, memory hooks, Hà Nội pronunciation tips and a did-you-know fact each, drilled by listening, picking the spelling you heard, and typing from memory with on-screen tone keys. Three right in a row brings up a surprise fact; a 45-second rush hour round closes the issue. Finish it to earn a stamp for your passport, and take the street challenge: one real thing to try in Hà Nội. Learned words come back in spaced reviews. Progress syncs between devices. Six styles, each named after a Vietnamese material, are in Settings ([see them](docs/STYLES.md)).

After each session your results and feedback are posted to this repository as an issue. Claude Code agents read them and write the next issue, adapting the words, the stories and the curriculum to what you know, what you miss and what you ask for (`/lesson-loop`, `/next-lesson`, `/review-progress`).

To send results from a device, create a fine-grained GitHub token for this repository with Issues read and write, and paste it into the site's Settings.

For development notes see [CLAUDE.md](CLAUDE.md); for how issues are planned see [docs/PEDAGOGY.md](docs/PEDAGOGY.md).

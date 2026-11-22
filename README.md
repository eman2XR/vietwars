# Học tiếng Việt

A small magazine for learning Northern (Hà Nội) Vietnamese, built for iPhone, iPad and Mac. Open it in Safari and choose Share, Add to Home Screen to use it like an app; it works offline once opened.

Site: https://eman2xr.github.io/vietwars/

Every lesson is an issue. It opens with a short story from Vietnamese history or culture, and the rest of the story arrives as you learn the words it is about ("The bride price of nines": the legend of the mountain god and the water god, told as you learn one to ten). Each word has a picture, audio, colour-coded tones, a memory hook, a Hà Nội pronunciation tip and a did-you-know fact. You practise by listening, picking the spelling you heard, and typing from memory (right letters count; three levels of hints; syllable tiles when a word will not come), then hear real life: a waiter or seller says a price and you pick it or type it in digits. a 45-second rush hour round closes the issue. Close an issue at any point and pick it up later. Finish it to earn a stamp for your passport, and take the street challenge. Learned words come back in spaced reviews, and progress syncs between devices. Six styles, each named after a Vietnamese material, are in Settings ([see them](docs/STYLES.md)).

Stuck on something? Ask the editors: "How do I ask for the bill?", "What is the difference between nữa and nửa?". Use the ? button inside an issue or Ask on the home page. Each question is posted to this repository as an issue; the lesson loop answers it within a few hours (it runs a few times a day), and the answer appears under Ask with every phrase ready to play.

Notifications: on iPhone or iPad, add the site to your Home Screen (Safari, Share, Add to Home Screen), open it from there, paste your GitHub token in Settings, and tap Notify me. You then get a notification when a new issue is ready or a question has an answer. On a Mac, Safari can turn them on from Settings directly.

After each session your results and feedback are posted to this repository as an issue. Claude Code agents read them and write the next issue, adapting the words, the stories and the curriculum to what you know, what you miss and what you ask for (`/lesson-loop`, `/next-lesson`, `/review-progress`).

To send results and questions from a device, create a fine-grained GitHub token for this repository with Issues read and write, and paste it into the site's Settings.

For development notes see [CLAUDE.md](CLAUDE.md); for how issues are planned see [docs/PEDAGOGY.md](docs/PEDAGOGY.md).

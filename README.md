# Trumpet Studio Practice Tool

https://andrew-shear.github.io/TrumpetStudioPractice/

A web-based practice tool for listening exams. Plays random 20-second snippets of songs and tests your ability to identify them.

## Features

- Random 20-second snippets from random positions in each song
- Multiple choice questions
- Skip button to reveal answer and move on
- Streak counter and correct/wrong tracking
- Endless practice loop

## How to Use

1. Click **"Play Snippet"** to hear a random 20-second section of a random song
2. Select the correct song title from the 4 options
4. Use **"Skip"** if you give up and want to see the answer

## File Structure

```
trumpet-studio-practice/
├── index.html          # Main page
├── styles.css          # Styling
├── app.js              # Game logic
├── songs.js            # Song data (edit this each semester)
├── audio/              # MP3 files (not included in repo)
│   ├── song1.mp3
│   └── song2.mp3
└── README.md           # This file
```

## Notes

- Streak and stats reset on page refresh (by design)
- Each play picks a random starting point in the song (simulates the real exam)

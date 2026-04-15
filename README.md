<!--
Andrew Shear ashear@vt.edu
04/15/26

As a Hokie, I will conduct myself with honor and integrity at all times. I will not lie, cheat, or steal, nor will I accept the actions of those who do.
During the preparation of this assignment, I used Kimi-K2.5 in every file to plan, draft, iterate, test, and debug. After using this tool, I reviewed and edited the content as needed to ensure its accuracy and take full responsibility for the content in relation to grading.
-->

# 🎺 Trumpet Studio Practice Tool

A web-based practice tool for Virginia Tech Trumpet Studio listening exams. Plays random 20-second snippets of songs and tests your ability to identify them.

## Features

- 🎵 Random 20-second snippets from random positions in each song
- 🎯 Multiple choice questions (4 options)
- 💡 Progressive hint system (reveals one letter at a time)
- ⏭ Skip button to reveal answer and move on
- 🔥 Streak counter and correct/wrong tracking
- 🔄 Endless practice loop

## Setup Instructions

### 1. Download Audio Files

Use **yt-dlp** to download songs from YouTube:

```bash
# Install yt-dlp (if not already installed)
pip install yt-dlp

# Download a song
yt-dlp -x --audio-format mp3 --audio-quality 128K \
  "https://youtube.com/watch?v=VIDEO_ID" \
  -o "composer_title_performer.mp3"
```

Place all MP3 files in the `/audio` folder.

### 2. Update Song List

Edit `songs.js` and replace the example entries with your semester's songs:

```javascript
const SONGS = [
    {
        id: "mahler_sym5_mvt1",
        title: "Symphony No. 5 - 1st Movement",
        performer: "Phil Smith",
        composer: "Gustav Mahler",
        filename: "mahler_sym5_mvt1.mp3"
    },
    // Add more songs...
];
```

### 3. Deploy

#### Option A: GitHub Pages (Recommended)
1. Create a new GitHub repository
2. Upload all files (except audio files - see below)
3. Enable GitHub Pages in repository settings
4. For audio files, use a service like Cloudinary or upload to the repo if files are small

#### Option B: Local Use
Simply open `index.html` in your browser after adding audio files to the `/audio` folder.

## How to Use

1. Click **"Play Snippet"** to hear a random 20-second section of a random song
2. Select the correct song title from the 4 options
3. Use **"Hint"** if you need help (reveals one letter at a time)
4. Use **"Skip"** if you give up and want to see the answer
5. Correct answers automatically advance; wrong/skipped answers show a "Next" button

## Tips for Finding Songs

- Search YouTube for: `"[Song Name]" "[Performer]" trumpet`
- Classical trumpet recordings are usually available
- Download at 128kbps - quality is sufficient for identification

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
- No login required - completely standalone

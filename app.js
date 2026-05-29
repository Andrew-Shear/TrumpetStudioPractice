// Game State
let gameState = {
    currentSong: null,
    currentAnswer: null,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    isPlaying: false,
    options: [],
    snippetTimeout: null,
    timerInterval: null,
    currentStartTime: 0,
    snippetFinished: false,
    inputCategory: 'title', // 'title' or 'composer' or 'performer'
    inputMode: 'multiple-choice' // 'multiple-choice' or 'text'
};

// DOM Elements
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const skipBtn = document.getElementById('skipBtn');
const optionsContainer = document.getElementById('optionsContainer');
const textInputContainer = document.getElementById('textInputContainer');
const answerInput = document.getElementById('answerInput');
const submitBtn = document.getElementById('submitBtn');
const modeToggle = document.getElementById('modeToggle');
const categorySelect = document.getElementById('categorySelect');
const questionText = document.getElementById('questionText');
const feedback = document.getElementById('feedback');
const feedbackText = document.getElementById('feedbackText');
const nextBtn = document.getElementById('nextBtn');
const streakCount = document.getElementById('streakCount');
const correctCount = document.getElementById('correctCount');
const wrongCount = document.getElementById('wrongCount');

// Constants
const SNIPPET_DURATION = 20; // seconds

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (SONGS.length === 0) {
        alert('No songs loaded! Please add songs to songs.js');
        return;
    }
    
    // Set initial volume
    audioPlayer.volume = 0.8;
    
    // Hide volume slider on iOS (volume control not supported)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
        document.querySelector('.volume-control').classList.add('hidden-ios');
    }
    
    // Load saved stats from localStorage
    const saved = localStorage.getItem('trumpetStats');
    if (saved) {
        try {
            const stats = JSON.parse(saved);
            gameState.streak = stats.streak || 0;
            gameState.correctCount = stats.correct || 0;
            gameState.wrongCount = stats.wrong || 0;
            updateStats();
        } catch (e) {
            console.log('Failed to load saved stats:', e);
        }
    }
    
    loadNewSong();
});

// Volume slider
volumeSlider.addEventListener('input', () => {
    const volume = volumeSlider.value / 100;
    audioPlayer.volume = volume;
    volumeValue.textContent = `${volumeSlider.value}%`;
});

// Mode toggle
modeToggle.addEventListener('click', () => {
    if (gameState.inputMode === 'multiple-choice') {
        gameState.inputMode = 'text';
        modeToggle.textContent = 'Switch to Multiple Choice';
        optionsContainer.classList.add('hidden');
        textInputContainer.classList.remove('hidden');
        answerInput.value = '';
        answerInput.focus();
    } else {
        gameState.inputMode = 'multiple-choice';
        modeToggle.textContent = 'Switch to Text Input';
        optionsContainer.classList.remove('hidden');
        textInputContainer.classList.add('hidden');
    }

    loadNewSong();
});

// Category select
categorySelect.addEventListener('change', () => {
    gameState.inputCategory = categorySelect.value;
    
    // Update question text based on category
    if (gameState.inputCategory === 'title') {
        questionText.textContent = 'Which song is this?';
    } else if (gameState.inputCategory === 'performer') {
        questionText.textContent = 'Who is the performer?';
    } else if (gameState.inputCategory === 'composer') {
        questionText.textContent = 'Who is the composer?';
    }
    
    loadNewSong();
});

// Text input submit
submitBtn.addEventListener('click', handleTextSubmit);
answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && submitBtn.disabled === false) {
        handleTextSubmit();
    }
});

// Fuzzy string matching - calculates edit distance
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,     // deletion
                    dp[i][j - 1] + 1,     // insertion
                    dp[i - 1][j - 1] + 1  // substitution
                );
            }
        }
    }
    return dp[m][n];
}

// Check if answer is correct using fuzzy matching
function checkAnswerFuzzy(userAnswer, correctAnswer) {
    // Normalize both strings: lowercase, remove extra spaces
    const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ');
    
    const normalizedUser = normalize(userAnswer);
    const normalizedCorrect = normalize(correctAnswer);
    
    // Exact match after normalization
    if (normalizedUser === normalizedCorrect) {
        return true;
    }
        
    const distance = levenshteinDistance(normalizedUser, normalizedCorrect);
    const maxLength = Math.max(normalizedUser.length, normalizedCorrect.length);
    const similarity = 1 - (distance / maxLength);
    
    // If similarity is >= 85%, consider it a match    
    if (similarity >= 0.85) {
        return true;
    }
    
    return false;
}

function disableInput() {
    answerInput.disabled = true;
    submitBtn.disabled = true;

    if (gameState.isPlaying) {
        audioPlayer.pause();
        clearTimeout(gameState.snippetTimeout);
        clearInterval(gameState.timerInterval);
        gameState.isPlaying = false;
    }
    
    // Disable music
    skipBtn.disabled = true;
    playBtn.disabled = true;
    playBtn.textContent = 'Play Snippet';
}

// Handle text input submission
function handleTextSubmit() {
    const userAnswer = answerInput.value.trim();
    if (!userAnswer) return;

    disableInput();
        
    if (checkAnswerFuzzy(userAnswer, gameState.currentAnswer)) {
        gameState.streak++;
        gameState.correctCount++;
        showFeedback('correct', `Correct! ${gameState.currentAnswer}`);
    } else {
        gameState.streak = 0;
        gameState.wrongCount++;
        showFeedback('wrong', `Wrong! The answer was: ${gameState.currentAnswer}`);
    }

    updateStats();
    nextBtn.classList.remove('hidden');
}

// Handle multiple choice guess
function handleMultipleGuess(selectedOption) {
    disableInput();
    
    const isCorrect = selectedOption === gameState.currentAnswer;
    
    if (isCorrect) {
        // Correct answer
        gameState.streak++;
        gameState.correctCount++;
        showFeedback('correct', `Correct! ${gameState.currentAnswer}`);
    } else {
        // Wrong answer
        gameState.streak = 0;
        gameState.wrongCount++;
        showFeedback('wrong', `Wrong! The answer was: ${gameState.currentAnswer}`);
    }

    // Highlight and disable buttons
    const optionBtns = optionsContainer.querySelectorAll('.option-btn');
    optionBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === gameState.currentAnswer) {
            btn.classList.add('correct');
        } else if (!isCorrect && btn.textContent === selectedOption) {
            btn.classList.add('wrong');
        }
    });
    updateStats();
    nextBtn.classList.remove('hidden');
}

// Load a new random song
function loadNewSong() {
    // Reset state

    gameState.currentSong = SONGS[Math.floor(Math.random() * SONGS.length)];
    gameState.isPlaying = false;
    gameState.currentStartTime = 0;
    gameState.snippetFinished = false;

    // Set current answer based on selected category
    switch (gameState.inputCategory) {
        case 'composer':
            gameState.currentAnswer = gameState.currentSong.composer;
            break;
        case 'performer':
            gameState.currentAnswer = gameState.currentSong.performer;
            break;
        default:
            gameState.currentAnswer = gameState.currentSong.title;
            break;
    }

    // Clear any existing timeout and interval
    if (gameState.snippetTimeout) {
        clearTimeout(gameState.snippetTimeout);
        gameState.snippetTimeout = null;
    }
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // Reset audio
    audioPlayer.pause();
    audioPlayer.src = `data/audio/${gameState.currentSong.filename}`;
    audioPlayer.currentTime = 0;
    
    // Log when audio is ready
    audioPlayer.addEventListener('canplaythrough', () => {
        console.log('Audio ready:', gameState.currentSong.filename, 'duration:', audioPlayer.duration);
    }, { once: true });
    
    // Handle audio errors
    audioPlayer.addEventListener('error', (e) => {
        console.error('Error loading audio:', gameState.currentSong.filename, e);
        alert('Error loading audio file: ' + gameState.currentSong.filename + '\nPlease check the file exists and is a valid audio format.');
    }, { once: true });
    
    // Reset UI
    playBtn.disabled = false;
    playBtn.textContent = 'Play Snippet';

    generateOptions();
    hideFeedback();
    
    // Reset text input
    if (answerInput) {
        answerInput.value = '';
        answerInput.disabled = false;
    }
    if (submitBtn) {
        submitBtn.disabled = false;
    }
    
    // Enable buttons
    skipBtn.disabled = false;
}

// Generate multiple choice options
function generateOptions() {
    // Get 3 random distractors (different from correct answer)
    let distractors = new Set();
    while (distractors.size < 3) {
        const randomIndex = Math.floor(Math.random() * SONGS.length);
        let song_answer = null;
        switch (gameState.inputCategory) {
            case 'title':
                song_answer = SONGS[randomIndex].title;
                break;
            case 'composer':
                song_answer = SONGS[randomIndex].composer;
                break;
            default:
                song_answer = SONGS[randomIndex].performer;
                break;
        }
        if (song_answer !== gameState.currentAnswer) {
            distractors.add(song_answer);
        }
    }
    distractors = [...distractors];
    const shuffledDistractors = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    // Combine and shuffle
    gameState.options = [gameState.currentAnswer, ...shuffledDistractors]
        .sort(() => 0.5 - Math.random());
        
    // Render options
    optionsContainer.innerHTML = '';
    gameState.options.forEach(song => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = song;
        btn.onclick = () => {
            if (!btn.disabled) {
                handleMultipleGuess(btn.textContent);
            }
        }
        optionsContainer.appendChild(btn);
    });
}

// Play/Pause/Resume/Restart snippet
playBtn.addEventListener('click', () => {
    // Pause: If currently playing, pause it
    if (gameState.isPlaying) {
        audioPlayer.pause();
        gameState.isPlaying = false;
        clearTimeout(gameState.snippetTimeout);
        clearInterval(gameState.timerInterval);
        playBtn.textContent = 'Resume';
        return;
    }
    
    // Resume: If paused mid-snippet (not finished), resume from current position
    else if (!gameState.snippetFinished && gameState.currentStartTime > 0) {
        audioPlayer.play();
        gameState.isPlaying = true;
        playBtn.textContent = 'Pause';
        // Calculate remaining time for the snippet
        const elapsed = audioPlayer.currentTime - gameState.currentStartTime;
        const remainingTime = (SNIPPET_DURATION - elapsed) * 1000;
        startSnippetTimer(remainingTime);
        return;
    }
    
    // Replay: If snippet finished, restart from same start position
    else if (gameState.snippetFinished && gameState.currentStartTime > 0) {
        gameState.snippetFinished = false;
        
        console.log('Replaying from:', gameState.currentStartTime);
        
        // Use smart seek for replay too
        smartSeekAndPlay(gameState.currentStartTime, SNIPPET_DURATION * 1000);
        return;
    } else {
        // New snippet: Start fresh with new random position
        startNewSnippet();
    }
});

// Start a completely new random snippet
function startNewSnippet() {
    const doStart = () => {
        // Check if duration is valid
        if (!audioPlayer.duration || isNaN(audioPlayer.duration)) {
            console.error('Audio duration not available for:', gameState.currentSong.filename);
            alert('Error loading audio file. Please try another song.');
            return;
        }
        
        // Calculate random start time
        const maxStart = Math.max(0, audioPlayer.duration - SNIPPET_DURATION);
        const targetTime = Math.random() * maxStart;
        gameState.snippetFinished = false;
        
        console.log('Starting snippet at:', targetTime, 'duration:', audioPlayer.duration);
        
        // Use smart seek with validation
        smartSeekAndPlay(targetTime, SNIPPET_DURATION * 1000);
    };
    
    if (audioPlayer.duration && audioPlayer.duration > 0) {
        doStart();
    } else {
        console.log('Waiting for metadata to load...');
        audioPlayer.addEventListener('loadedmetadata', doStart, { once: true });
        // Also listen for error
        audioPlayer.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            alert('Error loading audio file: ' + gameState.currentSong.filename);
        }, { once: true });
    }
}

// Smart seek with validation because there were issues with seeking initially
function smartSeekAndPlay(targetTime, durationMs, attempt = 1) {
    const filename = gameState.currentSong.filename;
    
    let seekHandled = false;
    
    const onSeeked = () => {
        if (seekHandled) return;
        seekHandled = true;
        
        // Validate the seek actually worked
        const actualTime = audioPlayer.currentTime;
        const seekDiff = Math.abs(actualTime - targetTime);
                
        // If seek failed (difference > 2 seconds) and we haven't tried workaround yet
        if (seekDiff > 2 && attempt === 1) {
            console.log('Seek failed !?');
            return;
        }
        
        // Seek succeeded or we're out of options
        gameState.currentStartTime = actualTime;
        audioPlayer.play();
        gameState.isPlaying = true;
        playBtn.textContent = 'Pause';
        startSnippetTimer(durationMs);
    };
    
    audioPlayer.addEventListener('seeked', onSeeked, { once: true });
    
    // Timeout fallback
    const seekTimeout = setTimeout(onSeeked, 500);
    
    audioPlayer.currentTime = targetTime;
}

// Start/restart the 20-second timer (no display update)
function startSnippetTimer(remainingTimeMs) {
    // Clear any existing timer
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    if (gameState.snippetTimeout) {
        clearTimeout(gameState.snippetTimeout);
    }
    
    // Use provided remaining time or default to full duration
    const timeoutDuration = remainingTimeMs || (SNIPPET_DURATION * 1000);
    
    // Set timeout to stop after remaining time
    gameState.snippetTimeout = setTimeout(() => {
        audioPlayer.pause();
        gameState.isPlaying = false;
        gameState.snippetFinished = true;
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
        playBtn.textContent = 'Replay Snippet';
    }, timeoutDuration);
}

// Skip button
skipBtn.addEventListener('click', () => {
    disableInput()
    
    const optionBtns = optionsContainer.querySelectorAll('.option-btn');
    optionBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === gameState.currentAnswer) {
            btn.classList.add('correct');
        }
    });
    
    gameState.streak = 0;
    gameState.wrongCount++;
    updateStats();
    
    showFeedback('skipped', `Skipped! The answer was: ${gameState.currentAnswer}`);
    nextBtn.classList.remove('hidden');
});

// Next button
nextBtn.addEventListener('click', () => {
    loadNewSong();
});

// Show feedback
function showFeedback(type, message) {
    feedback.className = `feedback ${type}`;
    feedbackText.textContent = message;
    feedback.classList.remove('hidden');
}

// Hide feedback
function hideFeedback() {
    feedback.className = 'feedback hidden';
    nextBtn.classList.add('hidden');
}

// Update stats display
function updateStats() {
    streakCount.textContent = gameState.streak;
    correctCount.textContent = gameState.correctCount;
    wrongCount.textContent = gameState.wrongCount;
    
    // Save stats to localStorage
    localStorage.setItem('trumpetStats', JSON.stringify({
        streak: gameState.streak,
        correct: gameState.correctCount,
        wrong: gameState.wrongCount
    }));
}

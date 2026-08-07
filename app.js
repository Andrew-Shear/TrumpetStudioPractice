// Game State
let gameState = {
    currentSong: null,
    currentAnswer: null,
    modeStats: {
        multipleChoice: { correct: 0, wrong: 0, streak: 0 },
        text: { correct: 0, wrong: 0, streak: 0 }
    },
    isPlaying: false,
    options: [],
    snippetTimeout: null,
    timerInterval: null,
    currentStartTime: 0,
    snippetFinished: false,
    inputCategory: 'title', // 'title' or 'composer' or 'performer'
    inputMode: 'multipleChoice' // 'multipleChoice' or 'text'
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

const firebaseConfig = {
    apiKey: "AIzaSyBEWyLkgqBpdFUQw4dG50RS0JyPKraoPCc",
    authDomain: "trumpetstudiopractice.firebaseapp.com",
    projectId: "trumpetstudiopractice",
    storageBucket: "trumpetstudiopractice.firebasestorage.app",
    messagingSenderId: "516087324416",
    appId: "1:516087324416:web:c57eb2d339c9270ace1de5",
    measurementId: "G-4WF3PR8SVG"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const multipleChoiceLeaderboard = db.collection('multiple-choice');
const textLeaderboard = db.collection('text');

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
            gameState.modeStats = stats.modeStats || gameState.modeStats;
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
    if (gameState.inputMode === 'multipleChoice') {
        gameState.inputMode = 'text';
        modeToggle.textContent = 'Switch to Multiple Choice';
        optionsContainer.classList.add('hidden');
        textInputContainer.classList.remove('hidden');
        answerInput.value = '';
        answerInput.focus();
    } else {
        gameState.inputMode = 'multipleChoice';
        modeToggle.textContent = 'Switch to Text Input';
        optionsContainer.classList.remove('hidden');
        textInputContainer.classList.add('hidden');
    }
    updateStats();
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
    updateFeedbackAndStats(checkAnswerFuzzy(userAnswer, gameState.currentAnswer));
}

// Handle multiple choice guess
function handleMultipleGuess(selectedOption) {
    const isCorrect = selectedOption === gameState.currentAnswer;
    
    disableInput();
    updateFeedbackAndStats(isCorrect);

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
}

function updateFeedbackAndStats(isCorrect) {
    if (isCorrect) {
        // Correct answer
        if (gameState.inputMode === 'text') {
            gameState.modeStats.text.streak++;
            gameState.modeStats.text.correct++;
        } else {
            gameState.modeStats.multipleChoice.streak++;
            gameState.modeStats.multipleChoice.correct++;
        }
        showFeedback('correct', `Correct! ${gameState.currentAnswer}`);
    } else {
        // Wrong answer
        if (gameState.inputMode === 'text') {
            gameState.modeStats.text.streak = 0;
            gameState.modeStats.text.wrong++;
        } else {
            gameState.modeStats.multipleChoice.streak = 0;
            gameState.modeStats.multipleChoice.wrong++;
        }
        showFeedback('wrong', `Wrong! The answer was: ${gameState.currentAnswer}`);
    }

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
        seekAndPlay(gameState.currentStartTime, SNIPPET_DURATION * 1000);
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
        seekAndPlay(targetTime, SNIPPET_DURATION * 1000);
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

function seekAndPlay(targetTime, durationMs) {
    audioPlayer.currentTime = targetTime;
    gameState.currentStartTime = targetTime;
    audioPlayer.play();
    gameState.isPlaying = true;
    playBtn.textContent = 'Pause';
    startSnippetTimer(durationMs);
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
    if (gameState.inputMode === 'text') {
        streakCount.textContent = gameState.modeStats.text.streak;
        correctCount.textContent = gameState.modeStats.text.correct;
        wrongCount.textContent = gameState.modeStats.text.wrong;
    } else {
        streakCount.textContent = gameState.modeStats.multipleChoice.streak;
        correctCount.textContent = gameState.modeStats.multipleChoice.correct;
        wrongCount.textContent = gameState.modeStats.multipleChoice.wrong;
    }

    const now = Date.now();
    
    // Save stats to localStorage
    localStorage.setItem('trumpetStats', JSON.stringify({
        modeStats: gameState.modeStats,
        lastUpdated: now,
        playerName: "TODO"
    }));

    syncCurrentLeaderboardStats().catch((error) => {
      console.error(error);
    });
}

function getDeviceId() {
    let deviceID = localStorage.getItem('trumpetDeviceID');
    if (!deviceID) {
        console.log(deviceID);
        deviceID = crypto.randomUUID();
        localStorage.setItem('trumpetDeviceID', deviceID);
    }
    return deviceID;
}

async function syncCurrentLeaderboardStats() {
    const mode = gameState.inputMode;
    const deviceId = getDeviceId();
    const playerName = "TODO";

    const bucket = mode === 'multipleChoice' ? gameState.modeStats.multipleChoice : gameState.modeStats.text;
    const docId = `${deviceId}-${mode}`;
    let docRef = null;
    if (mode == "text") {
        docRef = textLeaderboard.doc(docId);
    } else {
        docRef = multipleChoiceLeaderboard.doc(docId);
    }

    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        await docRef.set({
            deviceId,
            playerName,
            bestStreak: bucket.streak,
            correct: bucket.correct,
            wrong: bucket.wrong,
            winLossRatio: bucket.correct / Math.max(1, bucket.correct + bucket.wrong),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        return;
    }

    const existing = snapshot.data();
    const updated = {
        playerName,
        bestStreak: Math.max(existing.bestStreak || 0, bucket.streak),
        correct: bucket.correct,
        wrong: bucket.wrong,
        winLossRatio: bucket.correct / Math.max(1, bucket.correct + bucket.wrong),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    await docRef.set(updated, { merge: true });
}


async function fetchLeaderboard(mode, metric, limit = 20) {
    let docRef = null;
    if (mode == "text") {
        docRef = textLeaderboard.doc(docId);
    } else {
        docRef = multipleChoiceLeaderboard.doc(docId);
    }
    let query = docRef.orderBy(metric, 'desc').limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map((doc, index) => ({
        rank: index + 1,
        id: doc.id,
        ...doc.data()
    }));
}

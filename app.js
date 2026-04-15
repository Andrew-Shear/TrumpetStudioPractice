// Game State
let gameState = {
    currentSong: null,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    isPlaying: false,
    options: [],
    snippetTimeout: null,
    timerInterval: null,
    currentStartTime: 0,
    snippetFinished: false,
    inputMode: 'multiple-choice' // 'multiple-choice' or 'text'
};

// Track problematic files that don't seek properly
const problematicFiles = new Set();

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
});

// Text input submit
submitBtn.addEventListener('click', handleTextSubmit);
answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
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
    // Normalize both strings: lowercase, trim whitespace, remove extra spaces
    const normalize = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');
    
    const normalizedUser = normalize(userAnswer);
    const normalizedCorrect = normalize(correctAnswer);
    
    // Exact match after normalization
    if (normalizedUser === normalizedCorrect) {
        return { correct: true, match: correctAnswer };
    }
    
    // Check against all song titles for closest match
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const song of SONGS) {
        const normalizedSong = normalize(song.title);
        const distance = levenshteinDistance(normalizedUser, normalizedSong);
        const maxLength = Math.max(normalizedUser.length, normalizedSong.length);
        const similarity = 1 - (distance / maxLength);
        
        // If similarity is > 80%, consider it a match
        if (similarity > 0.9 && distance < bestDistance) {
            bestDistance = distance;
            bestMatch = song;
        }
    }
    
    if (bestMatch) {
        const isCorrect = bestMatch.id === gameState.currentSong.id;
        return { correct: isCorrect, match: bestMatch.title, guessedSong: bestMatch };
    }
    
    return { correct: false, match: null };
}

// Handle text input submission
function handleTextSubmit() {
    const userAnswer = answerInput.value.trim();
    if (!userAnswer) return;
    
    const result = checkAnswerFuzzy(userAnswer, gameState.currentSong.title);
    
    if (result.correct) {
        handleGuess(gameState.currentSong);
    } else {
        // Wrong answer - show what they typed vs correct answer
        if (result.guessedSong) {
            // They matched a different song
            handleGuess(result.guessedSong);
        } else {
            // No close match found - treat as wrong with current song
            handleTextWrong(userAnswer);
        }
    }
}

// Handle wrong text answer
function handleTextWrong(userAnswer) {
    if (gameState.isPlaying) {
        audioPlayer.pause();
        clearTimeout(gameState.snippetTimeout);
        clearInterval(gameState.timerInterval);
        gameState.isPlaying = false;
    }
    
    // Reset snippet state for next song
    gameState.currentStartTime = 0;
    gameState.snippetFinished = false;
    
    // Disable input
    answerInput.disabled = true;
    submitBtn.disabled = true;
    skipBtn.disabled = true;
    playBtn.disabled = true;
    playBtn.textContent = 'Play Snippet';
    
    // Update stats
    gameState.streak = 0;
    gameState.wrongCount++;
    updateStats();
    
    showFeedback('wrong', `Wrong! You typed "${userAnswer}". The answer was: ${gameState.currentSong.title}`);
    nextBtn.classList.remove('hidden');
}

// Load a new random song
function loadNewSong() {
    // Reset state
    gameState.currentSong = SONGS[Math.floor(Math.random() * SONGS.length)];
    gameState.isPlaying = false;
    gameState.currentStartTime = 0;
    
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
    audioPlayer.src = `audio/${gameState.currentSong.filename}`;
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
    const distractors = SONGS.filter(song => song.id !== gameState.currentSong.id);
    const shuffledDistractors = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    // Combine and shuffle
    gameState.options = [gameState.currentSong, ...shuffledDistractors]
        .sort(() => 0.5 - Math.random());
    
    // Render options
    optionsContainer.innerHTML = '';
    gameState.options.forEach(song => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = song.title;
        btn.onclick = () => handleGuess(song);
        optionsContainer.appendChild(btn);
    });
}

// Play/Pause/Resume/Restart snippet
playBtn.addEventListener('click', () => {
    // PAUSE: If currently playing, pause it
    if (gameState.isPlaying) {
        audioPlayer.pause();
        gameState.isPlaying = false;
        clearTimeout(gameState.snippetTimeout);
        clearInterval(gameState.timerInterval);
        playBtn.textContent = 'Resume';
        return;
    }
    
    // RESUME: If paused mid-snippet (not finished), resume from current position
    if (!gameState.snippetFinished && gameState.currentStartTime > 0) {
        audioPlayer.play();
        gameState.isPlaying = true;
        playBtn.textContent = 'Pause';
        // Calculate remaining time for the snippet
        const elapsed = audioPlayer.currentTime - gameState.currentStartTime;
        const remainingTime = (SNIPPET_DURATION - elapsed) * 1000;
        startSnippetTimer(remainingTime);
        return;
    }
    
    // REPLAY: If snippet finished, restart from same start position
    if (gameState.snippetFinished && gameState.currentStartTime > 0) {
        gameState.snippetFinished = false;
        
        console.log('Replaying from:', gameState.currentStartTime);
        
        // Use smart seek for replay too
        smartSeekAndPlay(gameState.currentStartTime, SNIPPET_DURATION * 1000);
        return;
    }
    
    // NEW SNIPPET: Start fresh with new random position
    startNewSnippet();
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

// Smart seek with validation and fallback for problematic files
function smartSeekAndPlay(targetTime, durationMs, attempt = 1) {
    const filename = gameState.currentSong.filename;
    const isProblematic = problematicFiles.has(filename);
    
    // For problematic files, use a simpler fallback position
    if (isProblematic && attempt === 1) {
        console.log('File known to have seek issues, using workaround:', filename);
        workaroundSeek(targetTime, durationMs);
        return;
    }
    
    // Set the target time
    audioPlayer.currentTime = targetTime;
    
    let seekHandled = false;
    
    const onSeeked = () => {
        if (seekHandled) return;
        seekHandled = true;
        
        // Validate the seek actually worked
        const actualTime = audioPlayer.currentTime;
        const seekDiff = Math.abs(actualTime - targetTime);
        
        console.log('Seek attempt', attempt, '- Target:', targetTime, 'Actual:', actualTime, 'Diff:', seekDiff);
        
        // If seek failed (difference > 2 seconds) and we haven't tried workaround yet
        if (seekDiff > 2 && attempt === 1) {
            console.log('Seek validation failed, marking as problematic and trying workaround');
            problematicFiles.add(filename);
            workaroundSeek(targetTime, durationMs);
            return;
        }
        
        // Seek succeeded or we're out of options
        gameState.currentStartTime = actualTime;
        audioPlayer.play();
        gameState.isPlaying = true;
        playBtn.textContent = 'Pause';
        startSnippetTimer(durationMs);
    };
    
    // Timeout fallback
    const seekTimeout = setTimeout(() => {
        if (seekHandled) return;
        seekHandled = true;
        
        console.log('Seek timeout on attempt', attempt);
        const actualTime = audioPlayer.currentTime;
        const seekDiff = Math.abs(actualTime - targetTime);
        
        if (seekDiff > 2 && attempt === 1) {
            console.log('Seek timeout with bad position, trying workaround');
            problematicFiles.add(filename);
            workaroundSeek(targetTime, durationMs);
        } else {
            // Use whatever position we have
            gameState.currentStartTime = actualTime;
            audioPlayer.play();
            gameState.isPlaying = true;
            playBtn.textContent = 'Pause';
            startSnippetTimer(durationMs);
        }
    }, 500);
    
    audioPlayer.addEventListener('seeked', onSeeked, { once: true });
}

// Workaround seek for problematic files - try seeking to an early position first
function workaroundSeek(originalTarget, durationMs) {
    const filename = gameState.currentSong.filename;
    
    // Strategy: Try seeking to 1 second first, then to target
    // This "warms up" the seek mechanism for some problematic files
    console.log('Workaround seek: warming up to 1s first');
    
    audioPlayer.currentTime = 1;
    
    const onWarmupSeeked = () => {
        console.log('Warmup seek complete, now seeking to target:', originalTarget);
        
        // Now try the real seek
        setTimeout(() => {
            audioPlayer.currentTime = originalTarget;
            
            const onFinalSeeked = () => {
                const actualTime = audioPlayer.currentTime;
                const seekDiff = Math.abs(actualTime - originalTarget);
                
                console.log('Workaround seek result - Target:', originalTarget, 'Actual:', actualTime, 'Diff:', seekDiff);
                
                // If still failing, just use a position early in the file
                if (seekDiff > 2) {
                    console.log('Workaround failed, using early position in file');
                    const earlyPosition = Math.min(5, audioPlayer.duration * 0.1);
                    audioPlayer.currentTime = earlyPosition;
                    gameState.currentStartTime = earlyPosition;
                } else {
                    gameState.currentStartTime = actualTime;
                }
                
                audioPlayer.play();
                gameState.isPlaying = true;
                playBtn.textContent = 'Pause';
                startSnippetTimer(durationMs);
            };
            
            // Timeout for final seek
            const finalTimeout = setTimeout(() => {
                console.log('Final seek timeout, using early position');
                const earlyPosition = Math.min(5, audioPlayer.duration * 0.1);
                audioPlayer.currentTime = earlyPosition;
                gameState.currentStartTime = earlyPosition;
                audioPlayer.play();
                gameState.isPlaying = true;
                playBtn.textContent = 'Pause';
                startSnippetTimer(durationMs);
            }, 300);
            
            audioPlayer.addEventListener('seeked', () => {
                clearTimeout(finalTimeout);
                onFinalSeeked();
            }, { once: true });
            
        }, 50); // Small delay after warmup
    };
    
    // Timeout for warmup
    const warmupTimeout = setTimeout(() => {
        console.log('Warmup seek timeout, trying direct seek');
        onWarmupSeeked();
    }, 300);
    
    audioPlayer.addEventListener('seeked', () => {
        clearTimeout(warmupTimeout);
        onWarmupSeeked();
    }, { once: true });
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

// Handle user's guess
function handleGuess(selectedSong) {
    if (gameState.isPlaying) {
        audioPlayer.pause();
        clearTimeout(gameState.snippetTimeout);
        clearInterval(gameState.timerInterval);
        gameState.isPlaying = false;
    }
    
    // Reset snippet state for next song
    gameState.currentStartTime = 0;
    gameState.snippetFinished = false;
    
    // Disable all buttons
    const optionBtns = optionsContainer.querySelectorAll('.option-btn');
    optionBtns.forEach(btn => btn.disabled = true);
    skipBtn.disabled = true;
    playBtn.disabled = true;
    playBtn.textContent = 'Play Snippet';
    
    const isCorrect = selectedSong.id === gameState.currentSong.id;
    
    if (isCorrect) {
        // Correct answer
        gameState.streak++;
        gameState.correctCount++;
        updateStats();
        
        // Highlight correct button
        optionBtns.forEach(btn => {
            if (btn.textContent === gameState.currentSong.title) {
                btn.classList.add('correct');
            }
        });
        
        showFeedback('correct', `Correct! ${gameState.currentSong.title}`);
        nextBtn.classList.remove('hidden');
    } else {
        // Wrong answer
        gameState.streak = 0;
        gameState.wrongCount++;
        updateStats();
        
        // Highlight buttons
        optionBtns.forEach(btn => {
            if (btn.textContent === selectedSong.title) {
                btn.classList.add('wrong');
            }
            if (btn.textContent === gameState.currentSong.title) {
                btn.classList.add('correct');
            }
        });
        
        showFeedback('wrong', `Wrong! The answer was: ${gameState.currentSong.title}`);
        nextBtn.classList.remove('hidden');
    }
}

// Skip button
skipBtn.addEventListener('click', () => {
    if (gameState.isPlaying) {
        audioPlayer.pause();
        clearTimeout(gameState.snippetTimeout);
        gameState.isPlaying = false;
    }
    
    // Reset snippet state for next song
    gameState.currentStartTime = 0;
    gameState.snippetFinished = false;
    
    // Disable all buttons
    const optionBtns = optionsContainer.querySelectorAll('.option-btn');
    optionBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === gameState.currentSong.title) {
            btn.classList.add('correct');
        }
    });
    skipBtn.disabled = true;
    playBtn.disabled = true;
    
    gameState.streak = 0;
    gameState.wrongCount++;
    updateStats();
    
    showFeedback('skipped', `Skipped! The answer was: ${gameState.currentSong.title}`);
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
}
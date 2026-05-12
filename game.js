const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const initialsScreen = document.getElementById('initials-screen');
const finalScoreDisplay = document.getElementById('final-score');
const startHighScoreDisplay = document.getElementById('start-high-score');
const gameOverHighScoreDisplay = document.getElementById('game-over-high-score');
const leaderboardList = document.getElementById('leaderboard-list');
const initialsInput = document.getElementById('initials-input');
const uploadStatus = document.getElementById('upload-status');
const newHighScoreDisplay = document.getElementById('new-high-score-display');

const API_URL = "https://script.google.com/macros/s/AKfycbxEcmKfj9-Tg5K9QlM1-LXAwycNaplQNBtrELz_qQt5LDkL27BmfntC-RnmNatfJPKs/exec";
let globalLeaderboard = [];

// Load high score from localStorage
let highScore = localStorage.getItem('terminalBirdHighScore') || 0;
if (startHighScoreDisplay) startHighScoreDisplay.textContent = highScore;

// Fetch Global Leaderboard
async function fetchLeaderboard() {
    try {
        const response = await fetch(API_URL + "?game=Flappy Birds");
        const data = await response.json();
        globalLeaderboard = data;
        
        leaderboardList.innerHTML = '';
        if (data.length === 0) {
            leaderboardList.innerHTML = '<li>NO SCORES YET</li>';
        } else {
            data.forEach(entry => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${entry.initials}</span> <span class="leaderboard-score">${entry.score}</span>`;
                leaderboardList.appendChild(li);
            });
        }
    } catch (e) {
        leaderboardList.innerHTML = '<li>ERROR LOADING DATA</li>';
    }
}
fetchLeaderboard();

// Game constants
const GRAVITY = 0.4;
const JUMP_STRENGTH = -7;
const PIPE_SPEED = 3;
const PIPE_WIDTH = 60;
const PIPE_GAP = 150;
const BIRD_SIZE = 24;

// Colors
const COLOR_GREEN = '#33ff00';
const COLOR_DARK = '#050505';

let bird = { x: 50, y: 300, velocity: 0 };
let pipes = [];
let score = 0;
let gameState = 'START'; // START, PLAYING, GAME_OVER
let frame = 0;

// 8-bit bird design (1 = green, 0 = transparent)
const birdSprite = [
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [1,1,1,1,1,0,1,1],
    [1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0]
];

function drawBird() {
    ctx.fillStyle = COLOR_GREEN;
    const pixelSize = BIRD_SIZE / 8; // 8x6 sprite roughly
    
    // Calculate rotation slightly based on velocity
    ctx.save();
    ctx.translate(bird.x + BIRD_SIZE/2, bird.y + BIRD_SIZE/2);
    let rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (bird.velocity * 0.1)));
    ctx.rotate(rotation);
    
    // Draw the sprite
    for (let r = 0; r < birdSprite.length; r++) {
        for (let c = 0; c < birdSprite[r].length; c++) {
            if (birdSprite[r][c] === 1) {
                // Add a little gap between "pixels" for effect
                ctx.fillRect(
                    c * pixelSize - BIRD_SIZE/2, 
                    r * pixelSize - BIRD_SIZE/2, 
                    pixelSize - 0.5, 
                    pixelSize - 0.5
                );
            }
        }
    }
    ctx.restore();
}

function drawPipes() {
    ctx.fillStyle = COLOR_GREEN;
    
    pipes.forEach(pipe => {
        // Draw top pipe
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
        
        // Draw bottom pipe
        let bottomPipeY = pipe.top + PIPE_GAP;
        let bottomPipeHeight = canvas.height - bottomPipeY;
        ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
        
        // Add "8-bit" styling/borders
        ctx.fillStyle = COLOR_DARK;
        ctx.fillRect(pipe.x + 5, 0, PIPE_WIDTH - 10, pipe.top - 5);
        ctx.fillRect(pipe.x + 5, bottomPipeY + 5, PIPE_WIDTH - 10, bottomPipeHeight - 5);
        ctx.fillStyle = COLOR_GREEN;
        
        // Inner fill pattern
        for (let i = 0; i < pipe.top; i += 20) {
            ctx.fillRect(pipe.x + 10, i, PIPE_WIDTH - 20, 2);
        }
        for (let i = bottomPipeY; i < canvas.height; i += 20) {
            ctx.fillRect(pipe.x + 10, i, PIPE_WIDTH - 20, 2);
        }
    });
}

function updatePipes() {
    // Spawn new pipe
    if (frame % 100 === 0) {
        let minHeight = 50;
        let maxHeight = canvas.height - PIPE_GAP - minHeight;
        let topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
        
        pipes.push({
            x: canvas.width,
            top: topHeight,
            passed: false
        });
    }

    // Move and remove pipes, update score
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= PIPE_SPEED;

        // Score update
        if (pipes[i].x + PIPE_WIDTH < bird.x && !pipes[i].passed) {
            score++;
            scoreDisplay.textContent = score;
            pipes[i].passed = true;
        }

        // Remove off-screen pipes
        if (pipes[i].x + PIPE_WIDTH < 0) {
            pipes.splice(i, 1);
        }
    }
}

function checkCollisions() {
    // Hit ground or ceiling
    if (bird.y + BIRD_SIZE >= canvas.height || bird.y <= 0) {
        endGame();
    }

    let hitbox = {
        x: bird.x + 4,
        y: bird.y + 4,
        width: BIRD_SIZE - 8,
        height: BIRD_SIZE - 8
    };

    pipes.forEach(pipe => {
        let bottomPipeY = pipe.top + PIPE_GAP;
        
        if (hitbox.x + hitbox.width > pipe.x && hitbox.x < pipe.x + PIPE_WIDTH) {
            if (hitbox.y < pipe.top || hitbox.y + hitbox.height > bottomPipeY) {
                endGame();
            }
        }
    });
}

function drawBackground() {
    // Clear with dark color
    ctx.fillStyle = COLOR_DARK;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw background binary noise
    ctx.fillStyle = 'rgba(51, 255, 0, 0.15)';
    ctx.font = "12px 'VT323', monospace";
    for(let i=0; i<40; i++) {
        let x = ((i * 137 + frame * 0.2) % canvas.width);
        let y = (i * 97) % canvas.height;
        ctx.fillText(i % 2 === 0 ? "1" : "0", x, y);
    }
}

function gameLoop() {
    if (gameState === 'PLAYING') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();

        bird.velocity += GRAVITY;
        bird.y += bird.velocity;

        updatePipes();
        checkCollisions();
        
        drawPipes();
        drawBird();
        
        frame++;
        requestAnimationFrame(gameLoop);
    } else if (gameState === 'START') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        drawBird();
        // Hover effect for bird
        bird.y = 300 + Math.sin(frame * 0.05) * 15;
        frame++;
        requestAnimationFrame(gameLoop);
    }
}

function jump() {
    if (gameState === 'PLAYING') {
        bird.velocity = JUMP_STRENGTH;
    } else if (gameState === 'START' || gameState === 'GAME_OVER') {
        startGame();
    }
}

function startGame() {
    bird = { x: 50, y: 300, velocity: 0 };
    pipes = [];
    score = 0;
    frame = 0;
    scoreDisplay.textContent = score;
    gameState = 'PLAYING';
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    initialsScreen.classList.add('hidden');
    
    gameLoop();
}

function endGame() {
    finalScoreDisplay.textContent = score;
    
    // High Score Logic
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('terminalBirdHighScore', highScore);
    }
    if (gameOverHighScoreDisplay) gameOverHighScoreDisplay.textContent = highScore;
    if (startHighScoreDisplay) startHighScoreDisplay.textContent = highScore;
    
    // Check if score makes it to the global leaderboard
    let isGlobalHighScore = false;
    if (score > 0) {
        if (globalLeaderboard.length < 3) {
            isGlobalHighScore = true;
        } else {
            // Check if score is greater than the lowest score in the top 3
            const lowestTopScore = globalLeaderboard[globalLeaderboard.length - 1].score;
            if (score > lowestTopScore) {
                isGlobalHighScore = true;
            }
        }
    }

    if (isGlobalHighScore) {
        gameState = 'INITIALS_INPUT';
        newHighScoreDisplay.textContent = score;
        initialsInput.value = '';
        uploadStatus.textContent = '';
        initialsInput.disabled = false;
        initialsScreen.classList.remove('hidden');
        setTimeout(() => initialsInput.focus(), 100);
    } else {
        gameState = 'GAME_OVER';
        gameOverScreen.classList.remove('hidden');
    }
    
    // Glitch effect on collision
    for(let i=0; i<30; i++) {
        let gx = Math.random() * canvas.width;
        let gy = Math.random() * canvas.height;
        let gw = Math.random() * 50 + 10;
        let gh = Math.random() * 10 + 2;
        ctx.fillStyle = 'rgba(51, 255, 0, 0.5)';
        ctx.fillRect(gx, gy, gw, gh);
    }
}

// Input listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
        // Don't jump if they are typing initials
        if (gameState !== 'INITIALS_INPUT') {
            jump();
            e.preventDefault(); 
        }
    }
});

initialsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && initialsInput.value.trim().length > 0) {
        uploadStatus.textContent = 'UPLOADING...';
        initialsInput.disabled = true;
        
        let payload = {
            game: "Flappy Birds",
            initials: initialsInput.value.toUpperCase().substring(0, 15),
            score: score
        };

        fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        }).then(() => {
            // Because no-cors is opaque, we just assume success and refetch
            fetchLeaderboard().then(() => {
                initialsScreen.classList.add('hidden');
                gameOverScreen.classList.remove('hidden');
                gameState = 'GAME_OVER';
            });
        }).catch(err => {
            uploadStatus.textContent = 'ERROR UPLOADING';
            initialsInput.disabled = false;
        });
    }
});

// Using click on the entire window instead of just canvas/game container
window.addEventListener('mousedown', (e) => {
    if (e.target !== initialsInput && gameState !== 'INITIALS_INPUT') {
        jump();
    }
});
window.addEventListener('touchstart', (e) => {
    if (e.target !== initialsInput && gameState !== 'INITIALS_INPUT') {
        jump();
        e.preventDefault();
    }
}, {passive: false});

// Kick off
gameState = 'START';
requestAnimationFrame(gameLoop);

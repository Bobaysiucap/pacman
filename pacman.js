// Cấu hình kích thước ô và bản đồ
const rowCount = 21;
const columnCount = 19;
const tileSize = 32;
const boardWidth = columnCount * tileSize;
const boardHeight = rowCount * tileSize;
// con chó lẻm ko test trên mb!!!
const controlPanel = document.getElementById("controlPanel")
let isMobile = false
// fak u
const screen = {
    width: window.innerWidth,
    height: window.innerHeight
}
let scaleRatio = 1
let board;
let context;
// === HỆ THỐNG ÂM THANH — KHÔNG CẦN FILE NGOÀI ===
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
// Tạo tiếng ngắn
function playTone(freq, duration, type = 'sine', endFreq = null) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (endFreq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
  }
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
}
// Tiếng ăn đồ ăn
function playEatSound() { playTone(440, 0.08, 'sine', 880); }
// Tiếng va chạm cảnh sát
function playHitSound() { playTone(200, 0.2, 'sawtooth', 80); }
// Tiếng thắng
function playWinSound() { 
  setTimeout(() => playTone(523, 0.15), 0);
  setTimeout(() => playTone(659, 0.15), 150);
  setTimeout(() => playTone(784, 0.25), 300);
}
// Tiếng thua
function playLoseSound() { playTone(400, 0.15, 'triangle', 100); }


// Hình ảnh Tường
let wallImage;

// Hướng di chuyển
const directions = ['U', 'D', 'L', 'R'];

// --- CÁC BẢN ĐỒ CHUẨN (Chỉ còn Map 1 và Map 2) ---
const map1 = [
    "XXXXXXXXXXXXXXXXXXX",
    "X        X        X",
    "X XX XXX X XXX XX X",
    "X                 X",
    "X XX X XXXXX X XX X",
    "X    X   X   X    X",
    "XXXX XXX X XXX XXXX",
    "OOOX X       X XOOO",
    "XXXX X r b p X XXXX",
    "X      X o X      X",
    "XXXX X XXXXX X XXXX",
    "OOOX X       X XOOO",
    "XXXX X XXXXX X XXXX",
    "X        X        X",
    "X XX XXX X XXX XX X",
    "X  X     P     X  X",
    "XX X X XXXXX X X XX",
    "X    X   X   X    X",
    "X XXXXXX X XXXXXX X",
    "X                 X",
    "XXXXXXXXXXXXXXXXXXX"
];

const map2 = [
    "XXXXXXXXXXXXXXXXXXX",
    "X                 X",
    "X XX XXX X XXX XX X",
    "X X               X",
    "X X X XXXXXXX X X X",
    "X   X         X   X",
    "XXX X X r b X X XXX",
    "X     X p o X     X",
    "XXX X XXXXXXX X XXX",
    "X   X         X   X",
    "X X X XXXXXXX X X X",
    "X X             X X",
    "X   X XX P XX X   X",
    "XXXXX X     X XXXXX",
    "X     X XXX X     X",
    "X XXX X     X XXX X",
    "X   X XXXXXXX X   X",
    "X X X         X X X",
    "X X XXXXXXXXXXX X X",
    "X                 X",
    "XXXXXXXXXXXXXXXXXXX"
];

const maps = [map1, map2];
let currentMapIndex = 0;

// Cấu hình icon theo từng Map
const mapThemes = [
    { player: "🐶", food: "🦴", enemy: "👮", name: "SỦA VÀ CHẠY" },
    { player: " 🐭", food: " 🧀", enemy: " 🐱", name: "BẮT TÔI ĐI, MÈO!" }
];

// Lớp Block đại diện cho Nhân vật
class Block {
    constructor(image, x, y, width, height) {
        this.image = image;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.startX = x;
        this.startY = y;
        this.direction = 'R';
        this.velocityX = 0;
        this.velocityY = 0;
    }

    updateDirection(dir) {
        let prevDir = this.direction;
        this.direction = dir;
        this.updateVelocity();
        
        this.x += this.velocityX;
        this.y += this.velocityY;

        for (let wall of walls) {
            if (collision(this, wall)) {
                this.x -= this.velocityX;
                this.y -= this.velocityY;
                this.direction = prevDir;
                this.updateVelocity();
                return false;
            }
        }
        return true;
    }

    updateVelocity() {
        if (this.direction === 'U') {
            this.velocityX = 0;
            this.velocityY = -tileSize / 4;
        } else if (this.direction === 'D') {
            this.velocityX = 0;
            this.velocityY = tileSize / 4;
        } else if (this.direction === 'L') {
            this.velocityX = -tileSize / 4;
            this.velocityY = 0;
        } else if (this.direction === 'R') {
            this.velocityX = tileSize / 4;
            this.velocityY = 0;
        }
    }

    reset() {
        this.x = this.startX;
        this.y = this.startY;
    }
}

// Trạng thái Trò chơi
let walls = new Set();
let foods = new Set();
let ghosts = new Set();
let pacman;

let score = 0;
let lives = 3;
let gameOver = false;
let gameWon = false;
let inMenu = true;
let effectIcons = [];

const mapButtons = [
    { id: 0, name: mapThemes[0].name, x: 140, y: 240, w: 320, h: 50 },
    { id: 1, name: mapThemes[1].name, x: 140, y: 310, w: 320, h: 50 }
];

window.onload = function () {
    board = document.getElementById("board");
    board.width = boardWidth;
    board.height = boardHeight;
    const safeFactor = 0.95
    // fix mobile cho con lẻm 🙏
    if(screen.width <= screen.height){
        scaleRatio = screen.width/board.width*safeFactor
        board.style.scale = `${scaleRatio}`
        isMobile = true
        controlPanel.style.display = "flex"
    } else{
        scaleRatio = screen.height/board.height*safeFactor
        board.style.scale = `${scaleRatio}`
        controlPanel.style.display = "none"
    }
    context = board.getContext("2d");

    loadImages();
    loadMap();

    document.addEventListener("keyup", movePacman);
    board.addEventListener("click", handleMenuClick);

    update();
};

function loadImages() {
    wallImage = new Image(); wallImage.src = "./wall.png";
}

function loadMap() {
    walls.clear();
    foods.clear();
    ghosts.clear();

    let currentTileMap = maps[currentMapIndex];

    for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < columnCount; c++) {
            let char = currentTileMap[r][c];
            let x = c * tileSize;
            let y = r * tileSize;

            if (char === 'X') {
                walls.add(new Block(wallImage, x, y, tileSize, tileSize));
            } else if (char === 'b' || char === 'o' || char === 'p' || char === 'r') {
                ghosts.add(new Block(null, x, y, tileSize, tileSize));
            } else if (char === 'P') {
                pacman = new Block(null, x, y, tileSize, tileSize);
            } else if (char === ' ') {
                foods.add(new Block(null, x + 8, y + 8, 16, 16));
            }
        }
    }

    for (let ghost of ghosts) {
        ghost.direction = 'U';
        ghost.updateVelocity();
    }
}

function generateLineEffects(count) {
    effectIcons = [];
    const stepX = 85;
    const totalWidth = (count - 1) * stepX;
    const startX = (boardWidth - totalWidth) / 2;
    const startY = boardHeight / 2 + 50;

    for (let i = 0; i < count; i++) {
        effectIcons.push({
            x: startX + (i * stepX),
            y: startY
        });
    }
}

function update() {
    if (!inMenu && !gameOver && !gameWon) {
        move();
    }
    draw();
    setTimeout(update, 50);
}

function getOppositeDirection(dir) {
    if (dir === 'U') return 'D';
    if (dir === 'D') return 'U';
    if (dir === 'L') return 'R';
    if (dir === 'R') return 'L';
    return 'U';
}

function move() {
    if (!pacman) return;

    pacman.x += pacman.velocityX;
    pacman.y += pacman.velocityY;

    for (let wall of walls) {
        if (collision(pacman, wall)) {
            pacman.x -= pacman.velocityX;
            pacman.y -= pacman.velocityY;
            break;
        }
    }

    // Ăn mục tiêu
    let foodEaten = null;
    for (let food of foods) {
        if (collision(pacman, food)) {
            foodEaten = food;
            score += 10;
            break;
        }
    }
    if (foodEaten) foods.delete(foodEaten);

    if (foods.size === 0) {
        if (currentMapIndex < maps.length - 1) {
            currentMapIndex++;
            loadMap();
            resetPositions();
        } else {
            gameWon = true;
            generateLineEffects(7);
            return;
        }
    }

    // Di chuyển Kẻ địch
    for (let ghost of ghosts) {
        ghost.x += ghost.velocityX;
        ghost.y += ghost.velocityY;

        let hasCollision = false;
        for (let wall of walls) {
            if (collision(ghost, wall)) {
                hasCollision = true;
                break;
            }
        }

        if (hasCollision || ghost.x <= 0 || ghost.x + ghost.width >= boardWidth) {
            ghost.x -= ghost.velocityX;
            ghost.y -= ghost.velocityY;

            let possibleDirections = [];
            for (let d of directions) {
                let testX = ghost.x;
                let testY = ghost.y;
                let step = tileSize / 4;

                if (d === 'U') testY -= step;
                else if (d === 'D') testY += step;
                else if (d === 'L') testX -= step;
                else if (d === 'R') testX += step;

                let hit = false;
                for (let wall of walls) {
                    if (collision({ x: testX, y: testY, width: ghost.width, height: ghost.height }, wall)) {
                        hit = true;
                        break;
                    }
                }
                if (!hit) possibleDirections.push(d);
            }

            if (possibleDirections.length > 0) {
                let filtered = possibleDirections.filter(d => d !== getOppositeDirection(ghost.direction));
                if (filtered.length > 0) {
                    ghost.direction = filtered[Math.floor(Math.random() * filtered.length)];
                } else {
                    ghost.direction = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
                }
            } else {
                ghost.direction = getOppositeDirection(ghost.direction);
            }
            ghost.updateVelocity();
        }

        if (collision(ghost, pacman)) {
            lives -= 1;
            if (lives === 0) {
                gameOver = true;
                generateLineEffects(6);
                return;
            }
            resetPositions();
        }
    }
}

function drawSafeImage(img, x, y, width, height, fallbackColor) {
    if (img && img.complete && img.naturalWidth !== 0) {
        context.drawImage(img, x, y, width, height);
    } else {
        context.fillStyle = fallbackColor;
        context.fillRect(x, y, width, height);
    }
}

function draw() {
    context.clearRect(0, 0, board.width, board.height);

    if (inMenu) {
        drawMenu();
        return;
    }

    let theme = mapThemes[currentMapIndex];

    // Vẽ Tường
    for (let wall of walls) {
        drawSafeImage(wall.image, wall.x, wall.y, wall.width, wall.height, "blue");
    }

    // Căn chuẩn vị trí Emoji ở tâm các ô
    context.textAlign = "center";
    context.textBaseline = "middle";

    // 1. VẼ THỨC ĂN
    context.font = "18px sans-serif";
    for (let food of foods) {
        context.fillText(theme.food, food.x + food.width / 2, food.y + food.height / 2);
    }

    // 2. VẼ NGƯỜI CHƠI
    if (pacman) {
        context.font = "22px sans-serif";
        context.fillText(theme.player, pacman.x + pacman.width / 2, pacman.y + pacman.height / 2);
    }

    // 3. VẼ KẺ ĐỊCH
    context.font = "22px sans-serif";
    for (let ghost of ghosts) {
        context.fillText(theme.enemy, ghost.x + ghost.width / 2, ghost.y + ghost.height / 2);
    }

    // Hiển thị Điểm và Mạng
    context.fillStyle = "white";
    context.font = "14px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    
    if (gameOver) {
        context.fillStyle = "red";
        context.font = "bold 22px sans-serif";
        context.textAlign = "center";
        context.fillText("GAME OVER: " + score, boardWidth / 2, boardHeight / 2 - 80);
        context.font = "16px sans-serif";
        context.fillStyle = "white";
        context.fillText("(Bấm phím bất kỳ để về Menu)", boardWidth / 2, boardHeight / 2 - 50);

        context.font = "120px sans-serif";
        context.textAlign = "center";
        for (let pos of effectIcons) {
            context.fillText("🐔", pos.x, pos.y);
        }
    } else if (gameWon) {
        context.fillStyle = "yellow";
        context.font = "bold 22px sans-serif";
        context.textAlign = "center";
        context.fillText("CHIẾN THẮNG! SCORE: " + score, boardWidth / 2, boardHeight / 2 - 80);
        context.font = "16px sans-serif";
        context.fillStyle = "white";
        context.fillText("(Bấm phím bất kỳ để về Menu)", boardWidth / 2, boardHeight / 2 - 50);

        context.font = "120px sans-serif";
        context.textAlign = "center";
        for (let pos of effectIcons) {
            context.fillText("🐍", pos.x, pos.y);
        }
    } else {
        context.fillText("LIVES: " + lives + "  SCORE: " + score + "  MAP: " + (currentMapIndex + 1), tileSize / 2, tileSize / 2);
    }
}

function drawMenu() {
    context.textBaseline = "alphabetic";
    context.fillStyle = "yellow";
    context.font = "bold 32px sans-serif";
    context.textAlign = "center";
    context.fillText("RUNMALS", boardWidth / 2, 120);

    context.fillStyle = "white";
    context.font = "16px sans-serif";
    context.fillText("CHỌN MAP ĐỂ BẮT ĐẦU", boardWidth / 2, 170);
    context.fillText("(Click chuột hoặc bấm phím 1, 2)", boardWidth / 2, 195);

    context.textAlign = "center";
    for (let btn of mapButtons) {
        context.fillStyle = (currentMapIndex === btn.id) ? "#3333ff" : "#111188";
        context.fillRect(btn.x, btn.y, btn.w, btn.h);
        
        context.strokeStyle = "white";
        context.lineWidth = 2;
        context.strokeRect(btn.x, btn.y, btn.w, btn.h);

        context.fillStyle = "white";
        context.font = "bold 16px sans-serif";
        context.fillText(btn.name, btn.x + btn.w / 2, btn.y + 32);
    }

    context.textAlign = "left";
}

function startGameWithMap(mapIdx) {
    currentMapIndex = mapIdx;
    inMenu = false;
    gameOver = false;
    gameWon = false;
    lives = 3;
    score = 0;

    loadMap();
    resetPositions();
}

function handleMenuClick(e) {
    if (!inMenu) return;

    const rect = board.getBoundingClientRect();

    const scaleX = board.width / rect.width;
    const scaleY = board.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    for (let btn of mapButtons) {
        if (
            mouseX >= btn.x &&
            mouseX <= btn.x + btn.w &&
            mouseY >= btn.y &&
            mouseY <= btn.y + btn.h
        ) {
            startGameWithMap(btn.id);
            break;
        }
    }
}

const keys = {
    UP: "ArrowUp",
    RIGHT: "ArrowRight",
    LEFT: "ArrowLeft",
    DOWN: "ArrowDown"
}
function movePacman(e) {
    if (inMenu) {
        if (e.code === "Digit1" || e.code === "Numpad1") startGameWithMap(0);
        else if (e.code === "Digit2" || e.code === "Numpad2") startGameWithMap(1);
        return;
    }

    if (gameOver || gameWon) {
        inMenu = true;
        gameOver = false;
        gameWon = false;
        return;
    }

    if (!pacman) return;

    if (e.code === "ArrowUp" || e.code === "KeyW") pacman.updateDirection('U');
    else if (e.code === "ArrowDown" || e.code === "KeyS") pacman.updateDirection('D');
    else if (e.code === "ArrowLeft" || e.code === "KeyA") pacman.updateDirection('L');
    else if (e.code === "ArrowRight" || e.code === "KeyD") pacman.updateDirection('R');
}

function collision(a, b) {
    if (!a || !b) return false;
    return a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
}

function resetPositions() {
    if (pacman) {
        pacman.reset();
        pacman.velocityX = 0;
        pacman.velocityY = 0;
    }

    for (let ghost of ghosts) {
        ghost.reset();
        ghost.direction = 'U';
        ghost.updateVelocity();
    }
}
// Thêm nút bấm cho mobile, haizzzzz con lẻm dùng AI copy paste còn mình thì ngồi sửa cho nó 😔🤘
const keysArray = document.querySelectorAll(".k")
for (let i = 0; i < keysArray.length; i++){
    keysArray[i].addEventListener("pointerdown", ()=>{
        let param={
            code: keys[keysArray[i].id],
        }
        movePacman(param)
    })
}

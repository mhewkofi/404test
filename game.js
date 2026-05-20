const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const homeButton = document.querySelector("#homeButton");
const swatchesEl = document.querySelector("#swatches");

const COLORS = {
  bg: "#C7DCFA",
  ground: "#F4EFE8",
  card: "#FFFFFF",
  input: "#F8F7F7",
  ink: "#202020",
  muted: "#77736F",
  player: ["#FFFFFF", "#EDE6DD", "#E0DBD9"],
};

const PLAYER_FRAME_PATHS = Array.from(
  { length: 50 },
  (_, index) => `assets/character/Character2-2_${String(index + 10).padStart(5, "0")}.png`,
);
const PLAYER_FRAMES = PLAYER_FRAME_PATHS.map((src) => {
  const image = new Image();
  image.src = src;
  image.onload = draw;
  return image;
});

const state = {
  running: false,
  gameOver: false,
  score: 0,
  speed: 6,
  spawnTimer: 0,
  shake: 0,
  particles: [],
  obstacles: [],
  lastTime: 0,
  animTime: 0,
};

const player = {
  x: 86,
  y: 0,
  width: 110,
  height: 132,
  vy: 0,
  gravity: 0.92,
  jumpPower: -17.2,
  colorIndex: 0,
  grounded: false,
};

const ground = {
  y: 420,
  height: 3,
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ground.y = rect.height * 0.78;
  player.y = Math.min(player.y || ground.y - player.height, ground.y - player.height);
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpHex(a, b, t) {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  const r = Math.round(lerp(from.r, to.r, t));
  const g = Math.round(lerp(from.g, to.g, t));
  const blue = Math.round(lerp(from.b, to.b, t));
  return `rgb(${r}, ${g}, ${blue})`;
}

function currentColor() {
  return COLORS.player[player.colorIndex];
}

function playerCenter() {
  return {
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
  };
}

function playerHitbox() {
  return {
    x: player.x + player.width * 0.28,
    y: player.y + player.height * 0.2,
    width: player.width * 0.46,
    height: player.height * 0.72,
  };
}

function currentPlayerFrame() {
  const readyFrames = PLAYER_FRAMES.filter((image) => image.complete && image.naturalWidth > 0);
  if (!readyFrames.length) {
    return null;
  }
  return readyFrames[Math.floor(state.animTime) % readyFrames.length];
}

function createSwatches() {
  swatchesEl.innerHTML = "";
  COLORS.player.forEach((color, index) => {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.color = color;
    swatch.style.background = color;
    swatch.dataset.index = String(index);
    swatchesEl.appendChild(swatch);
  });
}

function updateSwatches() {
  document.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.classList.toggle("active", Number(swatch.dataset.index) === player.colorIndex);
  });
}

function resetGame() {
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.speed = 6;
  state.spawnTimer = 58;
  state.shake = 0;
  state.particles = [];
  state.obstacles = [];
  state.animTime = 0;
  player.y = ground.y - player.height;
  player.vy = 0;
  player.colorIndex = 0;
  player.grounded = true;
  overlay.classList.remove("is-result");
  overlay.classList.add("is-hidden");
  homeButton.hidden = true;
  updateSwatches();
}

function showHome() {
  state.running = false;
  state.gameOver = false;
  state.score = 0;
  state.speed = 6;
  state.spawnTimer = 0;
  state.shake = 0;
  state.particles = [];
  state.obstacles = [];
  state.animTime = 0;
  player.y = ground.y - player.height;
  player.vy = 0;
  player.colorIndex = 0;
  player.grounded = true;
  scoreEl.textContent = "0000";
  overlay.querySelector("h1").textContent = "The Spectrum Runner";
  overlay.querySelector("p").textContent = "Jump the wrong colors. Phase through the matching ones.";
  startButton.textContent = "Start Run";
  homeButton.hidden = true;
  overlay.classList.remove("is-result", "is-hidden");
  updateSwatches();
}

function jump() {
  if (!state.running) {
    resetGame();
    return;
  }

  if (player.grounded) {
    player.vy = player.jumpPower;
    player.grounded = false;
  }
}

function burst(x, y, color, amount = 22) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.6 + Math.random() * 5.8;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 4,
      life: 1,
      color,
    });
  }
}

function shiftColor(direction = 1) {
  if (!state.running) {
    resetGame();
    return;
  }

  player.colorIndex =
    (player.colorIndex + direction + COLORS.player.length) % COLORS.player.length;
  state.shake = 8;
  const center = playerCenter();
  burst(center.x, center.y, currentColor(), 26);
  updateSwatches();
}

function spawnObstacle() {
  const colorIndex = Math.floor(Math.random() * COLORS.player.length);
  const isGate = Math.random() > 0.34;
  const height = isGate ? 66 : 38 + Math.random() * 42;

  state.obstacles.push({
    x: canvas.clientWidth + 30,
    y: ground.y - height,
    width: isGate ? 32 : 24 + Math.random() * 20,
    height,
    colorIndex,
    color: COLORS.player[colorIndex],
    isGate,
    passed: false,
  });

  state.spawnTimer = Math.max(46, 92 - state.speed * 3 + Math.random() * 34);
}

function updatePlayer() {
  player.vy += player.gravity;
  player.y += player.vy;

  const floor = ground.y - player.height;
  if (player.y >= floor) {
    player.y = floor;
    player.vy = 0;
    player.grounded = true;
  }
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function updateObstacles() {
  state.spawnTimer -= 1;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
  }

  state.obstacles.forEach((obstacle) => {
    obstacle.x -= state.speed;

    const hitbox = playerHitbox();

    if (!obstacle.passed && obstacle.x + obstacle.width < hitbox.x) {
      obstacle.passed = true;
      state.score += obstacle.isGate ? 42 : 25;
    }

    if (rectsOverlap(hitbox, obstacle)) {
      const matchingColor = player.colorIndex === obstacle.colorIndex;
      if (matchingColor) {
        obstacle.alpha = 0.2;
        if (!obstacle.phaseBurst) {
          obstacle.phaseBurst = true;
          burst(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, obstacle.color, 14);
        }
      } else {
        endGame();
      }
    }
  });

  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x > -80);
}

function updateParticles() {
  state.particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.08;
    particle.life -= 0.026;
  });
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function updateEffects() {
  state.shake = Math.max(0, state.shake - 0.55);
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  state.shake = 14;
  const center = playerCenter();
  burst(center.x, center.y, currentColor(), 46);
  overlay.querySelector("p").textContent = `Score ${Math.floor(state.score).toString().padStart(4, "0")}`;
  startButton.textContent = "Run Again";
  homeButton.hidden = false;
  overlay.classList.add("is-result");
  overlay.classList.remove("is-hidden");
}

function drawBackground(width, height) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 89 - (state.score * 0.8) % 89) % (width + 80);
    const y = 40 + ((i * 53) % Math.max(80, height - 160));
    ctx.fillStyle = COLORS.card;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

function drawGround(width, height) {
  const floorHeight = height - ground.y;
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, ground.y, width, floorHeight);

  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, ground.y, width, ground.height);
  ctx.restore();
}

function drawPlayer(offsetX = 0, alpha = 1, color = currentColor(), frame = currentPlayerFrame()) {
  ctx.save();
  ctx.globalAlpha = alpha;

  if (frame) {
    ctx.drawImage(frame, player.x + offsetX, player.y, player.width, player.height);
    ctx.restore();
    return;
  }

  ctx.fillStyle = color;
  ctx.fillRect(player.x + offsetX, player.y, player.width * 0.8, player.height * 0.82);
  ctx.restore();
}

function drawObstacles() {
  state.obstacles.forEach((obstacle) => {
    ctx.save();
    ctx.globalAlpha = obstacle.alpha || 1;
    ctx.strokeStyle = COLORS.ink;
    ctx.fillStyle = obstacle.isGate ? COLORS.input : obstacle.color;
    ctx.lineWidth = 4;

    if (obstacle.isGate) {
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.fillStyle = obstacle.color;
      ctx.strokeStyle = COLORS.ink;
      ctx.fillRect(obstacle.x - 4, obstacle.y, obstacle.width + 8, 8);
      ctx.fillRect(obstacle.x - 4, obstacle.y + obstacle.height - 8, obstacle.width + 8, 8);
      ctx.strokeRect(obstacle.x - 4, obstacle.y, obstacle.width + 8, 8);
      ctx.strokeRect(obstacle.x - 4, obstacle.y + obstacle.height - 8, obstacle.width + 8, 8);
    } else {
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.fillRect(obstacle.x - 7, obstacle.y + obstacle.height - 18, 10, 18);
      ctx.fillRect(obstacle.x + obstacle.width - 3, obstacle.y + 16, 10, 18);
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    ctx.restore();
  });
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake ? (Math.random() - 0.5) * state.shake : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground(width, height);
  drawGround(width, height);
  drawObstacles();

  drawPlayer();
  drawParticles();
  ctx.restore();
}

function update() {
  if (!state.running) {
    updateParticles();
    updateEffects();
    draw();
    return;
  }

  state.score += 0.18 * state.speed;
  state.speed = Math.min(14, 6 + state.score / 420);
  state.animTime += 0.34 + state.speed * 0.025;
  updatePlayer();
  updateObstacles();
  updateParticles();
  updateEffects();
  scoreEl.textContent = Math.floor(state.score).toString().padStart(4, "0");
  draw();
}

function loop(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }
  update();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowUp" || event.code === "KeyW") {
    event.preventDefault();
    jump();
  }

  if (event.code === "Space") {
    event.preventDefault();
    shiftColor(1);
  }

  if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
    event.preventDefault();
    shiftColor(-1);
  }

  if (event.code === "KeyR") {
    event.preventDefault();
    resetGame();
  }
});

startButton.addEventListener("click", resetGame);
homeButton.addEventListener("click", showHome);

createSwatches();
resizeCanvas();
updateSwatches();
draw();
requestAnimationFrame(loop);

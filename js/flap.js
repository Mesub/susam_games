/* ==========================================================================
   Flap — a one-button flyer. Canvas only, no assets.
   ========================================================================== */
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");

const BEST_KEY = "susamGames.flap.best";
let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best;

const css = getComputedStyle(document.documentElement);
const C = (n) => css.getPropertyValue(n).trim();

const GRAVITY = 0.42;
const FLAP = -7;
const PIPE_W = 60;
const GAP = 140;
const SPEED = 2.4;
const GROUND = 40;

let bird, pipes, score, spawnTimer, running, wingT;

function reset() {
  bird = { x: 110, y: H / 2, v: 0, r: 13 };
  pipes = [];
  score = 0;
  scoreEl.textContent = "0";
  spawnTimer = 0;
  wingT = 0;
  running = false;
}

function start() {
  reset();
  running = true;
  bird.v = FLAP;
  overlay.classList.add("hidden");
}

function flap() {
  if (!running) { start(); return; }
  bird.v = FLAP;
  wingT = 0;
}

function gameOver() {
  running = false;
  if (score > best) {
    best = score; localStorage.setItem(BEST_KEY, String(best)); bestEl.textContent = best;
    ovTitle.textContent = "New Best! 🏆";
    ovText.textContent = `You cleared ${score} pipes — a record. Fly again?`;
  } else {
    ovTitle.textContent = "Splat! 🐤";
    ovText.textContent = `You cleared ${score} pipes. Best is ${best}. Try again?`;
  }
  startBtn.textContent = "▶ Play Again";
  overlay.classList.remove("hidden");
}

function spawnPipe() {
  const margin = 50;
  const gapY = margin + Math.random() * (H - GROUND - GAP - margin * 2);
  pipes.push({ x: W, gapY, passed: false });
}

function update() {
  if (!running) return;
  wingT += 0.3;

  bird.v += GRAVITY;
  bird.y += bird.v;

  spawnTimer--;
  if (spawnTimer <= 0) { spawnPipe(); spawnTimer = 95; }

  for (const p of pipes) {
    p.x -= SPEED;
    if (!p.passed && p.x + PIPE_W < bird.x) {
      p.passed = true;
      score++;
      scoreEl.textContent = score;
    }
    // collision
    const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;
    const inGap = bird.y - bird.r > p.gapY && bird.y + bird.r < p.gapY + GAP;
    if (inX && !inGap) return gameOver();
  }
  pipes = pipes.filter((p) => p.x + PIPE_W > -10);

  if (bird.y + bird.r > H - GROUND) { bird.y = H - GROUND - bird.r; return gameOver(); }
  if (bird.y - bird.r < 0) { bird.y = bird.r; bird.v = 0; }
}

function draw() {
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#12234a");
  g.addColorStop(1, C("--bg-soft"));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // pipes
  for (const p of pipes) {
    ctx.fillStyle = C("--good");
    ctx.beginPath(); ctx.roundRect(p.x, 0, PIPE_W, p.gapY, 6); ctx.fill();
    ctx.beginPath(); ctx.roundRect(p.x, p.gapY + GAP, PIPE_W, H - GROUND - (p.gapY + GAP), 6); ctx.fill();
  }

  // ground
  ctx.fillStyle = C("--panel-solid");
  ctx.fillRect(0, H - GROUND, W, GROUND);
  ctx.strokeStyle = C("--border");
  ctx.beginPath(); ctx.moveTo(0, H - GROUND); ctx.lineTo(W, H - GROUND); ctx.stroke();

  // bird
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(Math.max(-0.5, Math.min(1.0, bird.v * 0.06)));
  ctx.fillStyle = C("--gold");
  ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, Math.PI * 2); ctx.fill();
  // wing
  ctx.fillStyle = "#c99b1f";
  const wing = Math.sin(wingT) * 5;
  ctx.beginPath(); ctx.ellipse(-3, 2 + wing, 7, 4, -0.4, 0, Math.PI * 2); ctx.fill();
  // eye + beak
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(5, -4, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(6, -4, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C("--neon-3");
  ctx.beginPath(); ctx.moveTo(bird.r - 2, -1); ctx.lineTo(bird.r + 6, 1); ctx.lineTo(bird.r - 2, 4); ctx.fill();
  ctx.restore();
}

function loop() {
  requestAnimationFrame(loop);
  update();
  draw();
}

// ---- input --------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") { flap(); e.preventDefault(); }
});
canvas.addEventListener("mousedown", flap);
canvas.addEventListener("touchstart", (e) => { flap(); e.preventDefault(); }, { passive: false });
startBtn.addEventListener("click", (e) => { e.stopPropagation(); start(); });

reset();
loop();

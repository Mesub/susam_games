/* ==========================================================================
   Brick Breaker — a compact Breakout. Canvas only, no assets.
   ========================================================================== */
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const bestEl = document.getElementById("best");

const BEST_KEY = "susamGames.breakout.best";
let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best;

const css = getComputedStyle(document.documentElement);
const C = (n) => css.getPropertyValue(n).trim();

const COLS = 10, ROWS = 6, PAD = 6;
const bw = (W - (COLS + 1) * PAD) / COLS;
const bh = 18;
const brickColors = ["--neon-3", "--gold", "--neon-2", "--neon", "--good", "--neon-2"];

let paddle, ball, bricks, score, lives, running;

function buildBricks() {
  bricks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      bricks.push({
        x: PAD + c * (bw + PAD),
        y: 48 + r * (bh + PAD),
        alive: true,
        color: C(brickColors[r % brickColors.length]),
      });
    }
  }
}

function resetBall() {
  ball = { x: W / 2, y: H - 60, r: 7, vx: 3.2 * (Math.random() < 0.5 ? -1 : 1), vy: -3.6 };
  paddle.x = W / 2 - paddle.w / 2;
}

function reset() {
  paddle = { x: W / 2 - 45, y: H - 24, w: 90, h: 12, speed: 7, left: false, right: false };
  score = 0; lives = 3;
  scoreEl.textContent = "0";
  livesEl.textContent = "3";
  buildBricks();
  resetBall();
  running = false;
}

function start() {
  reset();
  running = true;
  overlay.classList.add("hidden");
}

function endGame(win) {
  running = false;
  if (score > best) { best = score; localStorage.setItem(BEST_KEY, String(best)); bestEl.textContent = best; }
  ovTitle.textContent = win ? "You cleared it! 🏆" : "Game Over 🎯";
  ovText.textContent = win
    ? `Every brick smashed — final score ${score}. Go for a higher run?`
    : `Final score ${score}. Best is ${best}. Try again?`;
  startBtn.textContent = "▶ Play Again";
  overlay.classList.remove("hidden");
}

function update() {
  if (!running) return;

  if (paddle.left) paddle.x -= paddle.speed;
  if (paddle.right) paddle.x += paddle.speed;
  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx *= -1; }
  if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx *= -1; }
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; }

  // paddle bounce
  if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 6 &&
      ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
    const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1..1
    const speed = Math.min(6.5, Math.hypot(ball.vx, ball.vy) + 0.06);
    const angle = hit * (Math.PI / 3);           // up to 60°
    ball.vx = speed * Math.sin(angle);
    ball.vy = -Math.abs(speed * Math.cos(angle));
  }

  // brick collisions
  for (const b of bricks) {
    if (!b.alive) continue;
    if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + bw &&
        ball.y + ball.r > b.y && ball.y - ball.r < b.y + bh) {
      b.alive = false;
      score += 10;
      scoreEl.textContent = score;
      // reflect on the shallower overlap axis
      const overlapX = Math.min(ball.x + ball.r - b.x, b.x + bw - (ball.x - ball.r));
      const overlapY = Math.min(ball.y + ball.r - b.y, b.y + bh - (ball.y - ball.r));
      if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
      break;
    }
  }

  if (bricks.every((b) => !b.alive)) return endGame(true);

  // fell below
  if (ball.y - ball.r > H) {
    lives--;
    livesEl.textContent = lives;
    if (lives <= 0) return endGame(false);
    resetBall();
  }
}

function draw() {
  ctx.fillStyle = C("--bg-soft");
  ctx.fillRect(0, 0, W, H);

  for (const b of bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, bw, bh, 4); ctx.fill();
  }

  ctx.fillStyle = C("--ink");
  ctx.beginPath(); ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6); ctx.fill();

  ctx.fillStyle = C("--gold");
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
}

function loop() {
  requestAnimationFrame(loop);
  update();
  draw();
}

// ---- input --------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") { paddle.left = true; e.preventDefault(); }
  else if (e.code === "ArrowRight" || e.code === "KeyD") { paddle.right = true; e.preventDefault(); }
  else if ((e.code === "Space" || e.code === "Enter") && !running) { start(); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") paddle.left = false;
  else if (e.code === "ArrowRight" || e.code === "KeyD") paddle.right = false;
});
startBtn.addEventListener("click", start);

function pointerTo(clientX) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (W / rect.width);
  paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
}
canvas.addEventListener("mousemove", (e) => { if (running) pointerTo(e.clientX); });
canvas.addEventListener("touchmove", (e) => { if (running) { pointerTo(e.touches[0].clientX); e.preventDefault(); } }, { passive: false });
canvas.addEventListener("touchstart", (e) => { if (running) pointerTo(e.touches[0].clientX); }, { passive: true });

reset();
loop();

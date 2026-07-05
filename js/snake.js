/* ==========================================================================
   Snake — the arcade classic on a 20×20 grid. Pure canvas, no assets.
   ========================================================================== */
const GRID = 20;                    // 20×20 cells
const canvas = document.getElementById("c");
const cell = canvas.width / GRID;   // 24px cells
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");

const BEST_KEY = "susamGames.snake.best";
let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best;

const css = getComputedStyle(document.documentElement);
const C = (n) => css.getPropertyValue(n).trim();

let snake, dir, nextDir, food, score, alive, tick, acc, stepEvery;

function reset() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = dir;
  score = 0;
  scoreEl.textContent = "0";
  stepEvery = 0.14;               // seconds per step; speeds up as you eat
  acc = 0;
  alive = true;
  placeFood();
}

function placeFood() {
  while (true) {
    const f = { x: (Math.random() * GRID) | 0, y: (Math.random() * GRID) | 0 };
    if (!snake.some((s) => s.x === f.x && s.y === f.y)) { food = f; return; }
  }
}

function start() {
  reset();
  overlay.classList.add("hidden");
}

function gameOver() {
  alive = false;
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    ovTitle.textContent = "New Best! 🏆";
    ovText.textContent = `You scored ${score}. A fresh record — go again?`;
  } else {
    ovTitle.textContent = "Game Over 🐍";
    ovText.textContent = `You scored ${score}. Best is ${best}. Try again?`;
  }
  startBtn.textContent = "▶ Play Again";
  overlay.classList.remove("hidden");
}

function setDir(x, y) {
  // no instant 180° reversals
  if (x === -dir.x && y === -dir.y) return;
  nextDir = { x, y };
}

function step() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) return gameOver();
  if (snake.some((s) => s.x === head.x && s.y === head.y)) return gameOver();

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    stepEvery = Math.max(0.06, stepEvery - 0.004);
    placeFood();
  } else {
    snake.pop();
  }
}

function draw() {
  ctx.fillStyle = C("--bg-soft");
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // subtle grid
  ctx.strokeStyle = "rgba(120,140,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
  }

  // food
  ctx.fillStyle = C("--neon-3");
  roundRect(food.x * cell + 3, food.y * cell + 3, cell - 6, cell - 6, 6);
  ctx.fill();

  // snake
  for (let i = snake.length - 1; i >= 0; i--) {
    const s = snake[i];
    ctx.fillStyle = i === 0 ? C("--neon") : C("--neon-2");
    roundRect(s.x * cell + 2, s.y * cell + 2, cell - 4, cell - 4, 6);
    ctx.fill();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (alive) {
    acc += dt;
    while (acc >= stepEvery) { acc -= stepEvery; step(); }
  }
  draw();
}

// ---- input --------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "ArrowUp": case "KeyW": setDir(0, -1); e.preventDefault(); break;
    case "ArrowDown": case "KeyS": setDir(0, 1); e.preventDefault(); break;
    case "ArrowLeft": case "KeyA": setDir(-1, 0); e.preventDefault(); break;
    case "ArrowRight": case "KeyD": setDir(1, 0); e.preventDefault(); break;
    case "Space": case "Enter": if (!alive) start(); e.preventDefault(); break;
  }
});
startBtn.addEventListener("click", start);

document.getElementById("dpad").addEventListener("click", (e) => {
  const a = e.target.getAttribute("data-act");
  if (a === "up") setDir(0, -1);
  else if (a === "down") setDir(0, 1);
  else if (a === "left") setDir(-1, 0);
  else if (a === "right") setDir(1, 0);
});

let tx = 0, ty = 0;
const stage = document.getElementById("stage");
stage.addEventListener("touchstart", (e) => { const t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; }, { passive: true });
stage.addEventListener("touchend", (e) => {
  if (!alive) { start(); return; }
  const t = e.changedTouches[0];
  const dx = t.clientX - tx, dy = t.clientY - ty;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
  else setDir(0, dy > 0 ? 1 : -1);
}, { passive: true });

reset();
alive = false;   // wait for start; overlay is visible
requestAnimationFrame(loop);

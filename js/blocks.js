/* ==========================================================================
   Block Drop — a compact Tetris. 10×20 well, 7 tetrominoes, canvas only.
   ========================================================================== */
const COLS = 10, ROWS = 20, CELL = 24;
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const bestEl = document.getElementById("best");

const BEST_KEY = "susamGames.blocks.best";
let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best;

const css = getComputedStyle(document.documentElement);
const C = (n) => css.getPropertyValue(n).trim();

// Tetromino shapes (each a list of rotation states, [x,y] blocks in a 4×4 box).
const SHAPES = {
  I: { color: "--neon",   cells: [[[0,1],[1,1],[2,1],[3,1]]] },
  O: { color: "--gold",   cells: [[[1,0],[2,0],[1,1],[2,1]]] },
  T: { color: "--neon-2", cells: [[[1,0],[0,1],[1,1],[2,1]]] },
  S: { color: "--good",   cells: [[[1,0],[2,0],[0,1],[1,1]]] },
  Z: { color: "--neon-3", cells: [[[0,0],[1,0],[1,1],[2,1]]] },
  J: { color: "#5b8cff",  cells: [[[0,0],[0,1],[1,1],[2,1]]] },
  L: { color: "#ff9f43",  cells: [[[2,0],[0,1],[1,1],[2,1]]] },
};
const TYPES = Object.keys(SHAPES);

let grid, piece, score, lines, dropAcc, dropEvery, running, bag;

function newGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

// 7-bag randomizer for fair piece distribution
function nextType() {
  if (!bag || bag.length === 0) bag = shuffle([...TYPES]);
  return bag.pop();
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function spawn() {
  const type = nextType();
  piece = {
    type,
    color: C(SHAPES[type].color),
    cells: SHAPES[type].cells[0].map((c) => [...c]),
    x: 3, y: -1,
  };
  if (collides(piece.cells, piece.x, piece.y)) gameOver();
}

function collides(cells, ox, oy) {
  for (const [cx, cy] of cells) {
    const x = ox + cx, y = oy + cy;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && grid[y][x]) return true;
  }
  return false;
}

function rotate() {
  if (piece.type === "O") return;
  // rotate 90° clockwise within a 4×4 box: (x,y) -> (y, 3-x)... use bounding rotation
  const rotated = piece.cells.map(([x, y]) => [3 - y, x]);
  // normalise to keep pieces snug to the left/top of their box after rotation
  const minX = Math.min(...rotated.map((c) => c[0]));
  const minY = Math.min(...rotated.map((c) => c[1]));
  const norm = rotated.map(([x, y]) => [x - minX, y - minY]);
  // try with small kicks
  for (const dx of [0, -1, 1, -2, 2]) {
    if (!collides(norm, piece.x + dx, piece.y)) { piece.cells = norm; piece.x += dx; return; }
  }
}

function move(dx) {
  if (!collides(piece.cells, piece.x + dx, piece.y)) piece.x += dx;
}

function softDrop() {
  if (!collides(piece.cells, piece.x, piece.y + 1)) { piece.y++; return true; }
  lock();
  return false;
}

function hardDrop() {
  while (!collides(piece.cells, piece.x, piece.y + 1)) piece.y++;
  lock();
}

function lock() {
  for (const [cx, cy] of piece.cells) {
    const x = piece.x + cx, y = piece.y + cy;
    if (y < 0) { return gameOver(); }
    grid[y][x] = piece.color;
  }
  clearLines();
  spawn();
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid[y].every((c) => c)) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared];
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    dropEvery = Math.max(0.09, 0.6 - Math.floor(lines / 10) * 0.06);
  }
}

function reset() {
  grid = newGrid();
  score = 0; lines = 0;
  scoreEl.textContent = "0"; linesEl.textContent = "0";
  dropAcc = 0; dropEvery = 0.6;
  bag = null;
  running = false;
}

function start() {
  reset();
  spawn();
  running = true;
  overlay.classList.add("hidden");
}

function gameOver() {
  running = false;
  if (score > best) { best = score; localStorage.setItem(BEST_KEY, String(best)); bestEl.textContent = best; }
  ovTitle.textContent = "Game Over 🧱";
  ovText.textContent = `Score ${score} · ${lines} lines cleared. Best is ${best}. Stack again?`;
  startBtn.textContent = "▶ Play Again";
  overlay.classList.remove("hidden");
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2, 4); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath(); ctx.roundRect(x * CELL + 3, y * CELL + 3, CELL - 6, 5, 3); ctx.fill();
}

function draw() {
  ctx.fillStyle = C("--bg-soft");
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(120,140,255,0.05)";
  for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke(); }
  for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke(); }

  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (grid[y][x]) drawCell(x, y, grid[y][x]);

  if (running && piece) {
    // ghost
    let gy = piece.y;
    while (!collides(piece.cells, piece.x, gy + 1)) gy++;
    for (const [cx, cy] of piece.cells) {
      if (gy + cy < 0) continue;
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath(); ctx.roundRect((piece.x + cx) * CELL + 1, (gy + cy) * CELL + 1, CELL - 2, CELL - 2, 4); ctx.fill();
    }
    for (const [cx, cy] of piece.cells) {
      if (piece.y + cy < 0) continue;
      drawCell(piece.x + cx, piece.y + cy, piece.color);
    }
  }
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (running) {
    dropAcc += dt;
    if (dropAcc >= dropEvery) { dropAcc = 0; softDrop(); }
  }
  draw();
}

// ---- input --------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (!running) {
    if (e.code === "Space" || e.code === "Enter") { start(); e.preventDefault(); }
    return;
  }
  switch (e.code) {
    case "ArrowLeft": case "KeyA": move(-1); e.preventDefault(); break;
    case "ArrowRight": case "KeyD": move(1); e.preventDefault(); break;
    case "ArrowUp": case "KeyW": rotate(); e.preventDefault(); break;
    case "ArrowDown": case "KeyS": softDrop(); dropAcc = 0; e.preventDefault(); break;
    case "Space": hardDrop(); e.preventDefault(); break;
  }
});
startBtn.addEventListener("click", start);

document.getElementById("dpad").addEventListener("click", (e) => {
  if (!running) return;
  const a = e.target.getAttribute("data-act");
  if (a === "left") move(-1);
  else if (a === "right") move(1);
  else if (a === "rotate") rotate();
  else if (a === "down") { softDrop(); dropAcc = 0; }
});

reset();
loop();

/* ==========================================================================
   2048 — slide and merge tiles on a 4×4 grid. DOM-rendered, no assets.
   ========================================================================== */
const SIZE = 4;
const board = document.getElementById("board");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const newBtn = document.getElementById("new-btn");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");

const BEST_KEY = "susamGames.2048.best";
let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best;

let grid, score, running, won;

function empty() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }

function spawn() {
  const free = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) free.push([r, c]);
  if (!free.length) return;
  const [r, c] = free[(Math.random() * free.length) | 0];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return [r, c];
}

function render(popAt) {
  board.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      const el = document.createElement("div");
      if (v) {
        el.className = "tile t" + (v > 2048 ? "big" : v);
        el.textContent = v;
        if (popAt && popAt[0] === r && popAt[1] === c) el.classList.add("pop");
      } else {
        el.className = "cell";
      }
      board.appendChild(el);
    }
  }
}

// slide + merge a single row to the left; returns {row, gained, moved}
function slideRow(row) {
  const nums = row.filter((v) => v);
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) {
      nums[i] *= 2;
      gained += nums[i];
      nums.splice(i + 1, 1);
    }
  }
  while (nums.length < SIZE) nums.push(0);
  const moved = nums.some((v, i) => v !== row[i]);
  return { row: nums, gained, moved };
}

function rotate(g) {
  // rotate clockwise
  const n = empty();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) n[c][SIZE - 1 - r] = g[r][c];
  return n;
}

function move(dir) {
  if (!running) return;
  // reduce every direction to "left" by rotating, then rotate back
  let g = grid.map((r) => [...r]);
  const rots = { left: 0, up: 3, right: 2, down: 1 }[dir];
  for (let i = 0; i < rots; i++) g = rotate(g);

  let moved = false, gained = 0;
  for (let r = 0; r < SIZE; r++) {
    const res = slideRow(g[r]);
    g[r] = res.row;
    gained += res.gained;
    if (res.moved) moved = true;
  }

  for (let i = 0; i < (4 - rots) % 4; i++) g = rotate(g);
  if (!moved) return;

  grid = g;
  score += gained;
  scoreEl.textContent = score;
  if (score > best) { best = score; localStorage.setItem(BEST_KEY, String(best)); bestEl.textContent = best; }

  const at = spawn();
  render(at);

  if (!won && grid.some((row) => row.some((v) => v >= 2048))) {
    won = true;
    endGame(true);
    return;
  }
  if (!canMove()) endGame(false);
}

function canMove() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) return true;
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
    }
  return false;
}

function start() {
  grid = empty();
  score = 0; won = false; running = true;
  scoreEl.textContent = "0";
  spawn(); spawn();
  render();
  overlay.classList.add("hidden");
}

function endGame(victory) {
  running = false;
  if (victory) {
    ovTitle.textContent = "You made 2048! 🏆";
    ovText.textContent = `Score ${score}. Keep going for a higher tile, or start fresh.`;
    startBtn.textContent = "▶ Keep Playing";
  } else {
    ovTitle.textContent = "No moves left 🔢";
    ovText.textContent = `Final score ${score}. Best is ${best}. Try again?`;
    startBtn.textContent = "▶ Play Again";
  }
  overlay.classList.remove("hidden");
}

startBtn.addEventListener("click", () => {
  if (won && running === false && grid && canMove()) {
    // "keep playing" after a win — just resume the same board
    running = true;
    overlay.classList.add("hidden");
    return;
  }
  start();
});
newBtn.addEventListener("click", start);

window.addEventListener("keydown", (e) => {
  const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
                KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down" };
  if (map[e.code]) { move(map[e.code]); e.preventDefault(); }
});

let tx = 0, ty = 0;
board.addEventListener("touchstart", (e) => { const t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; }, { passive: true });
board.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - tx, dy = t.clientY - ty;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
  else move(dy > 0 ? "down" : "up");
}, { passive: true });

// initial empty board behind the overlay
grid = empty();
render();
running = false;

/* ==========================================================================
   Minesweeper — 9×9 field, 10 mines. DOM-rendered, no assets.
   Mines are placed on the first reveal so you never lose on click one.
   ========================================================================== */
const N = 9, MINES = 10;
const grid = document.getElementById("grid");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const flagBtn = document.getElementById("flag-btn");
const flagsEl = document.getElementById("flags");
const winsEl = document.getElementById("wins");

const WINS_KEY = "susamGames.minesweeper.wins";
let wins = parseInt(localStorage.getItem(WINS_KEY) || "0", 10);
winsEl.textContent = wins;

let cells, revealedCount, flagCount, placed, running, flagMode;

function idx(r, c) { return r * N + c; }
function inBounds(r, c) { return r >= 0 && c >= 0 && r < N && c < N; }
function neighbors(r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr || dc) { if (inBounds(r + dr, c + dc)) out.push([r + dr, c + dc]); }
  }
  return out;
}

function build() {
  cells = [];
  revealedCount = 0; flagCount = 0; placed = false;
  flagsEl.textContent = "0";
  grid.innerHTML = "";
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const el = document.createElement("div");
      el.className = "minecell";
      const cell = { r, c, el, mine: false, open: false, flag: false, count: 0 };
      el.addEventListener("click", () => onReveal(cell));
      el.addEventListener("contextmenu", (e) => { e.preventDefault(); onFlag(cell); });
      // long-press to flag on touch
      let timer = null;
      el.addEventListener("touchstart", () => { timer = setTimeout(() => { onFlag(cell); timer = null; }, 400); }, { passive: true });
      el.addEventListener("touchend", (e) => { if (timer) { clearTimeout(timer); } else { e.preventDefault(); } }, { passive: false });
      cells.push(cell);
      grid.appendChild(el);
    }
  }
}

function placeMines(safeR, safeC) {
  const forbidden = new Set([idx(safeR, safeC), ...neighbors(safeR, safeC).map(([r, c]) => idx(r, c))]);
  let placedCount = 0;
  while (placedCount < MINES) {
    const i = (Math.random() * N * N) | 0;
    if (forbidden.has(i) || cells[i].mine) continue;
    cells[i].mine = true;
    placedCount++;
  }
  for (const cell of cells) {
    if (cell.mine) continue;
    cell.count = neighbors(cell.r, cell.c).filter(([r, c]) => cells[idx(r, c)].mine).length;
  }
  placed = true;
}

function onFlag(cell) {
  if (!running || cell.open) return;
  cell.flag = !cell.flag;
  cell.el.classList.toggle("flag", cell.flag);
  cell.el.textContent = cell.flag ? "🚩" : "";
  flagCount += cell.flag ? 1 : -1;
  flagsEl.textContent = flagCount;
}

function onReveal(cell) {
  if (!running) return;
  if (flagMode) return onFlag(cell);
  if (cell.flag || cell.open) return;
  if (!placed) placeMines(cell.r, cell.c);

  if (cell.mine) return loss(cell);
  flood(cell);
  if (revealedCount === N * N - MINES) victory();
}

function flood(cell) {
  const stack = [cell];
  while (stack.length) {
    const cur = stack.pop();
    if (cur.open || cur.flag) continue;
    cur.open = true;
    revealedCount++;
    cur.el.classList.add("open");
    if (cur.count > 0) {
      cur.el.textContent = cur.count;
      cur.el.classList.add("n" + cur.count);
    } else {
      cur.el.textContent = "";
      for (const [r, c] of neighbors(cur.r, cur.c)) {
        const nb = cells[idx(r, c)];
        if (!nb.open && !nb.mine) stack.push(nb);
      }
    }
  }
}

function revealAllMines(hit) {
  for (const cell of cells) {
    if (cell.mine) {
      cell.el.classList.add("open");
      if (cell === hit) cell.el.classList.add("mine");
      cell.el.textContent = "💣";
    } else if (cell.flag && !cell.mine) {
      cell.el.textContent = "❌";
    }
  }
}

function loss(cell) {
  running = false;
  revealAllMines(cell);
  ovTitle.textContent = "Boom! 💥";
  ovText.textContent = "You hit a mine. Read the numbers, flag carefully, and try again.";
  startBtn.textContent = "▶ Play Again";
  overlay.classList.remove("hidden");
}

function victory() {
  running = false;
  wins++;
  localStorage.setItem(WINS_KEY, String(wins));
  winsEl.textContent = wins;
  ovTitle.textContent = "Field cleared! 🏆";
  ovText.textContent = `Every safe cell revealed — that's ${wins} win${wins === 1 ? "" : "s"}. Sweep another?`;
  startBtn.textContent = "▶ Play Again";
  overlay.classList.remove("hidden");
}

function start() {
  build();
  running = true;
  overlay.classList.add("hidden");
}

function setFlagMode(on) {
  flagMode = on;
  flagBtn.textContent = `🚩 Flag mode: ${on ? "on" : "off"}`;
  flagBtn.classList.toggle("primary", on);
}

startBtn.addEventListener("click", start);
flagBtn.addEventListener("click", () => setFlagMode(!flagMode));

build();
running = false;
setFlagMode(false);

/* ==========================================================================
   Memory Match — flip and pair 8 hidden pairs. DOM-rendered, no assets.
   ========================================================================== */
const FACES = ["🦊", "🐼", "🐸", "🐙", "🦄", "🐝", "🦋", "🐬"];
const grid = document.getElementById("grid");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const newBtn = document.getElementById("new-btn");
const movesEl = document.getElementById("moves");
const pairsEl = document.getElementById("pairs");
const bestEl = document.getElementById("best");

const BEST_KEY = "susamGames.memory.bestMoves";
let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best > 0 ? best : "—";

let deck, first, second, lock, moves, matched, running;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function build() {
  deck = shuffle([...FACES, ...FACES].map((face, i) => ({ id: i, face })));
  first = second = null;
  lock = false;
  moves = 0; matched = 0;
  movesEl.textContent = "0";
  pairsEl.textContent = "0";

  grid.innerHTML = "";
  deck.forEach((card) => {
    const btn = document.createElement("button");
    btn.className = "memcard";
    btn.dataset.id = card.id;
    btn.innerHTML = `<div class="inner">
        <div class="face front">?</div>
        <div class="face back">${card.face}</div>
      </div>`;
    btn.addEventListener("click", () => flip(btn, card));
    grid.appendChild(btn);
  });
}

function flip(btn, card) {
  if (!running || lock) return;
  if (btn.classList.contains("flipped") || btn.classList.contains("matched")) return;

  btn.classList.add("flipped");
  if (!first) { first = { btn, card }; return; }

  second = { btn, card };
  moves++;
  movesEl.textContent = moves;
  lock = true;

  if (first.card.face === second.card.face) {
    first.btn.classList.add("matched");
    second.btn.classList.add("matched");
    matched++;
    pairsEl.textContent = matched;
    resetTurn();
    if (matched === FACES.length) win();
  } else {
    setTimeout(() => {
      first.btn.classList.remove("flipped");
      second.btn.classList.remove("flipped");
      resetTurn();
    }, 700);
  }
}

function resetTurn() { first = second = null; lock = false; }

function win() {
  running = false;
  let record = false;
  if (best === 0 || moves < best) { best = moves; localStorage.setItem(BEST_KEY, String(best)); bestEl.textContent = best; record = true; }
  ovTitle.textContent = record ? "New Best! 🏆" : "All matched! 🃏";
  ovText.textContent = record
    ? `Solved in ${moves} moves — your best yet. Go again?`
    : `Solved in ${moves} moves. Best is ${best}. Try to beat it?`;
  startBtn.textContent = "▶ Play Again";
  overlay.classList.remove("hidden");
}

function start() {
  build();
  running = true;
  overlay.classList.add("hidden");
}

startBtn.addEventListener("click", start);
newBtn.addEventListener("click", start);

// show a face-down board behind the overlay
build();
running = false;

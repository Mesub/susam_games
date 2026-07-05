/* ==========================================================================
   Tic-Tac-Toe — you are X, the AI is O and plays a perfect minimax game.
   DOM-rendered, no assets. Best you can do against it is a draw.
   ========================================================================== */
const grid = document.getElementById("grid");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const turnEl = document.getElementById("turn");
const wEl = document.getElementById("w");
const dEl = document.getElementById("d");
const lEl = document.getElementById("l");

const HUMAN = "X", AI = "O";
const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

const score = {
  w: parseInt(localStorage.getItem("susamGames.ttt.w") || "0", 10),
  d: parseInt(localStorage.getItem("susamGames.ttt.d") || "0", 10),
  l: parseInt(localStorage.getItem("susamGames.ttt.l") || "0", 10),
};
wEl.textContent = score.w; dEl.textContent = score.d; lEl.textContent = score.l;

let board, cells, locked, over;

function build() {
  board = Array(9).fill("");
  cells = [];
  locked = false;
  over = false;
  grid.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const el = document.createElement("button");
    el.className = "tttcell";
    el.addEventListener("click", () => play(i));
    cells.push(el);
    grid.appendChild(el);
  }
  overlay.classList.add("hidden");
  turnEl.textContent = "You are ✗ — you move first.";
}

function winnerOf(b) {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line: [a, c, d] };
  }
  if (b.every((v) => v)) return { who: "draw", line: null };
  return null;
}

function render() {
  for (let i = 0; i < 9; i++) {
    const v = board[i];
    cells[i].textContent = v === "X" ? "✗" : v === "O" ? "◯" : "";
    cells[i].classList.toggle("x", v === "X");
    cells[i].classList.toggle("o", v === "O");
    cells[i].classList.toggle("taken", !!v);
  }
}

function play(i) {
  if (locked || over || board[i]) return;
  board[i] = HUMAN;
  render();
  const res = winnerOf(board);
  if (res) return finish(res);

  locked = true;
  turnEl.textContent = "AI is thinking…";
  setTimeout(aiMove, 260);
}

function aiMove() {
  const i = bestMove(board);
  board[i] = AI;
  render();
  const res = winnerOf(board);
  if (res) return finish(res);
  locked = false;
  turnEl.textContent = "Your move.";
}

// minimax: AI maximises, human minimises. Depth favours quicker wins.
function minimax(b, player) {
  const res = winnerOf(b);
  if (res) {
    if (res.who === AI) return { score: 10 };
    if (res.who === HUMAN) return { score: -10 };
    return { score: 0 };
  }
  let best = player === AI ? { score: -Infinity } : { score: Infinity };
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = player;
    const r = minimax(b, player === AI ? HUMAN : AI);
    b[i] = "";
    if (player === AI) {
      if (r.score > best.score) best = { score: r.score, move: i };
    } else {
      if (r.score < best.score) best = { score: r.score, move: i };
    }
  }
  return best;
}

function bestMove(b) {
  // first move: pick a corner or centre for a snappier feel (still perfect)
  const filled = b.filter((v) => v).length;
  if (filled === 1) return b[4] ? [0, 2, 6, 8][(Math.random() * 4) | 0] : 4;
  return minimax(b.slice(), AI).move;
}

function finish(res) {
  over = true;
  locked = true;
  if (res.line) res.line.forEach((i) => cells[i].classList.add("win"));

  if (res.who === "draw") {
    score.d++; dEl.textContent = score.d; localStorage.setItem("susamGames.ttt.d", score.d);
    ovTitle.textContent = "Draw 🤝";
    ovText.textContent = "A perfectly played draw — exactly what a perfect opponent allows.";
    turnEl.textContent = "It's a draw.";
  } else if (res.who === HUMAN) {
    score.w++; wEl.textContent = score.w; localStorage.setItem("susamGames.ttt.w", score.w);
    ovTitle.textContent = "You win! 🏆";
    ovText.textContent = "Remarkable — you beat a perfect player. (Or it slipped. Either way: nice.)";
    turnEl.textContent = "You win!";
  } else {
    score.l++; lEl.textContent = score.l; localStorage.setItem("susamGames.ttt.l", score.l);
    ovTitle.textContent = "AI wins 🤖";
    ovText.textContent = "The AI took that one. Control the centre and corners — force the draw.";
    turnEl.textContent = "AI wins.";
  }
  setTimeout(() => overlay.classList.remove("hidden"), 650);
}

startBtn.addEventListener("click", build);
build();

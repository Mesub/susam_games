/* ==========================================================================
   Susam's Games — the hub.
   A single catalog drives the landing grid. Add a game once here and it shows
   up with search + category filtering. Each game is its own standalone page
   under games/, so the hub stays tiny and every game runs offline.
   ========================================================================== */

const GAMES = [
  {
    slug: "forest-run",
    title: "Forest Run 3D",
    emoji: "🌲",
    blurb: "Sprint a forest trail in 3D. Weave past trees, leap the logs.",
    cats: ["arcade"],
    tags: ["runner", "3d", "three.js", "endless"],
  },
  {
    slug: "snake",
    title: "Snake",
    emoji: "🐍",
    blurb: "Eat, grow, don't bite your tail. The classic that never dies.",
    cats: ["arcade", "classic"],
    tags: ["retro", "grid"],
  },
  {
    slug: "blocks",
    title: "Block Drop",
    emoji: "🧱",
    blurb: "Rotate and stack falling tetrominoes. Clear lines, chase combos.",
    cats: ["puzzle", "classic"],
    tags: ["tetris", "falling"],
  },
  {
    slug: "breakout",
    title: "Brick Breaker",
    emoji: "🎯",
    blurb: "Bounce the ball, smash every brick, keep the paddle alive.",
    cats: ["arcade", "classic"],
    tags: ["breakout", "paddle"],
  },
  {
    slug: "2048",
    title: "2048",
    emoji: "🔢",
    blurb: "Slide tiles, merge matching numbers, reach the 2048 tile.",
    cats: ["puzzle"],
    tags: ["numbers", "merge"],
  },
  {
    slug: "memory",
    title: "Memory Match",
    emoji: "🃏",
    blurb: "Flip cards two at a time and pair them all from memory.",
    cats: ["puzzle"],
    tags: ["cards", "pairs", "concentration"],
  },
  {
    slug: "flap",
    title: "Flap",
    emoji: "🐤",
    blurb: "Tap to fly. Thread the pipes. One touch and you're toast.",
    cats: ["arcade"],
    tags: ["flappy", "one-button"],
  },
  {
    slug: "minesweeper",
    title: "Minesweeper",
    emoji: "💣",
    blurb: "Clear the field using the numbers. Flag the mines. Don't guess.",
    cats: ["puzzle", "classic"],
    tags: ["logic", "grid"],
  },
  {
    slug: "pong",
    title: "Pong",
    emoji: "🏓",
    blurb: "The original video game. You vs. a sharp CPU paddle.",
    cats: ["arcade", "classic"],
    tags: ["paddle", "1972", "retro"],
  },
  {
    slug: "tictactoe",
    title: "Tic-Tac-Toe",
    emoji: "⭕",
    blurb: "Three in a row against an unbeatable AI. Can you force a draw?",
    cats: ["classic", "puzzle"],
    tags: ["xoxo", "ai", "minimax"],
  },
];

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const search = document.getElementById("search");
const filters = document.getElementById("filters");
document.getElementById("count").textContent = String(GAMES.length);

let activeCat = "all";
let query = "";

function matches(g) {
  const catOk = activeCat === "all" || g.cats.includes(activeCat);
  if (!catOk) return false;
  if (!query) return true;
  const hay = (g.title + " " + g.blurb + " " + g.tags.join(" ")).toLowerCase();
  return hay.includes(query);
}

function render() {
  const visible = GAMES.filter(matches);
  grid.innerHTML = visible
    .map(
      (g) => `
      <a class="card" href="games/${g.slug}.html" aria-label="Play ${g.title}">
        <span class="glow"></span>
        <div class="emoji">${g.emoji}</div>
        <h3>${g.title}</h3>
        <p>${g.blurb}</p>
        <span class="play-pill">Play ▸</span>
      </a>`
    )
    .join("");
  empty.hidden = visible.length !== 0;
}

filters.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  activeCat = btn.dataset.cat;
  for (const c of filters.querySelectorAll(".chip")) c.classList.toggle("active", c === btn);
  render();
});

search.addEventListener("input", () => {
  query = search.value.trim().toLowerCase();
  render();
});

render();

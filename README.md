# 🕹️ Susam's Games

A **global arcade** — a single hub with lots of browser games inside. Open the
hub, pick a game, play. Every game is built from scratch with plain HTML, CSS
and JavaScript (Forest Run 3D uses vendored three.js), there are **no external
assets or build step**, and everything runs **completely offline**.

## Play

Open `index.html` in any modern browser to reach the hub, then click a game.

```
# or, if your browser blocks module scripts over file://
python3 -m http.server 8000   # then visit http://localhost:8000
```

## The games

| Game | Genre | What it is |
|------|-------|------------|
| 🌲 **Forest Run 3D** | Arcade | A 3D endless runner (three.js) — weave past trees, jump logs. |
| 🦖 **Dino Run** | Arcade | Jump cacti, duck pterodactyls, and outrun the T-Rex chasing you. |
| ⚽ **Penalty Shootout** | Arcade | Aim, pick your height, time the power — beat the keeper from the spot. |
| 🐍 **Snake** | Classic | Eat, grow, don't bite your tail. |
| 🧱 **Block Drop** | Puzzle | Tetris — rotate and stack tetrominoes, clear lines. |
| 🎯 **Brick Breaker** | Arcade | Breakout — bounce the ball, smash every brick. |
| 🔢 **2048** | Puzzle | Slide and merge numbered tiles to reach 2048. |
| 🃏 **Memory Match** | Puzzle | Flip cards and pair all eight from memory. |
| 🐤 **Flap** | Arcade | One-button flyer — thread the pipes. |
| 💣 **Minesweeper** | Classic | Clear a 9×9 field using the numbers. |
| 🏓 **Pong** | Classic | You vs. a sharp CPU paddle, first to 7. |
| ⭕ **Tic-Tac-Toe** | Classic | Three in a row against an unbeatable minimax AI. |

The hub supports live search and category filters (Arcade / Puzzle / Classic).

## Add a new game

1. Drop a self-contained page in `games/<slug>.html` and its logic in
   `js/<slug>.js` (reuse `css/theme.css` and the standard game-shell markup).
2. Add one entry to the `GAMES` array in `js/hub.js` — it appears on the hub
   with search and filtering automatically.

## Structure

```
index.html            # the hub (game grid + search + filters)
css/theme.css         # shared neon/arcade theme
js/hub.js             # hub catalog + rendering
games/                # one standalone HTML page per game
js/<game>.js          # one script per game
js/vendor/            # vendored three.js (Forest Run 3D only)
```

Scores and stats persist per game via `localStorage`.

Part of **Susam's Games**.

# 🕹️ Susam's Games

A little arcade of browser games sharing one neon theme. Everything is
drawn procedurally or from vendored code — **no external assets, no build
step, no server** — so every game runs completely offline. Open
`index.html` to reach the hub, then pick a game.

## Games

| Game | Page | Built with |
|------|------|------------|
| ⚽ **Penalty Shootout** | `football.html` | 2D canvas, zero dependencies |
| 🌲 **Forest Run 3D** | `forest-run.html` | vendored [three.js](https://threejs.org/) |

### ⚽ Penalty Shootout

A one-button football game. Step up to the penalty spot and beat the keeper.
Every shot is a three-beat rhythm — **direction**, then **height**, then
**power** — all timed with a single tap. Aim for the green sweet spot on the
power meter: harder shots give the keeper less time, but overcook a high one
and it flies over the bar. Score as many as you can before the keeper stops
you three times. He reads your aim more often the longer your streak runs.
Best score is saved to `localStorage`.

### 🌲 Forest Run 3D

An endless three.js runner. Sprint down a forest trail, switch between three
lanes to weave past the trees, and jump the fallen logs. The trail only gets
faster. Trees, logs, ground, and the runner are all procedural geometry, and
three.js is vendored locally, so it too runs fully offline.

## Play

Just open `index.html` in any modern browser. No build step, no server needed.

```
# or, if your browser blocks module scripts over file://
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Structure

```
index.html            # the hub — grid of game cards
football.html         # Penalty Shootout page
forest-run.html       # Forest Run 3D page
css/theme.css         # shared neon theme (hub + every game)
js/football.js        # Penalty Shootout (2D canvas)
js/forest-run.js      # Forest Run 3D (three.js)
js/vendor/            # vendored three.js module build
```

## Adding a game

Each game is a standalone page that links back to the hub with
`<a class="back" href="index.html">← All games</a>`. To add one, drop in a new
`<game>.html`, its script under `js/`, and a `.card` link in `index.html`.
The shared `css/theme.css` handles the rest.

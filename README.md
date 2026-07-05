# 🌲 Forest Run 3D

An endless runner built with [three.js](https://threejs.org/). Sprint down a
forest trail, switch between three lanes to weave past the trees, and jump the
fallen logs. The trail only gets faster.

Everything you see — trees, logs, ground, and the runner — is generated from
procedural geometry. There are no image or model assets, and three.js is
vendored locally, so the game runs **completely offline**.

## Play

Just open `index.html` in any modern browser. No build step, no server needed.

```
# or, if your browser blocks module scripts over file://
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Controls

| Action        | Keyboard                          | Touch            |
|---------------|-----------------------------------|------------------|
| Change lane   | `←` `→` or `A` `D`                | swipe left/right |
| Jump          | `Space` / `↑` / `W`               | tap or swipe up  |

On-screen buttons appear automatically on touch devices.

## How it works

- **Endless trail** — ground tiles and roadside trees are pooled and recycled
  as they scroll past the camera, so the forest is effectively infinite.
- **Obstacles** — in-lane pine trees must be dodged by changing lanes; fallen
  logs must be jumped. Spacing tightens and world speed ramps up with distance.
- **Score** — one point per metre travelled; your best is saved to
  `localStorage`.

## Structure

```
index.html            # page + HUD + import map
css/theme.css         # shared neon/forest theme
js/forest-run.js      # the game (three.js)
js/vendor/            # vendored three.js module build
```

Part of **Susam's Games**.

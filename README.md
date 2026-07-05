# ⚽ Penalty Shootout

A one-button football game. Step up to the penalty spot, pick your corner,
and beat the keeper. Every shot is a three-beat rhythm — **direction**, then
**height**, then **power** — all timed with a single tap. Score as many as you
can before the keeper stops you three times. He reads you better the longer
your streak runs.

Everything is drawn with the 2D canvas — the pitch, the goal and net, the
keeper, and the ball are all procedural. There are **no image or model
assets** and no libraries, so the game runs **completely offline**.

## Play

Just open `index.html` in any modern browser. No build step, no server needed.

## Controls

| Action                                    | Keyboard          | Touch              |
|-------------------------------------------|-------------------|--------------------|
| Set direction / height / power, and shoot | `Space` / `Enter` | tap the pitch or the **Shoot** button |

Each penalty takes three taps:

1. **Direction** — a marker sweeps across the goal mouth; tap to lock your side.
2. **Height** — a marker sweeps up the goal; tap to lock how high you hit it.
3. **Power** — a meter oscillates; tap to strike. Aim for the green sweet spot —
   harder shots give the keeper less time, but overcook a high one and it flies
   over the bar.

## How it works

- **The keeper** picks a zone to dive into. Early on he mostly guesses, but as
  your goal streak grows he reads your aim more often — later penalties demand
  the corners.
- **On target** means inside the posts and under the bar. Miss wide, sky it over
  the bar, or let the keeper get a glove to it, and you lose one of your three
  lives.
- **Score** — one point per goal; your best is saved to `localStorage`.

## Structure

```
index.html         # page + HUD + overlay
css/theme.css      # shared neon theme
js/football.js     # the game (2D canvas, zero dependencies)
```

Part of **Susam's Games**.

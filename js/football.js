/* ==========================================================================
   Penalty Shootout — Susam's Games
   A self-contained 2D football game. No dependencies, runs fully offline.

   You step up to the spot and take penalty after penalty. Each shot is a
   three-beat rhythm: lock the aim, lock the height, then time the power —
   all with one button. Beat the keeper to score. Miss three and it's over.
   The keeper reads you better as your streak grows.
   ========================================================================== */

'use strict';

const canvas = document.getElementById('pitch');
const ctx = canvas.getContext('2d');

// Logical drawing space; the canvas is scaled to fit its container.
const W = 720;
const H = 480;

// Field / goal geometry (logical units).
const GOAL_LEFT = 180;
const GOAL_RIGHT = 540;
const GOAL_BAR = 70;      // y of the crossbar
const GOAL_LINE = 190;    // y of the goal line (bottom of the mouth)
const SPOT = { x: W / 2, y: 410 };

// Aim sweep ranges (a little wider/taller than the mouth so you can miss).
const AIM_X_MIN = 150, AIM_X_MAX = 570;
const AIM_Y_MIN = 55, AIM_Y_MAX = 185;

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ov-title');
const ovText = document.getElementById('ov-text');
const startBtn = document.getElementById('start-btn');

const BEST_KEY = 'penalty-shootout-best';

// ---- Game state ---------------------------------------------------------
const S = {
  READY: 'ready',   // waiting to strike; between shots
  AIM_X: 'aimx',    // horizontal aim sweeping
  AIM_Y: 'aimy',    // height sweeping
  POWER: 'power',   // power meter oscillating
  KICK: 'kick',     // ball in flight
  RESULT: 'result', // showing GOAL / SAVED / MISS
  OVER: 'over',     // game over, overlay up
};

let state = S.OVER;
let score = 0;
let lives = 3;
let level = 1;
let best = 0;

// Sweep phase accumulators.
let phase = 0;         // drives the active sweep
let sweepDir = 1;

// Locked shot parameters.
let target = { x: W / 2, y: 130 };
let power = 0;

// Kick animation.
let kick = null;

// Result flash.
let result = null;     // { text, color, timer }

// Keeper.
const keeper = {
  x: W / 2, y: 148,     // resting position (feet on/near line)
  dx: W / 2, dy: 148,   // dive target
  reach: 82,
  t: 0,                 // dive animation progress 0..1
  diving: false,
};

// Ball resting on the spot until struck.
let ball = { x: SPOT.x, y: SPOT.y, scale: 1 };

let last = 0;
let started = false;

// ---- Sizing -------------------------------------------------------------
function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Uniform scale so the logical WxH fills the (fixed 3:2) box.
  scaleX = rect.width / W;
  scaleY = rect.height / H;
}
let scaleX = 1, scaleY = 1;
window.addEventListener('resize', resize);

// ---- Best score ---------------------------------------------------------
function loadBest() {
  const v = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  best = Number.isFinite(v) ? v : 0;
  bestEl.textContent = best;
}
function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
  }
}

// ---- HUD ----------------------------------------------------------------
function updateHud() {
  scoreEl.textContent = score;
  livesEl.textContent = '●'.repeat(lives) + '○'.repeat(Math.max(0, 3 - lives));
}

// ---- Flow ---------------------------------------------------------------
function startGame() {
  score = 0;
  lives = 3;
  level = 1;
  updateHud();
  overlay.classList.add('hidden');
  started = true;
  nextShot();
}

function nextShot() {
  ball = { x: SPOT.x, y: SPOT.y, scale: 1 };
  keeper.x = W / 2;
  keeper.t = 0;
  keeper.diving = false;
  target = { x: W / 2, y: 130 };
  power = 0;
  phase = 0;
  state = S.AIM_X;
}

// Sweep speeds ramp gently with level.
function sweepSpeed(kind) {
  if (kind === 'x') return 1.7 + level * 0.14;
  if (kind === 'y') return 2.0 + level * 0.14;
  return 2.3 + level * 0.18; // power
}

// Advance the shot: lock aim → lock height → time power → strike.
function action() {
  switch (state) {
    case S.AIM_X: {
      target.x = AIM_X_MIN + (AIM_X_MAX - AIM_X_MIN) * (0.5 + 0.5 * Math.sin(phase));
      phase = 0;
      state = S.AIM_Y;
      break;
    }
    case S.AIM_Y: {
      target.y = AIM_Y_MIN + (AIM_Y_MAX - AIM_Y_MIN) * (0.5 - 0.5 * Math.cos(phase));
      phase = 0;
      state = S.POWER;
      break;
    }
    case S.POWER: {
      power = 0.5 + 0.5 * Math.sin(phase); // 0..1
      launchKick();
      break;
    }
    case S.OVER: {
      if (!started || overlay.classList.contains('hidden')) return;
      startGame();
      break;
    }
    default:
      break; // ignore during flight / result
  }
}

function launchKick() {
  decideKeeper();
  kick = {
    t: 0,
    from: { x: SPOT.x, y: SPOT.y },
    to: { x: target.x, y: target.y },
    // Higher power = faster flight = less time for the keeper.
    dur: 0.62 - power * 0.20,
  };
  keeper.diving = true;
  keeper.t = 0;
  state = S.KICK;
}

function decideKeeper() {
  // Which third + height zone did the shot go to.
  const zoneX = target.x < (GOAL_LEFT + 120) ? 0 : target.x > (GOAL_RIGHT - 120) ? 2 : 1;
  const zoneY = target.y < (GOAL_BAR + 55) ? 0 : 1; // high / low
  const cxs = [240, 360, 480];
  const cys = [108, 162];

  // The keeper reads the shot with a probability that climbs as you streak.
  const readProb = Math.min(0.28 + level * 0.055, 0.68);
  let gx, gy;
  if (Math.random() < readProb) {
    gx = zoneX; gy = zoneY;
  } else {
    gx = Math.floor(Math.random() * 3);
    gy = Math.floor(Math.random() * 2);
  }
  keeper.dx = cxs[gx];
  keeper.dy = cys[gy];
  // Faster, harder shots are tougher to reach.
  keeper.reach = (86 + level * 1.5) * (1.28 - power * 0.5);
}

function resolveShot() {
  // Off target?
  if (target.x < GOAL_LEFT + 4 || target.x > GOAL_RIGHT - 4) {
    flash('WIDE!', '#ff5c8a');
    loseLife();
    return;
  }
  if (target.y < GOAL_BAR + 4) {
    flash('OVER THE BAR!', '#ffd166');
    loseLife();
    return;
  }
  // Keeper save?
  const dist = Math.hypot(target.x - keeper.dx, target.y - keeper.dy);
  if (dist < keeper.reach) {
    flash('SAVED!', '#4cc9f0');
    loseLife();
    return;
  }
  // Goal!
  score += 1;
  level = 1 + Math.floor(score / 3);
  saveBest();
  updateHud();
  flash('GOAL!', '#4ade80');
}

function loseLife() {
  lives -= 1;
  updateHud();
  saveBest();
}

function flash(text, color) {
  result = { text, color, timer: 1.15 };
  state = S.RESULT;
}

function endRound() {
  if (lives <= 0) {
    state = S.OVER;
    saveBest();
    ovTitle.textContent = 'Full Time';
    ovText.textContent = `You scored ${score} goal${score === 1 ? '' : 's'}. ` +
      (score >= best && score > 0 ? "That's a new best!" : `Best: ${best}.`);
    startBtn.textContent = '▶ Take the Spot Again';
    overlay.classList.remove('hidden');
  } else {
    nextShot();
  }
}

// ---- Update -------------------------------------------------------------
function update(dt) {
  if (state === S.AIM_X || state === S.AIM_Y) {
    phase += dt * sweepSpeed(state === S.AIM_X ? 'x' : 'y');
  } else if (state === S.POWER) {
    phase += dt * sweepSpeed('power');
  } else if (state === S.KICK) {
    kick.t += dt / kick.dur;
    const t = Math.min(kick.t, 1);
    const e = t;
    ball.x = kick.from.x + (kick.to.x - kick.from.x) * e;
    // Add a shallow arc on the way to goal.
    const arc = Math.sin(t * Math.PI) * 26 * power;
    ball.y = kick.from.y + (kick.to.y - kick.from.y) * e - arc;
    ball.scale = 1 - 0.5 * t; // recede into the goal
    // Keeper dives across the flight.
    keeper.t = Math.min(keeper.t + dt / Math.max(0.22, kick.dur * 0.8), 1);
    if (t >= 1) {
      resolveShot();
    }
  } else if (state === S.RESULT) {
    result.timer -= dt;
    if (result.timer <= 0) {
      result = null;
      endRound();
    }
  }
}

// ---- Rendering ----------------------------------------------------------
function draw() {
  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.clearRect(0, 0, W, H);

  drawField();
  drawGoal();
  drawKeeper();
  drawBall();
  drawAim();
  drawPowerMeter();
  drawResult();

  ctx.restore();
}

function drawField() {
  // Sky above the goal.
  const sky = ctx.createLinearGradient(0, 0, 0, GOAL_LINE);
  sky.addColorStop(0, '#121732');
  sky.addColorStop(1, '#1b2350');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GOAL_LINE);

  // Grass with receding mown stripes.
  for (let y = GOAL_LINE; y < H; y += 1) {
    const p = (y - GOAL_LINE) / (H - GOAL_LINE);
    const band = Math.floor((y - GOAL_LINE) / (14 + p * 26)) % 2;
    const base = 34 + p * 26;
    ctx.fillStyle = band
      ? `rgb(${Math.round(base * 0.7)}, ${Math.round(base + 96)}, ${Math.round(base * 0.9)})`
      : `rgb(${Math.round(base * 0.55)}, ${Math.round(base + 78)}, ${Math.round(base * 0.75)})`;
    ctx.fillRect(0, y, W, 1);
  }

  // Penalty box lines (perspective).
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, H);
  ctx.lineTo(200, GOAL_LINE + 6);
  ctx.lineTo(520, GOAL_LINE + 6);
  ctx.lineTo(W - 60, H);
  ctx.stroke();

  // Six-yard arc-ish + penalty spot.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(SPOT.x, SPOT.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawGoal() {
  // Net area behind the frame.
  ctx.fillStyle = 'rgba(10, 14, 30, 0.72)';
  ctx.fillRect(GOAL_LEFT, GOAL_BAR, GOAL_RIGHT - GOAL_LEFT, GOAL_LINE - GOAL_BAR);

  // Netting.
  ctx.strokeStyle = 'rgba(200, 210, 255, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = GOAL_LEFT; x <= GOAL_RIGHT; x += 18) {
    ctx.moveTo(x, GOAL_BAR);
    ctx.lineTo(x, GOAL_LINE);
  }
  for (let y = GOAL_BAR; y <= GOAL_LINE; y += 16) {
    ctx.moveTo(GOAL_LEFT, y);
    ctx.lineTo(GOAL_RIGHT, y);
  }
  ctx.stroke();

  // Frame: posts + crossbar.
  ctx.strokeStyle = '#f5f7ff';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(GOAL_LEFT, GOAL_LINE);
  ctx.lineTo(GOAL_LEFT, GOAL_BAR);
  ctx.lineTo(GOAL_RIGHT, GOAL_BAR);
  ctx.lineTo(GOAL_RIGHT, GOAL_LINE);
  ctx.stroke();
}

function drawKeeper() {
  // Interpolated dive position.
  const t = keeper.diving ? easeOut(keeper.t) : 0;
  const kx = keeper.x + (keeper.dx - keeper.x) * t;
  const ky = keeper.y + (keeper.dy - keeper.y) * t;
  const lean = keeper.diving ? (keeper.dx - keeper.x) / 200 : 0;

  ctx.save();
  ctx.translate(kx, ky);
  ctx.rotate(lean * t);

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 44, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (kit).
  ctx.fillStyle = '#ffd166';
  roundRect(-14, -6, 28, 46, 8);
  ctx.fill();

  // Arms/gloves spread when diving.
  const spread = 18 + 24 * t;
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, 2); ctx.lineTo(-spread, -6 - 10 * t);
  ctx.moveTo(10, 2); ctx.lineTo(spread, -6 - 10 * t);
  ctx.stroke();
  // Gloves.
  ctx.fillStyle = '#4cc9f0';
  ctx.beginPath();
  ctx.arc(-spread, -6 - 10 * t, 6, 0, Math.PI * 2);
  ctx.arc(spread, -6 - 10 * t, 6, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(0, -16, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  const r = 12 * ball.scale;

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.9, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball body.
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#c9d2e8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Simple pentagon marking, rotating during flight.
  const spin = state === S.KICK ? kick.t * 8 : 0;
  ctx.fillStyle = '#1a1f3a';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = spin + i * (Math.PI * 2 / 5) - Math.PI / 2;
    const px = Math.cos(a) * r * 0.42;
    const py = Math.sin(a) * r * 0.42;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawAim() {
  if (state === S.AIM_X) {
    const x = AIM_X_MIN + (AIM_X_MAX - AIM_X_MIN) * (0.5 + 0.5 * Math.sin(phase));
    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 2;
    dashLine(x, GOAL_BAR - 8, x, GOAL_LINE + 4);
    marker(x, GOAL_BAR - 14, '#4cc9f0');
  } else if (state === S.AIM_Y) {
    const y = AIM_Y_MIN + (AIM_Y_MAX - AIM_Y_MIN) * (0.5 - 0.5 * Math.cos(phase));
    // keep the locked X line visible
    ctx.strokeStyle = 'rgba(76,201,240,0.4)';
    ctx.lineWidth = 2;
    dashLine(target.x, GOAL_BAR - 8, target.x, GOAL_LINE + 4);
    ctx.strokeStyle = '#b15cff';
    dashLine(GOAL_LEFT - 6, y, GOAL_RIGHT + 6, y);
    crosshair(target.x, y, '#b15cff');
  } else if (state === S.POWER || state === S.KICK || state === S.RESULT) {
    // show the chosen spot
    crosshair(target.x, target.y, 'rgba(255,255,255,0.6)');
  }
}

function drawPowerMeter() {
  if (state !== S.POWER) return;
  const p = 0.5 + 0.5 * Math.sin(phase);
  const bx = 250, by = 448, bw = 220, bh = 14;
  // Track.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(bx, by, bw, bh, 7); ctx.fill();
  // Sweet-spot band.
  ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
  roundRect(bx + bw * 0.55, by, bw * 0.35, bh, 7); ctx.fill();
  // Fill.
  const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  grad.addColorStop(0, '#4cc9f0');
  grad.addColorStop(1, '#ff5c8a');
  ctx.fillStyle = grad;
  roundRect(bx, by, bw * p, bh, 7); ctx.fill();

  ctx.fillStyle = '#e8ecff';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POWER', W / 2, by - 8);
  ctx.textAlign = 'left';
}

function drawResult() {
  // Prompt text for the current beat.
  if (state === S.AIM_X || state === S.AIM_Y || state === S.POWER) {
    const label = state === S.AIM_X ? 'Tap to set DIRECTION'
      : state === S.AIM_Y ? 'Tap to set HEIGHT'
      : 'Tap to set POWER & shoot';
    ctx.fillStyle = 'rgba(232,236,255,0.9)';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, 30);
    ctx.textAlign = 'left';
  }
  if (state === S.RESULT && result) {
    const a = Math.min(1, result.timer * 2);
    ctx.globalAlpha = a;
    ctx.fillStyle = result.color;
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(result.text, W / 2, 120);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

// ---- Draw helpers -------------------------------------------------------
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function dashLine(x1, y1, x2, y2) {
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}
function marker(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 6, y - 9);
  ctx.lineTo(x + 6, y - 9);
  ctx.closePath();
  ctx.fill();
}
function crosshair(x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14);
  ctx.stroke();
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// ---- Loop ---------------------------------------------------------------
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (started) update(dt);
  draw();
  requestAnimationFrame(frame);
}

// ---- Input --------------------------------------------------------------
function onKey(e) {
  if (e.code === 'Space' || e.code === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
}
window.addEventListener('keydown', onKey);

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  action();
});

// A single on-screen "Shoot" button for touch.
const shootBtn = document.getElementById('shoot-btn');
if (shootBtn) {
  shootBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); action(); });
}

startBtn.addEventListener('click', startGame);

// ---- Boot ---------------------------------------------------------------
loadBest();
updateHud();
resize();
requestAnimationFrame(frame);

/* ==========================================================================
   Dino Run — endless runner with a twist: a T-Rex chases from behind.
   Jump/duck cacti and pterodactyls. Getting hit doesn't kill you outright —
   it lets the chaser close the gap. Clear obstacles cleanly to pull ahead.
   If the gap hits zero, it catches you. Canvas only, no assets.
   ========================================================================== */
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const chaserFill = document.getElementById("chaser-fill");

const BEST_KEY = "susamGames.dino.best";
let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best;

const css = getComputedStyle(document.documentElement);
const C = (n) => css.getPropertyValue(n).trim();

// ---- tunables -------------------------------------------------------------
const GROUND = 40;
const groundY = H - GROUND;
const GRAVITY = 0.7;
const JUMP_V = -13;
const STAND_W = 44, STAND_H = 47;
const DUCK_W = 58, DUCK_H = 27;
const BASE_SPEED = 6, MAX_SPEED = 15, SPEED_PER_SCORE = 0.0015;

const GAP_MAX = 260;
const GAP_DRAIN = 0.015;   // per frame, scaled by speed — the chase tightens as you speed up
const STUMBLE_PENALTY = 85;
const CLEAN_BONUS = 10;
const INVULN_FRAMES = 45;

let player, obstacles, score, speed, spawnTimer, running;
let gap, invuln, shakeFrames, runT;

function reset() {
  player = { x: 150, y: groundY - STAND_H, vy: 0, jumping: false, ducking: false };
  obstacles = [];
  score = 0;
  speed = BASE_SPEED;
  spawnTimer = 70;
  gap = GAP_MAX;
  invuln = 0;
  shakeFrames = 0;
  runT = 0;
  running = false;
  scoreEl.textContent = "0";
  chaserFill.style.width = "0%";
}

function start() {
  reset();
  running = true;
  overlay.classList.add("hidden");
}

function jump() {
  if (!running) { start(); return; }
  if (!player.jumping) {
    player.jumping = true;
    player.ducking = false;
    player.vy = JUMP_V;
  }
}

function setDuck(on) {
  if (!running || player.jumping) return;
  player.ducking = on;
}

function gameOver() {
  running = false;
  const caught = gap <= 0;
  if (score > best) {
    best = score; localStorage.setItem(BEST_KEY, String(best)); bestEl.textContent = best;
    ovTitle.textContent = "New Best! 🏆";
    ovText.textContent = caught
      ? `Caught after ${score} — but that's a new record. Run again?`
      : `You ran ${score} — a new record. Run again?`;
  } else {
    ovTitle.textContent = caught ? "Caught! 🦖" : "Game Over";
    ovText.textContent = `You ran ${score}. Best is ${best}. Try again?`;
  }
  startBtn.textContent = "▶ Play Again";
  overlay.classList.remove("hidden");
}

function playerBox() {
  if (player.jumping) return { x: player.x, y: player.y, w: STAND_W, h: STAND_H };
  if (player.ducking) return { x: player.x, y: groundY - DUCK_H, w: DUCK_W, h: DUCK_H };
  return { x: player.x, y: groundY - STAND_H, w: STAND_W, h: STAND_H };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawn() {
  const roll = Math.random();
  let ob;
  if (roll < 0.55) {
    const h = 30 + Math.random() * 25, w = 18 + Math.random() * 16;
    ob = { type: "cactus", x: W, w, h, top: groundY - h, bottom: groundY };
  } else if (roll < 0.78) {
    const w = 34, h = 26;
    ob = { type: "lowFly", x: W, w, h, top: groundY - 34, bottom: groundY - 8 };
  } else {
    const w = 34, h = 26;
    ob = { type: "highFly", x: W, w, h, top: groundY - 56, bottom: groundY - 30 };
  }
  ob.hit = false;
  ob.passed = false;
  obstacles.push(ob);
}

function stumble() {
  gap = Math.max(0, gap - STUMBLE_PENALTY);
  invuln = INVULN_FRAMES;
  shakeFrames = 15;
}

function update() {
  if (!running) return;
  runT += speed * 0.08;

  // player physics
  if (player.jumping) {
    player.vy += GRAVITY;
    player.y += player.vy;
    if (player.y >= groundY - STAND_H) {
      player.y = groundY - STAND_H;
      player.jumping = false;
      player.vy = 0;
    }
  }

  // spawn
  spawnTimer--;
  if (spawnTimer <= 0) {
    spawn();
    const floor = Math.max(42, 95 - speed * 3);
    spawnTimer = floor + Math.random() * 40;
  }

  // obstacles
  const pBox = playerBox();
  for (const ob of obstacles) {
    ob.x -= speed;
    const obBox = { x: ob.x, y: ob.top, w: ob.w, h: ob.bottom - ob.top };
    if (!ob.hit && invuln <= 0 && overlap(pBox, obBox)) {
      ob.hit = true;
      stumble();
    }
    if (!ob.passed && !ob.hit && ob.x + ob.w < player.x) {
      ob.passed = true;
      gap = Math.min(GAP_MAX, gap + CLEAN_BONUS);
    }
  }
  obstacles = obstacles.filter((o) => o.x + o.w > -10);

  if (invuln > 0) invuln--;
  if (shakeFrames > 0) shakeFrames--;

  gap = Math.max(0, gap - GAP_DRAIN * speed);
  chaserFill.style.width = `${Math.round((1 - gap / GAP_MAX) * 100)}%`;

  score += speed * 0.08;
  const scoreInt = Math.floor(score);
  scoreEl.textContent = scoreInt;
  speed = Math.min(MAX_SPEED, BASE_SPEED + scoreInt * SPEED_PER_SCORE);

  if (gap <= 0) { score = scoreInt; gameOver(); }
}

// ---- drawing ---------------------------------------------------------------
function drawDino(x, y, w, h, ducking, jumping, color, eyeColor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;

  if (ducking) {
    // low, elongated body
    ctx.beginPath(); ctx.roundRect(0, h * 0.25, w, h * 0.75, 8); ctx.fill();
    ctx.beginPath(); ctx.roundRect(w - 14, 0, 16, h * 0.55, 6); ctx.fill(); // head
    // legs (small, scurrying)
    const leg = Math.sin(runT * 2) * 3;
    ctx.fillRect(6, h - 4, 8, 4 + leg);
    ctx.fillRect(w - 18, h - 4, 8, 4 - leg);
  } else {
    // body
    ctx.beginPath(); ctx.roundRect(0, h * 0.28, w * 0.72, h * 0.72, 8); ctx.fill();
    // head
    ctx.beginPath(); ctx.roundRect(w * 0.5, 0, w * 0.5, h * 0.5, 7); ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(0, h * 0.45);
    ctx.lineTo(-w * 0.28, h * 0.32);
    ctx.lineTo(0, h * 0.65);
    ctx.closePath(); ctx.fill();

    if (jumping) {
      // tucked legs mid-air
      ctx.fillRect(w * 0.16, h - 6, 8, 6);
      ctx.fillRect(w * 0.42, h - 6, 8, 6);
    } else {
      const leg = Math.sin(runT * 2.2) > 0 ? 6 : 0;
      ctx.fillRect(w * 0.14, h - 10 + leg, 8, 10 - leg);
      ctx.fillRect(w * 0.42, h - 10 + (6 - leg), 8, 4 + leg);
    }
  }

  // eye
  ctx.fillStyle = eyeColor;
  ctx.beginPath(); ctx.arc(w * 0.86, h * 0.16, 3.2, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawCactus(ob) {
  ctx.fillStyle = C("--good");
  ctx.beginPath(); ctx.roundRect(ob.x, ob.top, ob.w, ob.h, 4); ctx.fill();
  ctx.fillStyle = C("--bg-soft");
  ctx.fillRect(ob.x + ob.w * 0.3, ob.top + 4, 2, ob.h - 8);
}

function drawFlyer(ob) {
  const flap = Math.sin(runT * 3 + ob.x * 0.05) * 8;
  ctx.fillStyle = ob.type === "highFly" ? C("--neon-2") : C("--neon");
  ctx.beginPath();
  ctx.moveTo(ob.x, ob.top + ob.h / 2);
  ctx.lineTo(ob.x + ob.w * 0.5, ob.top + ob.h / 2 - 6 - Math.abs(flap));
  ctx.lineTo(ob.x + ob.w, ob.top + ob.h / 2);
  ctx.lineTo(ob.x + ob.w * 0.5, ob.top + ob.h / 2 + 6);
  ctx.closePath(); ctx.fill();
}

function draw() {
  ctx.save();
  if (shakeFrames > 0) {
    ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  }

  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#12234a");
  g.addColorStop(1, C("--bg-soft"));
  ctx.fillStyle = g;
  ctx.fillRect(-10, 0, W + 20, H);

  // ground
  ctx.strokeStyle = C("--border");
  ctx.beginPath(); ctx.moveTo(-10, groundY); ctx.lineTo(W + 10, groundY); ctx.stroke();
  ctx.fillStyle = C("--ink-faint");
  const dashOffset = running ? -(runT * 30) % 24 : 0;
  for (let x = dashOffset; x < W; x += 24) ctx.fillRect(x, groundY + 6, 12, 3);

  // chaser T-Rex, behind the player — always on screen, distance driven by gap.
  // Safe (gap near max) => far left. Danger (gap near 0) => right on the player's heels.
  const chaserScale = 1.18;
  const chaserW = STAND_W * chaserScale, chaserH = STAND_H * chaserScale;
  const CHASER_FAR_X = 8, CHASER_NEAR_X = player.x - 42;
  const chaserX = CHASER_NEAR_X - (gap / GAP_MAX) * (CHASER_NEAR_X - CHASER_FAR_X);
  const chaserY = groundY - chaserH;
  if (running || gap < GAP_MAX) {
    drawDino(chaserX, chaserY, chaserW, chaserH, false, false, "#8a2b2b", "#ffce54");
  }

  // obstacles
  for (const ob of obstacles) {
    if (ob.type === "cactus") drawCactus(ob);
    else drawFlyer(ob);
  }

  // player
  const pColor = invuln > 0 && shakeFrames > 0 ? "#ff8a8a" : C("--good");
  drawDino(player.x, player.jumping ? player.y : groundY - (player.ducking ? DUCK_H : STAND_H),
    player.ducking && !player.jumping ? DUCK_W : STAND_W,
    player.ducking && !player.jumping ? DUCK_H : STAND_H,
    player.ducking && !player.jumping, player.jumping, pColor, "#123");

  ctx.restore();

  if (shakeFrames > 0) {
    ctx.fillStyle = `rgba(255, 92, 138, ${shakeFrames / 90})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function loop() {
  requestAnimationFrame(loop);
  update();
  draw();
}

// ---- input ------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") { jump(); e.preventDefault(); }
  else if (e.code === "ArrowDown") { setDuck(true); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowDown") setDuck(false);
});
canvas.addEventListener("mousedown", jump);
canvas.addEventListener("touchstart", (e) => {
  const rect = canvas.getBoundingClientRect();
  const relY = (e.touches[0].clientY - rect.top) / rect.height;
  if (relY > 0.6) setDuck(true); else jump();
  e.preventDefault();
}, { passive: false });
canvas.addEventListener("touchend", (e) => { setDuck(false); e.preventDefault(); }, { passive: false });
startBtn.addEventListener("click", (e) => { e.stopPropagation(); start(); });

reset();
loop();

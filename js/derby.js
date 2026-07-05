/* ==========================================================================
   Crash Derby — top-down demolition derby. Ram rival cars to wreck them and
   score; hit harder than they hit you or your own armor eats the damage.
   Boost trades a cooldown for extra ramming force. Canvas only, no assets.
   ========================================================================== */
const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const bestEl = document.getElementById("best");
const armorFill = document.getElementById("armor-fill");

const BEST_KEY = "susamGames.derby.best";
let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best;

const css = getComputedStyle(document.documentElement);
const C = (n) => css.getPropertyValue(n).trim();

// ---- tunables ---------------------------------------------------------------
const WALL = 26;
const ARENA = { left: WALL, top: WALL, right: W - WALL, bottom: H - WALL };

const CAR_LEN = 34, CAR_WID = 18, CAR_R = 15;
const BARREL_R = 16;

const ACCEL = 0.24, REVERSE_ACCEL = 0.18, BRAKE = 0.4, FRICTION = 0.985;
const TURN_RATE = 0.052;
const MAX_SPEED = 6.2, MAX_REVERSE = -3.2;
const BOOST_MULT = 1.85, BOOST_ACCEL_MULT = 1.3;
const BOOST_FRAMES = 32, BOOST_COOLDOWN = 130;

const PLAYER_MAX_HP = 100;
const AI_BASE_HP = 42;
const DAMAGE_SCALE = 9.5;
const MIN_IMPACT = 0.9;
const HIT_COOLDOWN_FRAMES = 22;
const PLAYER_INVULN_FRAMES = 20;
const WRECK_BONUS = 60;
const MAX_COMBO = 6;
const COMBO_IDLE_LIMIT = 200;

let player, aiCars, barrels, particles, score, combo, comboIdle, spawnTimer, running, shakeFrames;
const keys = { up: false, down: false, left: false, right: false };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randBetween(a, b) { return a + Math.random() * (b - a); }
function normalizeAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

function aiTargetCount() { return Math.min(6, 3 + Math.floor(score / 350)); }
function aiMaxSpeed() { return Math.min(5.6, 2.4 + score / 900); }
function aiHpBonus() { return Math.min(30, score / 40); }

function makeBarrels() {
  const cx = (ARENA.left + ARENA.right) / 2, cy = (ARENA.top + ARENA.bottom) / 2;
  return [
    { x: cx, y: cy },
    { x: cx - 170, y: cy - 95 },
    { x: cx + 170, y: cy + 95 },
  ];
}

function spawnAI() {
  let x, y, tries = 0;
  do {
    x = randBetween(ARENA.left + 40, ARENA.right - 40);
    y = randBetween(ARENA.top + 40, ARENA.bottom - 40);
    tries++;
  } while (Math.hypot(x - player.x, y - player.y) < 160 && tries < 12);
  const hp = AI_BASE_HP + aiHpBonus();
  aiCars.push({
    x, y, angle: Math.random() * Math.PI * 2, speed: 0,
    hp, maxHp: hp,
    maxSpeed: aiMaxSpeed() * (0.75 + Math.random() * 0.5),
    wanderTimer: 0, targetAngle: Math.random() * Math.PI * 2,
    color: `hsl(${Math.floor(Math.random() * 360)} 70% 55%)`,
    hitCooldown: 0, wrecked: false,
  });
}

function reset() {
  player = {
    x: (ARENA.left + ARENA.right) / 2, y: ARENA.bottom - 70, angle: -Math.PI / 2,
    speed: 0, hp: PLAYER_MAX_HP, boostFrames: 0, boostCooldown: 0, invuln: 0,
  };
  aiCars = [];
  particles = [];
  barrels = makeBarrels();
  score = 0;
  combo = 1;
  comboIdle = 0;
  spawnTimer = 0;
  shakeFrames = 0;
  running = false;
  scoreEl.textContent = "0";
  comboEl.textContent = "x1";
  armorFill.style.width = "100%";
  for (let i = 0; i < 3; i++) spawnAI();
}

function start() {
  reset();
  running = true;
  overlay.classList.add("hidden");
}

function tryBoost() {
  if (!running) { start(); return; }
  if (player.boostCooldown <= 0 && player.boostFrames <= 0) {
    player.boostFrames = BOOST_FRAMES;
    player.boostCooldown = BOOST_COOLDOWN;
  }
}

function gameOver() {
  running = false;
  const finalScore = Math.floor(score);
  if (finalScore > best) {
    best = finalScore; localStorage.setItem(BEST_KEY, String(best)); bestEl.textContent = best;
    ovTitle.textContent = "New Best! 🏆";
    ovText.textContent = `You scored ${finalScore} — a new record. Run it again?`;
  } else {
    ovTitle.textContent = "Wrecked! 💥";
    ovText.textContent = `You scored ${finalScore}. Best is ${best}. Try again?`;
  }
  startBtn.textContent = "▶ Play Again";
  overlay.classList.remove("hidden");
}

function damagePlayer(dmg) {
  if (player.invuln > 0 || dmg <= 0) return;
  player.hp = Math.max(0, player.hp - dmg);
  player.invuln = PLAYER_INVULN_FRAMES;
  armorFill.style.width = `${Math.round((player.hp / PLAYER_MAX_HP) * 100)}%`;
  if (player.hp <= 0) gameOver();
}

function registerRam(dmg) {
  combo = Math.min(MAX_COMBO, combo + 1);
  comboIdle = 0;
  score += dmg * combo;
  scoreEl.textContent = Math.floor(score);
  comboEl.textContent = `x${combo}`;
}

function comboBreak() {
  combo = 1;
  comboIdle = 0;
  comboEl.textContent = "x1";
}

function wreckAI(ai) {
  ai.wrecked = true;
  score += WRECK_BONUS * combo;
  scoreEl.textContent = Math.floor(score);
  spawnExplosion(ai.x, ai.y);
  shakeFrames = Math.max(shakeFrames, 14);
}

// ---- particles --------------------------------------------------------------
function spawnExplosion(x, y) {
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, spd = 1 + Math.random() * 3.5;
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 26 + Math.random() * 10, maxLife: 36, color: i % 2 ? C("--gold") : C("--neon-3"), size: 2 + Math.random() * 3 });
  }
}
function spawnSparks(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, spd = 0.5 + Math.random() * 2;
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 14 + Math.random() * 6, maxLife: 20, color: C("--gold"), size: 1.5 + Math.random() * 2 });
  }
}
function updateParticles() {
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life--; }
  particles = particles.filter((p) => p.life > 0);
}

// ---- physics ------------------------------------------------------------
function wallCollision(car, isPlayer) {
  let bounced = false;
  if (car.x < ARENA.left + CAR_R) { car.x = ARENA.left + CAR_R; car.speed *= -0.35; bounced = true; }
  if (car.x > ARENA.right - CAR_R) { car.x = ARENA.right - CAR_R; car.speed *= -0.35; bounced = true; }
  if (car.y < ARENA.top + CAR_R) { car.y = ARENA.top + CAR_R; car.speed *= -0.35; bounced = true; }
  if (car.y > ARENA.bottom - CAR_R) { car.y = ARENA.bottom - CAR_R; car.speed *= -0.35; bounced = true; }
  if (bounced && isPlayer && Math.abs(car.speed) > 1.6) {
    damagePlayer(Math.abs(car.speed) * 2.2);
    shakeFrames = Math.max(shakeFrames, 8);
  }
}

function barrelCollision(car, isPlayer) {
  for (const b of barrels) {
    const dx = car.x - b.x, dy = car.y - b.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const minDist = CAR_R + BARREL_R;
    if (dist >= minDist) continue;
    const nx = dx / dist, ny = dy / dist;
    car.x += nx * (minDist - dist);
    car.y += ny * (minDist - dist);
    const vx = Math.cos(car.angle) * car.speed, vy = Math.sin(car.angle) * car.speed;
    const impact = Math.abs(vx * nx + vy * ny);
    car.speed *= -0.3;
    if (impact < MIN_IMPACT) continue;
    if (isPlayer) damagePlayer(impact * 3.8);
    else car.hp -= impact * 4.5;
  }
}

function updatePlayer() {
  let turnDir = 0;
  if (keys.left) turnDir -= 1;
  if (keys.right) turnDir += 1;
  const boosting = player.boostFrames > 0;
  const speedFrac = Math.min(1, Math.abs(player.speed) / MAX_SPEED);
  player.angle += TURN_RATE * turnDir * (0.45 + 0.55 * speedFrac);

  if (keys.up) player.speed += ACCEL * (boosting ? BOOST_ACCEL_MULT : 1);
  else if (keys.down) player.speed -= player.speed > 0.05 ? BRAKE : REVERSE_ACCEL;
  else player.speed *= FRICTION;

  const maxFwd = MAX_SPEED * (boosting ? BOOST_MULT : 1);
  player.speed = clamp(player.speed, MAX_REVERSE, maxFwd);

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;
  wallCollision(player, true);

  if (player.boostFrames > 0) player.boostFrames--;
  if (player.boostCooldown > 0) player.boostCooldown--;
  if (player.invuln > 0) player.invuln--;
}

function updateAI(ai) {
  ai.wanderTimer--;
  if (ai.wanderTimer <= 0) {
    ai.targetAngle = Math.random() * Math.PI * 2;
    ai.wanderTimer = 60 + Math.random() * 90;
  }
  const margin = 70;
  if (ai.x < ARENA.left + margin || ai.x > ARENA.right - margin || ai.y < ARENA.top + margin || ai.y > ARENA.bottom - margin) {
    ai.targetAngle = Math.atan2(H / 2 - ai.y, W / 2 - ai.x);
  }
  const diff = normalizeAngle(ai.targetAngle - ai.angle);
  ai.angle += clamp(diff, -TURN_RATE * 0.8, TURN_RATE * 0.8);
  const wanderSpeed = ai.maxSpeed * (0.6 + 0.4 * Math.random());
  ai.speed += (wanderSpeed - ai.speed) * 0.05;
  ai.x += Math.cos(ai.angle) * ai.speed;
  ai.y += Math.sin(ai.angle) * ai.speed;
  wallCollision(ai, false);
  if (ai.hitCooldown > 0) ai.hitCooldown--;
}

function separateAIs() {
  for (let i = 0; i < aiCars.length; i++) {
    for (let j = i + 1; j < aiCars.length; j++) {
      const a = aiCars[i], b = aiCars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const minDist = CAR_R * 1.8;
      if (dist >= minDist) continue;
      const nx = dx / dist, ny = dy / dist, overlap = (minDist - dist) * 0.5;
      a.x -= nx * overlap; a.y -= ny * overlap;
      b.x += nx * overlap; b.y += ny * overlap;
    }
  }
}

function resolveCarCollision(ai) {
  if (ai.hitCooldown > 0 || ai.wrecked) return;
  const dx = ai.x - player.x, dy = ai.y - player.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const minDist = CAR_R * 1.8;
  if (dist >= minDist) return;

  const nx = dx / dist, ny = dy / dist, overlap = minDist - dist;
  player.x -= nx * overlap * 0.5; player.y -= ny * overlap * 0.5;
  ai.x += nx * overlap * 0.5; ai.y += ny * overlap * 0.5;

  const pvx = Math.cos(player.angle) * player.speed, pvy = Math.sin(player.angle) * player.speed;
  const avx = Math.cos(ai.angle) * ai.speed, avy = Math.sin(ai.angle) * ai.speed;
  const closing = (pvx - avx) * nx + (pvy - avy) * ny; // > 0: player closing onto ai (ramming)
  const impact = Math.abs(closing);
  ai.hitCooldown = HIT_COOLDOWN_FRAMES;
  player.speed *= -0.25;
  ai.speed *= -0.25;

  if (impact < MIN_IMPACT) return;
  spawnSparks((player.x + ai.x) / 2, (player.y + ai.y) / 2);

  const dmg = impact * DAMAGE_SCALE;
  if (closing > 0) {
    ai.hp -= dmg;
    damagePlayer(dmg * 0.22);
    registerRam(dmg);
  } else {
    damagePlayer(dmg);
    ai.hp -= dmg * 0.15;
    comboBreak();
  }

  if (ai.hp <= 0 && !ai.wrecked) wreckAI(ai);
}

function update() {
  if (!running) return;

  updatePlayer();
  barrelCollision(player, true);

  for (const ai of aiCars) { updateAI(ai); barrelCollision(ai, false); }
  separateAIs();
  for (const ai of aiCars) resolveCarCollision(ai);
  aiCars = aiCars.filter((ai) => !ai.wrecked);

  spawnTimer--;
  if (aiCars.length < aiTargetCount() && spawnTimer <= 0) {
    spawnAI();
    spawnTimer = 30 + Math.random() * 40;
  }

  updateParticles();

  comboIdle++;
  if (comboIdle > COMBO_IDLE_LIMIT && combo > 1) comboBreak();

  if (shakeFrames > 0) shakeFrames--;
}

// ---- drawing ---------------------------------------------------------------
function drawCar(x, y, angle, bodyColor, windColor, flash, boosting) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (boosting) {
    ctx.fillStyle = "rgba(255, 209, 102, 0.55)";
    ctx.beginPath();
    ctx.moveTo(-CAR_LEN / 2, -CAR_WID * 0.3);
    ctx.lineTo(-CAR_LEN / 2 - 12 - Math.random() * 6, 0);
    ctx.lineTo(-CAR_LEN / 2, CAR_WID * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath(); ctx.ellipse(2, 3, CAR_LEN * 0.55, CAR_WID * 0.55, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = flash ? "#ff8a8a" : bodyColor;
  ctx.beginPath(); ctx.roundRect(-CAR_LEN / 2, -CAR_WID / 2, CAR_LEN, CAR_WID, 6); ctx.fill();

  ctx.fillStyle = windColor;
  ctx.beginPath(); ctx.roundRect(-CAR_LEN * 0.05, -CAR_WID * 0.32, CAR_LEN * 0.32, CAR_WID * 0.64, 3); ctx.fill();

  ctx.fillStyle = "#ffe9a8";
  ctx.beginPath(); ctx.arc(CAR_LEN / 2 - 3, -CAR_WID / 2 + 3, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(CAR_LEN / 2 - 3, CAR_WID / 2 - 3, 1.6, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#ff5c5c";
  ctx.beginPath(); ctx.arc(-CAR_LEN / 2 + 3, -CAR_WID / 2 + 3, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-CAR_LEN / 2 + 3, CAR_WID / 2 - 3, 1.4, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function draw() {
  ctx.save();
  if (shakeFrames > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);

  ctx.fillStyle = C("--bg-soft");
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(120, 140, 255, 0.08)";
  for (let x = ARENA.left; x < ARENA.right; x += 40) { ctx.beginPath(); ctx.moveTo(x, ARENA.top); ctx.lineTo(x, ARENA.bottom); ctx.stroke(); }
  for (let y = ARENA.top; y < ARENA.bottom; y += 40) { ctx.beginPath(); ctx.moveTo(ARENA.left, y); ctx.lineTo(ARENA.right, y); ctx.stroke(); }

  ctx.lineWidth = 4;
  ctx.strokeStyle = C("--neon");
  ctx.strokeRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top);
  ctx.lineWidth = 1;

  for (const b of barrels) {
    ctx.fillStyle = C("--gold");
    ctx.beginPath(); ctx.arc(b.x, b.y, BARREL_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C("--bg");
    ctx.beginPath(); ctx.arc(b.x, b.y, BARREL_R * 0.6, 0, Math.PI * 2); ctx.stroke();
  }

  for (const ai of aiCars) {
    drawCar(ai.x, ai.y, ai.angle, ai.color, "#1c2340", ai.hitCooldown > HIT_COOLDOWN_FRAMES - 6, false);
    const hpFrac = Math.max(0, ai.hp / ai.maxHp);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; ctx.fillRect(ai.x - 14, ai.y - 24, 28, 4);
    ctx.fillStyle = hpFrac > 0.4 ? C("--good") : C("--neon-3");
    ctx.fillRect(ai.x - 14, ai.y - 24, 28 * hpFrac, 4);
  }

  drawCar(player.x, player.y, player.angle, player.boostFrames > 0 ? C("--gold") : C("--good"), "#123", player.invuln > 0 && shakeFrames > 0, player.boostFrames > 0);

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

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
function setKey(code, on) {
  switch (code) {
    case "ArrowUp": case "KeyW": keys.up = on; break;
    case "ArrowDown": case "KeyS": keys.down = on; break;
    case "ArrowLeft": case "KeyA": keys.left = on; break;
    case "ArrowRight": case "KeyD": keys.right = on; break;
  }
}
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { tryBoost(); e.preventDefault(); return; }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
    if (!running) { start(); }
    setKey(e.code, true);
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => setKey(e.code, false));

function bindHold(el, onKey) {
  const press = (e) => { e.preventDefault(); if (!running) start(); keys[onKey] = true; };
  const release = (e) => { e.preventDefault(); keys[onKey] = false; };
  el.addEventListener("pointerdown", press);
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", release);
}
bindHold(document.getElementById("d-up"), "up");
bindHold(document.getElementById("d-down"), "down");
bindHold(document.getElementById("d-left"), "left");
bindHold(document.getElementById("d-right"), "right");

document.getElementById("boost-btn").addEventListener("pointerdown", (e) => { e.stopPropagation(); tryBoost(); });
startBtn.addEventListener("click", (e) => { e.stopPropagation(); start(); });

reset();
loop();

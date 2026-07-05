/* ==========================================================================
   Hill Climb Racer — side-scrolling physics climber. The chassis is just
   three points (rear wheel, front wheel, cab) held rigid by distance
   constraints and integrated with Verlet; every tilt, wheelie and flip
   falls out of that naturally, no explicit rotation/torque bookkeeping
   needed except the deliberate air-lean control. Canvas only, no assets.
   ========================================================================== */
const canvas = document.getElementById("track");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startCarBtn = document.getElementById("start-car");
const startBikeBtn = document.getElementById("start-bike");
const scoreEl = document.getElementById("score");
const coinsEl = document.getElementById("coins");
const bestEl = document.getElementById("best");
const fuelFill = document.getElementById("fuel-fill");

const BEST_KEY = "susamGames.hillclimb.best";
let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best;

// ---- tunables ---------------------------------------------------------------
const PPM = 12; // pixels per metre, for the distance readout
const GROUND_BASE = H * 0.6;
const CONSTRAINT_ITERATIONS = 3;
const DAMPING = 0.996;
const GROUND_FRICTION = 0.86;
const BOUNCE = 0.08;
const ROOF_CLEARANCE = 6;
const FUEL_MAX = 100;
const FUEL_DRAIN_IDLE = 0.018;
const FUEL_DRAIN_GAS = 0.05;
const FUEL_PICKUP = 38;
const COIN_VALUE = 25;
const FLIP_BONUS_COINS = 3;

const VEHICLES = {
  car: {
    name: "Car", wheelbase: 74, wheelRadius: 17, roofLocal: { x: 42, y: -36 },
    gravity: 0.62, engineForce: 0.95, airTurnRate: 0.030,
    bodyColor: "#3fae5c", bodyColor2: "#2f8a47", windowColor: "#bfe6ff",
  },
  bike: {
    name: "Bike", wheelbase: 56, wheelRadius: 13, roofLocal: { x: 30, y: -32 },
    gravity: 0.58, engineForce: 1.15, airTurnRate: 0.042,
    bodyColor: "#e0553c", bodyColor2: "#b8402a", windowColor: "#ffd8c8",
  },
};

let vehicle, rear, front, roof, rodRF, rodRR, rodFR;
let throttle = 0;
let waveSet, bumps, nextBumpX;
let camera, distance, maxDistance, coins, fuel, running;
let particles, toasts;
let airborne, airSpin, wheelSpinRear, wheelSpinFront;
let coinList, fuelList, nextPickupX;
let startX;

const keys = { gas: false, brake: false };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function distTo(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function pt(x, y) { return { x, y, ox: x, oy: y }; }

// ---- terrain ------------------------------------------------------------
function difficultyAt(x) { return clamp(1 + x / 9000, 1, 2.6); }

function groundHeight(x) {
  let h = GROUND_BASE;
  for (const w of waveSet) h += w.amp * difficultyAt(x) * Math.sin(x / w.wavelength + w.phase);
  for (const b of bumps) {
    const dx = x - b.cx;
    if (Math.abs(dx) < b.width * 3) h -= b.height * Math.exp(-(dx * dx) / (2 * b.width * b.width));
  }
  return h;
}

function ensureBumps(aheadX) {
  while (nextBumpX < aheadX) {
    const diff = difficultyAt(nextBumpX);
    bumps.push({ cx: nextBumpX, width: rand(26, 46), height: rand(18, 30) * diff });
    nextBumpX += rand(260, 420) / Math.sqrt(diff);
  }
  bumps = bumps.filter((b) => b.cx + b.width * 3 > camera.x - 300);
}

function ensurePickups(aheadX) {
  while (nextPickupX < aheadX) {
    const gy = groundHeight(nextPickupX);
    if (Math.random() < 0.35) {
      fuelList.push({ x: nextPickupX, y: gy - rand(46, 70), taken: false });
    } else {
      for (let i = 0; i < 3; i++) coinList.push({ x: nextPickupX + i * 22, y: gy - rand(50, 90), taken: false });
    }
    nextPickupX += rand(300, 520);
  }
  coinList = coinList.filter((c) => !c.taken && c.x > camera.x - 200);
  fuelList = fuelList.filter((f) => !f.taken && f.x > camera.x - 200);
}

// ---- setup ----------------------------------------------------------------
function rodLengths(v) {
  rodRF = v.wheelbase;
  rodRR = Math.hypot(v.roofLocal.x, v.roofLocal.y);
  rodFR = Math.hypot(v.roofLocal.x - v.wheelbase, v.roofLocal.y);
}

function reset(vehicleKey) {
  vehicle = VEHICLES[vehicleKey];
  rodLengths(vehicle);

  waveSet = [
    { amp: rand(16, 24), wavelength: rand(220, 300), phase: rand(0, 7) },
    { amp: rand(30, 46), wavelength: rand(520, 700), phase: rand(0, 7) },
    { amp: rand(6, 10), wavelength: rand(70, 110), phase: rand(0, 7) },
  ];
  bumps = [];
  nextBumpX = 420;
  startX = 60;
  camera = { x: 0, y: 0 };

  const gy0 = groundHeight(startX + vehicle.wheelbase / 2);
  rear = pt(startX, gy0 - vehicle.wheelRadius);
  front = pt(startX + vehicle.wheelbase, gy0 - vehicle.wheelRadius);
  roof = pt(startX + vehicle.roofLocal.x, gy0 - vehicle.wheelRadius + vehicle.roofLocal.y);
  camera.x = rear.x - W * 0.32;
  camera.y = gy0 - H * 0.55;

  distance = 0; maxDistance = 0; coins = 0; fuel = FUEL_MAX;
  particles = []; toasts = [];
  airborne = false; airSpin = 0; wheelSpinRear = 0; wheelSpinFront = 0;
  coinList = []; fuelList = []; nextPickupX = 520;
  running = false;
  throttle = 0;

  scoreEl.textContent = "0";
  coinsEl.textContent = "0";
  fuelFill.style.width = "100%";
}

function start(vehicleKey) {
  reset(vehicleKey);
  running = true;
  overlay.classList.add("hidden");
}

// ---- physics --------------------------------------------------------------
function satisfy(a, b, rest) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const diff = ((d - rest) / d) * 0.5;
  const ox = dx * diff, oy = dy * diff;
  a.x += ox; a.y += oy;
  b.x -= ox; b.y -= oy;
}

function relaxConstraints() {
  for (let i = 0; i < CONSTRAINT_ITERATIONS; i++) {
    satisfy(rear, front, rodRF);
    satisfy(rear, roof, rodRR);
    satisfy(front, roof, rodFR);
  }
}

function collideWheel(p, radius, tangentForce) {
  const gx = p.x;
  const gy = groundHeight(gx);
  const m = (groundHeight(gx + 2) - groundHeight(gx - 2)) / 4;
  const invLen = 1 / Math.sqrt(m * m + 1);
  const nx = m * invLen, ny = -invLen;
  const d = (p.y - gy) * ny;
  const depth = radius - d;
  if (depth <= 0) return false;

  const vx = p.x - p.ox, vy = p.y - p.oy;
  p.x += nx * depth;
  p.y += ny * depth;

  const tx = -ny, ty = nx;
  const vn = vx * nx + vy * ny;
  const vt = (vx * tx + vy * ty) * GROUND_FRICTION + tangentForce;
  const vnNew = vn < 0 ? -vn * BOUNCE : vn;

  const newVx = vnNew * nx + vt * tx;
  const newVy = vnNew * ny + vt * ty;
  p.ox = p.x - newVx;
  p.oy = p.y - newVy;
  return true;
}

function rotateBody(angle) {
  const cx = (rear.x + front.x + roof.x) / 3;
  const cy = (rear.y + front.y + roof.y) / 3;
  const c = Math.cos(angle), s = Math.sin(angle);
  for (const p of [rear, front, roof]) {
    const dx = p.x - cx, dy = p.y - cy;
    p.x = cx + dx * c - dy * s;
    p.y = cy + dx * s + dy * c;
  }
}

function spawnDust(x, y) {
  for (let i = 0; i < 2; i++) {
    particles.push({
      x, y, vx: rand(-0.6, 0.6) - throttle * 0.5, vy: rand(-1, -0.2),
      life: 22, maxLife: 22, size: rand(1.5, 3), color: "rgba(200, 190, 165, 0.55)",
    });
  }
}

function spawnCrashParticles() {
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2, spd = 1 + Math.random() * 4;
    particles.push({
      x: roof.x, y: roof.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 30 + Math.random() * 12, maxLife: 42, size: 2 + Math.random() * 3,
      color: Math.random() < 0.5 ? "#ffd166" : "#ff5c8a",
    });
  }
}

function collectPickups() {
  const pts = [rear, front, roof];
  for (const c of coinList) {
    if (c.taken) continue;
    for (const p of pts) {
      if (distTo(p.x, p.y, c.x, c.y) < 24) { c.taken = true; coins++; break; }
    }
  }
  for (const f of fuelList) {
    if (f.taken) continue;
    for (const p of pts) {
      if (distTo(p.x, p.y, f.x, f.y) < 26) { f.taken = true; fuel = clamp(fuel + FUEL_PICKUP, 0, FUEL_MAX); break; }
    }
  }
}

function updateScore() {
  const score = Math.floor(maxDistance) + coins * COIN_VALUE;
  scoreEl.textContent = String(score);
  coinsEl.textContent = String(coins);
  return score;
}

function gameOver(reason) {
  running = false;
  spawnCrashParticles();
  const finalScore = Math.floor(maxDistance) + coins * COIN_VALUE;
  if (finalScore > best) {
    best = finalScore;
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    ovTitle.textContent = "New Best! 🏆";
    ovText.textContent = `You reached ${Math.floor(maxDistance)}m with ${coins} coins — a new record. Pick a ride and go again.`;
  } else {
    const why = reason === "fuel" ? "ran out of fuel" : "flipped and crashed";
    ovTitle.textContent = reason === "fuel" ? "Out of Fuel! ⛽" : "Crashed! 💥";
    ovText.textContent = `You ${why} at ${Math.floor(maxDistance)}m. Best is ${best}. Pick a ride and try again.`;
  }
  overlay.classList.remove("hidden");
}

function physicsStep() {
  for (const p of [rear, front, roof]) {
    const vx = (p.x - p.ox) * DAMPING;
    const vy = (p.y - p.oy) * DAMPING + vehicle.gravity;
    p.ox = p.x; p.oy = p.y;
    p.x += vx; p.y += vy;
  }
  relaxConstraints();

  const rearForce = throttle * vehicle.engineForce;
  const groundedRear = collideWheel(rear, vehicle.wheelRadius, rearForce);
  const frontForce = groundedRear ? 0 : throttle * vehicle.engineForce * 0.4;
  const groundedFront = collideWheel(front, vehicle.wheelRadius, frontForce);
  relaxConstraints();

  const grounded = groundedRear || groundedFront;

  if (!grounded && throttle !== 0) {
    const da = -vehicle.airTurnRate * throttle;
    rotateBody(da);
    airSpin += da;
  }
  if (grounded) {
    if (airborne && Math.abs(airSpin) > Math.PI * 1.7) {
      coins += FLIP_BONUS_COINS;
      toasts.push({ x: (rear.x + front.x) / 2, y: roof.y - 20, text: "🎉 Flip bonus!", life: 60 });
    }
    airborne = false;
    airSpin = 0;
    if (Math.abs(throttle) > 0 && Math.random() < 0.5) spawnDust((rear.x + front.x) / 2, Math.max(rear.y, front.y) + 6);
  } else {
    airborne = true;
  }

  wheelSpinRear += (rear.x - rear.ox) / vehicle.wheelRadius;
  wheelSpinFront += (front.x - front.ox) / vehicle.wheelRadius;

  const roofGY = groundHeight(roof.x);
  if (roof.y > roofGY - ROOF_CLEARANCE) { gameOver("crash"); return; }

  const carX = (rear.x + front.x) / 2;
  distance = (carX - startX) / PPM;
  if (distance > maxDistance) maxDistance = distance;

  fuel = clamp(fuel - (FUEL_DRAIN_IDLE + (throttle > 0 ? FUEL_DRAIN_GAS : 0)), 0, FUEL_MAX);
  fuelFill.style.width = `${fuel}%`;
  if (fuel <= 0) { gameOver("fuel"); return; }

  collectPickups();
  updateScore();
}

function updateCamera() {
  const carX = (rear.x + front.x) / 2;
  camera.x += (carX - W * 0.32 - camera.x) * 0.18;
  const targetY = groundHeight(carX) - H * 0.55;
  camera.y += (targetY - camera.y) * 0.06;
}

function updateParticles() {
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.96; p.life--; }
  particles = particles.filter((p) => p.life > 0);
}

function updateToasts() {
  for (const t of toasts) { t.y -= 0.4; t.life--; }
  toasts = toasts.filter((t) => t.life > 0);
}

function update() {
  if (running) {
    throttle = keys.gas ? 1 : keys.brake ? -1 : 0;
    ensureBumps(camera.x + W * 1.6);
    ensurePickups(camera.x + W * 1.6);
    physicsStep();
  }
  updateCamera();
  updateParticles();
  updateToasts();
}

// ---- drawing ---------------------------------------------------------------
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#161b3a");
  g.addColorStop(0.6, "#2a2a58");
  g.addColorStop(1, "#4a3d6b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawParallax(factor, color, waveAmp, waveLen, baseY) {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let sx = 0; sx <= W; sx += 20) {
    const wx = camera.x * factor + sx;
    const y = baseY + Math.sin(wx / waveLen) * waveAmp - camera.y * factor * 0.2;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTerrain() {
  ctx.beginPath();
  ctx.moveTo(-10, H + 10);
  const step = 10;
  for (let sx = -10; sx <= W + 10; sx += step) {
    const wx = camera.x + sx;
    const gy = groundHeight(wx) - camera.y;
    ctx.lineTo(sx, gy);
  }
  ctx.lineTo(W + 10, H + 10);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, GROUND_BASE - camera.y - 60, 0, H);
  g.addColorStop(0, "#4c9a4c");
  g.addColorStop(0.12, "#3d7a3d");
  g.addColorStop(0.35, "#6b4a2f");
  g.addColorStop(1, "#2c1d12");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  for (let sx = -10; sx <= W + 10; sx += step) {
    const wx = camera.x + sx;
    const gy = groundHeight(wx) - camera.y;
    if (sx === -10) ctx.moveTo(sx, gy); else ctx.lineTo(sx, gy);
  }
  ctx.strokeStyle = "#7fd17f";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawPickups() {
  ctx.font = "22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const c of coinList) {
    const sx = c.x - camera.x, sy = c.y - camera.y;
    if (sx < -30 || sx > W + 30) continue;
    ctx.fillText("🪙", sx, sy);
  }
  for (const f of fuelList) {
    const sx = f.x - camera.x, sy = f.y - camera.y;
    if (sx < -30 || sx > W + 30) continue;
    ctx.fillText("⛽", sx, sy);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawWheel(p, radius, spin, color) {
  const sx = p.x - camera.x, sy = p.y - camera.y;
  ctx.fillStyle = "#161c2e";
  ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(sx, sy, radius * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#0b0e1a";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a) * radius * 0.85, sy + Math.sin(a) * radius * 0.85);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
}

function drawCar() {
  const fx = front.x - rear.x, fy = front.y - rear.y;
  const flen = Math.hypot(fx, fy) || 1;
  const fwx = fx / flen, fwy = fy / flen;
  const dwx = -fwy, dwy = fwx;
  const rx = rear.x - camera.x, ry = rear.y - camera.y;

  const toScreen = (lx, ly) => ({ x: rx + fwx * lx + dwx * ly, y: ry + fwy * lx + dwy * ly });
  const wb = vehicle.wheelbase, rl = vehicle.roofLocal;

  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  const groundShadowY = groundHeight((rear.x + front.x) / 2) - camera.y + 4;
  ctx.ellipse((rx + (front.x - camera.x)) / 2, groundShadowY, wb * 0.7, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (vehicle.name === "Car") {
    const outline = [
      [-14, -6], [-8, -24], [rl.x - 16, rl.y + 4], [rl.x + 12, rl.y + 4],
      [wb + 2, -18], [wb + 16, -2], [wb + 6, 8], [-6, 8],
    ].map(([lx, ly]) => toScreen(lx, ly));
    ctx.beginPath();
    ctx.moveTo(outline[0].x, outline[0].y);
    for (const p of outline.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fillStyle = vehicle.bodyColor;
    ctx.fill();
    ctx.strokeStyle = vehicle.bodyColor2;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;

    const win = [[rl.x - 12, rl.y + 6], [rl.x + 8, rl.y + 6], [rl.x + 2, -20], [rl.x - 8, -20]].map(([lx, ly]) => toScreen(lx, ly));
    ctx.beginPath();
    ctx.moveTo(win[0].x, win[0].y);
    for (const p of win.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fillStyle = vehicle.windowColor;
    ctx.fill();
  } else {
    const seat = toScreen(rl.x, rl.y);
    const rearTop = toScreen(-4, -8);
    const frontTop = toScreen(wb + 6, -10);
    const head = toScreen(rl.x - 4, rl.y - 18);

    ctx.strokeStyle = vehicle.bodyColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(rx, ry); ctx.lineTo(seat.x, seat.y);
    ctx.lineTo(frontTop.x, frontTop.y);
    ctx.moveTo(seat.x, seat.y); ctx.lineTo(rearTop.x, rearTop.y);
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = "#f0d8a0";
    ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = vehicle.bodyColor2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(head.x, head.y + 6); ctx.lineTo(seat.x, seat.y);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  drawWheel(rear, vehicle.wheelRadius, wheelSpinRear, "#8a8fa8");
  drawWheel(front, vehicle.wheelRadius, wheelSpinFront, "#8a8fa8");
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawToasts() {
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  for (const t of toasts) {
    ctx.globalAlpha = Math.max(0, t.life / 60);
    ctx.fillStyle = "#ffd166";
    ctx.fillText(t.text, t.x - camera.x, t.y - camera.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

function draw() {
  drawSky();
  drawParallax(0.3, "rgba(90, 80, 150, 0.35)", 40, 400, H * 0.55);
  drawParallax(0.55, "rgba(70, 60, 120, 0.5)", 60, 300, H * 0.68);
  drawTerrain();
  drawPickups();
  drawCar();
  drawParticles();
  drawToasts();
}

function loop() {
  requestAnimationFrame(loop);
  update();
  draw();
}

// ---- input ------------------------------------------------------------------
const GAS_KEYS = ["ArrowUp", "ArrowRight", "KeyW", "KeyD"];
const BRAKE_KEYS = ["ArrowDown", "ArrowLeft", "KeyS", "KeyA"];

window.addEventListener("keydown", (e) => {
  if (GAS_KEYS.includes(e.code)) { keys.gas = true; e.preventDefault(); }
  else if (BRAKE_KEYS.includes(e.code)) { keys.brake = true; e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  if (GAS_KEYS.includes(e.code)) keys.gas = false;
  else if (BRAKE_KEYS.includes(e.code)) keys.brake = false;
});

function bindHold(el, onKey) {
  const press = (e) => { e.preventDefault(); keys[onKey] = true; };
  const release = (e) => { e.preventDefault(); keys[onKey] = false; };
  el.addEventListener("pointerdown", press);
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", release);
}
bindHold(document.getElementById("gas-btn"), "gas");
bindHold(document.getElementById("brake-btn"), "brake");

startCarBtn.addEventListener("click", (e) => { e.stopPropagation(); start("car"); });
startBikeBtn.addEventListener("click", (e) => { e.stopPropagation(); start("bike"); });

reset("car");
loop();

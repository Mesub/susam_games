/* ==========================================================================
   Pong — you vs. a CPU paddle, first to 7. Canvas only, no assets.
   ========================================================================== */
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const youEl = document.getElementById("you");
const cpuEl = document.getElementById("cpu");

const css = getComputedStyle(document.documentElement);
const C = (n) => css.getPropertyValue(n).trim();

const PW = 12, PH = 74, MARGIN = 18, WIN = 7;
let player, cpu, ball, scoreY, scoreC, running;

function resetBall(dir) {
  ball = { x: W / 2, y: H / 2, r: 8, vx: dir * 4, vy: (Math.random() * 4 - 2) };
}

function reset() {
  player = { x: MARGIN, y: H / 2 - PH / 2, up: false, down: false };
  cpu = { x: W - MARGIN - PW, y: H / 2 - PH / 2 };
  scoreY = 0; scoreC = 0;
  youEl.textContent = "0"; cpuEl.textContent = "0";
  resetBall(Math.random() < 0.5 ? -1 : 1);
  running = false;
}

function start() {
  reset();
  running = true;
  overlay.classList.add("hidden");
}

function endGame(won) {
  running = false;
  ovTitle.textContent = won ? "You win! 🏆" : "CPU wins 🤖";
  ovText.textContent = won
    ? `Final ${scoreY}–${scoreC}. Nicely played. Rematch?`
    : `Final ${scoreY}–${scoreC}. The CPU got the better of you. Rematch?`;
  startBtn.textContent = "▶ Rematch";
  overlay.classList.remove("hidden");
}

function score(who) {
  if (who === "you") { scoreY++; youEl.textContent = scoreY; }
  else { scoreC++; cpuEl.textContent = scoreC; }
  if (scoreY >= WIN) return endGame(true);
  if (scoreC >= WIN) return endGame(false);
  resetBall(who === "you" ? 1 : -1);
}

function update() {
  if (!running) return;

  const pspeed = 6;
  if (player.up) player.y -= pspeed;
  if (player.down) player.y += pspeed;
  player.y = Math.max(0, Math.min(H - PH, player.y));

  // CPU tracks the ball with a capped speed (beatable but sharp)
  const target = ball.y - PH / 2;
  const cspeed = 4.6;
  if (cpu.y + 4 < target) cpu.y += Math.min(cspeed, target - cpu.y);
  else if (cpu.y - 4 > target) cpu.y -= Math.min(cspeed, cpu.y - target);
  cpu.y = Math.max(0, Math.min(H - PH, cpu.y));

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; }
  if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy *= -1; }

  // player paddle
  if (ball.vx < 0 && ball.x - ball.r < player.x + PW && ball.x - ball.r > player.x &&
      ball.y > player.y && ball.y < player.y + PH) {
    bounce(player);
  }
  // cpu paddle
  if (ball.vx > 0 && ball.x + ball.r > cpu.x && ball.x + ball.r < cpu.x + PW &&
      ball.y > cpu.y && ball.y < cpu.y + PH) {
    bounce(cpu);
  }

  if (ball.x + ball.r < 0) return score("cpu");
  if (ball.x - ball.r > W) return score("you");
}

function bounce(p) {
  const hit = (ball.y - (p.y + PH / 2)) / (PH / 2); // -1..1
  const speed = Math.min(9, Math.hypot(ball.vx, ball.vy) + 0.4);
  const angle = hit * (Math.PI / 4);
  const dir = p === player ? 1 : -1;
  ball.vx = dir * speed * Math.cos(angle);
  ball.vy = speed * Math.sin(angle);
  ball.x = p === player ? p.x + PW + ball.r : p.x - ball.r;
}

function draw() {
  ctx.fillStyle = C("--bg-soft");
  ctx.fillRect(0, 0, W, H);

  // net
  ctx.strokeStyle = "rgba(120,140,255,0.25)";
  ctx.setLineDash([8, 12]);
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = C("--neon");
  ctx.beginPath(); ctx.roundRect(player.x, player.y, PW, PH, 5); ctx.fill();
  ctx.fillStyle = C("--neon-3");
  ctx.beginPath(); ctx.roundRect(cpu.x, cpu.y, PW, PH, 5); ctx.fill();

  ctx.fillStyle = C("--ink");
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
}

function loop() {
  requestAnimationFrame(loop);
  update();
  draw();
}

// ---- input --------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") { player.up = true; e.preventDefault(); }
  else if (e.code === "ArrowDown" || e.code === "KeyS") { player.down = true; e.preventDefault(); }
  else if ((e.code === "Space" || e.code === "Enter") && !running) { start(); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") player.up = false;
  else if (e.code === "ArrowDown" || e.code === "KeyS") player.down = false;
});
startBtn.addEventListener("click", start);

function pointerTo(clientY) {
  const rect = canvas.getBoundingClientRect();
  const y = (clientY - rect.top) * (H / rect.height);
  player.y = Math.max(0, Math.min(H - PH, y - PH / 2));
}
canvas.addEventListener("mousemove", (e) => { if (running) pointerTo(e.clientY); });
canvas.addEventListener("touchmove", (e) => { if (running) { pointerTo(e.touches[0].clientY); e.preventDefault(); } }, { passive: false });
canvas.addEventListener("touchstart", (e) => { if (running) pointerTo(e.touches[0].clientY); }, { passive: true });

reset();
loop();

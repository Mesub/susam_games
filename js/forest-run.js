/* ==========================================================================
   Forest Run 3D — an endless runner built with three.js.
   You sprint down a forest trail: switch between three lanes to weave past
   the trees, and jump the fallen logs. Everything (trees, logs, ground,
   character) is procedural geometry — no external assets. Fully offline;
   three.js is vendored under js/vendor/.
   ========================================================================== */
import * as THREE from "three";

// ---- Constants -----------------------------------------------------------
const W = 720, H = 440;
const LANES = [-2.4, 0, 2.4];          // x positions of the three lanes
const PLAYER_Z = 0;                    // player stays put; world scrolls +z
const FAR_Z = -140;                    // where obstacles/scenery spawn
const RECYCLE_Z = 12;                  // past the camera → recycle
const GRAVITY = -34;
const JUMP_V = 12.5;
const BASE_SPEED = 22;
const MAX_SPEED = 52;
const BEST_KEY = "forestRun3D.best";

// ---- DOM ----------------------------------------------------------------
const stage = document.getElementById("stage");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText = document.getElementById("ov-text");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");

let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
bestEl.textContent = best;

// ---- Renderer / scene / camera ------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.maxWidth = "100%";
renderer.domElement.style.height = "auto";
stage.insertBefore(renderer.domElement, overlay);

const scene = new THREE.Scene();
const SKY = 0x8fc9e8;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 40, 130);

const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 300);
camera.position.set(0, 4.2, 9);
camera.lookAt(0, 1.4, -14);

// ---- Lights -------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x2b4a2f, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
sun.position.set(-14, 26, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);
sun.target.position.set(0, 0, -20);

// ---- Reusable materials & geometries ------------------------------------
const matTrunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.95 });
const matLeaf = [
  new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0x3aa85e, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0x277a45, roughness: 0.85 }),
];
const geoTrunk = new THREE.CylinderGeometry(0.18, 0.28, 1, 6);
const geoCone = new THREE.ConeGeometry(1, 1, 8);

// Build one pine tree as a group (trunk + 3 stacked cones).
function makeTree(scale) {
  const g = new THREE.Group();
  const trunkH = 1.4 * scale;
  const trunk = new THREE.Mesh(geoTrunk, matTrunk);
  trunk.scale.set(scale, trunkH, scale);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);

  const leaf = matLeaf[(Math.random() * matLeaf.length) | 0];
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const cone = new THREE.Mesh(geoCone, leaf);
    const cs = (1.7 - i * 0.4) * scale;
    const ch = (1.6 - i * 0.1) * scale;
    cone.scale.set(cs, ch, cs);
    cone.position.y = trunkH + i * 1.0 * scale + ch / 2 - 0.2 * scale;
    cone.castShadow = true;
    g.add(cone);
  }
  return g;
}

// ---- Ground: recycled tiles create the illusion of running forward ------
const groundTiles = [];
const TILE_LEN = 12;
const N_TILES = Math.ceil((RECYCLE_Z - FAR_Z) / TILE_LEN) + 2;
const geoTile = new THREE.PlaneGeometry(60, TILE_LEN);
const trailMat = new THREE.MeshStandardMaterial({ color: 0x6a5236, roughness: 1 });
const grassMatA = new THREE.MeshStandardMaterial({ color: 0x2c5e34, roughness: 1 });
const grassMatB = new THREE.MeshStandardMaterial({ color: 0x30693a, roughness: 1 });
const geoTrail = new THREE.PlaneGeometry(7, TILE_LEN);

for (let i = 0; i < N_TILES; i++) {
  const tile = new THREE.Group();
  const grass = new THREE.Mesh(geoTile, i % 2 ? grassMatA : grassMatB);
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  tile.add(grass);
  const trail = new THREE.Mesh(geoTrail, trailMat);
  trail.rotation.x = -Math.PI / 2;
  trail.position.y = 0.01;
  trail.receiveShadow = true;
  tile.add(trail);
  tile.position.z = RECYCLE_Z - i * TILE_LEN;
  tile.userData.tileIndex = i;
  scene.add(tile);
  groundTiles.push(tile);
}

// ---- Scenery trees (roadside) — pooled and recycled ---------------------
const scenery = [];
const N_SCENERY = 46;
for (let i = 0; i < N_SCENERY; i++) {
  const scale = 1.1 + Math.random() * 1.6;
  const t = makeTree(scale);
  placeScenery(t, FAR_Z + Math.random() * (RECYCLE_Z - FAR_Z));
  scene.add(t);
  scenery.push(t);
}
function placeScenery(t, z) {
  const side = Math.random() < 0.5 ? -1 : 1;
  t.position.x = side * (4.5 + Math.random() * 11);
  t.position.z = z;
  t.rotation.y = Math.random() * Math.PI * 2;
}

// ---- Obstacles (in-lane trees to dodge, logs to jump) -------------------
const geoLog = new THREE.CylinderGeometry(0.45, 0.45, 2.0, 10);
const matLog = new THREE.MeshStandardMaterial({ color: 0x7a5330, roughness: 0.9 });
const obstacles = [];

function spawnObstacle(z) {
  const lane = (Math.random() * 3) | 0;
  const kind = Math.random() < 0.5 ? "tree" : "log";
  let mesh;
  if (kind === "tree") {
    mesh = makeTree(1.0);
  } else {
    mesh = new THREE.Mesh(geoLog, matLog);
    mesh.rotation.z = Math.PI / 2;      // lie the log across the lane
    mesh.position.y = 0.45;
    mesh.castShadow = true;
  }
  mesh.position.x = LANES[lane];
  mesh.position.z = z;
  mesh.userData = { kind, lane };
  scene.add(mesh);
  obstacles.push(mesh);
}

// ---- Player character ----------------------------------------------------
const player = new THREE.Group();
const skin = new THREE.MeshStandardMaterial({ color: 0xffcf8a, roughness: 0.7 });
const shirt = new THREE.MeshStandardMaterial({ color: 0xff6b4a, roughness: 0.7 });
const pants = new THREE.MeshStandardMaterial({ color: 0x3a5bd6, roughness: 0.8 });

const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.45), shirt);
torso.position.y = 1.25; torso.castShadow = true; player.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), skin);
head.position.y = 1.95; head.castShadow = true; player.add(head);

const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), pants);
const legR = legL.clone();
legL.position.set(-0.17, 0.5, 0); legR.position.set(0.17, 0.5, 0);
legL.castShadow = legR.castShadow = true;
player.add(legL, legR);
const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.2), skin);
const armR = armL.clone();
armL.position.set(-0.48, 1.28, 0); armR.position.set(0.48, 1.28, 0);
player.add(armL, armR);

player.position.set(0, 0, PLAYER_Z);
scene.add(player);

// A soft round shadow blob under the player (reads well even mid-air).
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.6, 20),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 })
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.02;
scene.add(blob);

// ---- Game state ----------------------------------------------------------
const State = { READY: "ready", RUNNING: "running", OVER: "over" };
let state = State.READY;
let speed = BASE_SPEED;
let distance = 0;
let score = 0;
let laneIndex = 1;
let targetX = LANES[1];
let jumpY = 0, jumpV = 0, grounded = true;
let stride = 0;
let nextSpawnZ = FAR_Z;

function resetGame() {
  speed = BASE_SPEED;
  distance = 0;
  score = 0;
  laneIndex = 1;
  targetX = LANES[1];
  jumpY = 0; jumpV = 0; grounded = true;
  stride = 0;
  nextSpawnZ = FAR_Z;
  scoreEl.textContent = "0";

  // clear obstacles
  for (const o of obstacles) scene.remove(o);
  obstacles.length = 0;

  // reset ground tiles
  for (let i = 0; i < groundTiles.length; i++) {
    groundTiles[i].position.z = RECYCLE_Z - i * TILE_LEN;
  }
  // scatter scenery afresh
  for (const t of scenery) placeScenery(t, FAR_Z + Math.random() * (RECYCLE_Z - FAR_Z));

  player.position.set(0, 0, PLAYER_Z);
}

function startGame() {
  resetGame();
  state = State.RUNNING;
  overlay.classList.add("hidden");
}

function gameOver() {
  state = State.OVER;
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    ovTitle.textContent = "New Best! 🏆";
    ovText.textContent = "You ran " + score + "m through the forest — a new record!";
  } else {
    ovTitle.textContent = "You crashed! 🌲";
    ovText.textContent = "You ran " + score + "m. Best is " + best + "m. Run again?";
  }
  startBtn.textContent = "▶ Run Again";
  overlay.classList.remove("hidden");
}

// ---- Controls ------------------------------------------------------------
function moveLane(dir) {
  if (state !== State.RUNNING) return;
  laneIndex = Math.max(0, Math.min(2, laneIndex + dir));
  targetX = LANES[laneIndex];
}
function jump() {
  if (state !== State.RUNNING) return;
  if (grounded) { jumpV = JUMP_V; grounded = false; }
}

window.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "ArrowLeft": case "KeyA": moveLane(-1); e.preventDefault(); break;
    case "ArrowRight": case "KeyD": moveLane(1); e.preventDefault(); break;
    case "ArrowUp": case "KeyW": case "Space":
      e.preventDefault();
      if (state === State.RUNNING) jump();
      else startGame();
      break;
  }
});

startBtn.addEventListener("click", startGame);

// Touch: swipe to change lane, tap/swipe-up to jump.
let touchX = 0, touchY = 0;
stage.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  touchX = t.clientX; touchY = t.clientY;
}, { passive: true });
stage.addEventListener("touchend", (e) => {
  if (state !== State.RUNNING) { startGame(); return; }
  const t = e.changedTouches[0];
  const dx = t.clientX - touchX, dy = t.clientY - touchY;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { jump(); return; } // tap
  if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
  else if (dy < 0) jump();
}, { passive: true });

// On-screen dpad
document.getElementById("dpad").addEventListener("click", (e) => {
  const act = e.target.getAttribute("data-act");
  if (act === "left") moveLane(-1);
  else if (act === "right") moveLane(1);
  else if (act === "jump") jump();
});

// ---- Main loop -----------------------------------------------------------
const clock = new THREE.Clock();

function update(dt) {
  if (state === State.RUNNING) {
    speed = Math.min(MAX_SPEED, BASE_SPEED + distance * 0.02);
    distance += speed * dt;
    const s = Math.floor(distance);
    if (s !== score) { score = s; scoreEl.textContent = s; }

    // spawn obstacles at spaced-out z as the world scrolls
    nextSpawnZ += speed * dt;
    const gap = Math.max(9, 20 - distance * 0.006);
    if (nextSpawnZ >= FAR_Z + gap) {
      spawnObstacle(FAR_Z);
      // occasional second obstacle in a different lane once it's fast
      if (distance > 250 && Math.random() < 0.35) spawnObstacle(FAR_Z - 0.2);
      nextSpawnZ = FAR_Z;
    }
  }

  const scroll = (state === State.RUNNING ? speed : BASE_SPEED * 0.25) * dt;

  // scroll ground tiles
  for (const tile of groundTiles) {
    tile.position.z += scroll;
    if (tile.position.z > RECYCLE_Z + TILE_LEN / 2) tile.position.z -= N_TILES * TILE_LEN;
  }
  // scroll scenery
  for (const t of scenery) {
    t.position.z += scroll;
    if (t.position.z > RECYCLE_Z) placeScenery(t, FAR_Z - Math.random() * 8);
  }
  // scroll obstacles + collision
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.position.z += scroll;
    if (state === State.RUNNING && o.userData.lane === laneIndex && o.position.z > -1.2 && o.position.z < 1.2) {
      if (o.userData.kind === "tree") { gameOver(); }
      else if (jumpY < 0.9) { gameOver(); }   // log: only clears if airborne
    }
    if (o.position.z > RECYCLE_Z) { scene.remove(o); obstacles.splice(i, 1); }
  }

  // player lane lerp + jump physics
  player.position.x += (targetX - player.position.x) * Math.min(1, dt * 14);
  if (!grounded) {
    jumpV += GRAVITY * dt;
    jumpY += jumpV * dt;
    if (jumpY <= 0) { jumpY = 0; jumpV = 0; grounded = true; }
  }
  player.position.y = jumpY;
  blob.position.x = player.position.x;
  blob.scale.setScalar(1 - jumpY * 0.12);

  // running animation
  if (state === State.RUNNING) stride += dt * speed * 0.5;
  const swing = grounded ? Math.sin(stride) : 0.6;
  legL.rotation.x = swing * 0.7;
  legR.rotation.x = -swing * 0.7;
  armL.rotation.x = -swing * 0.6;
  armR.rotation.x = swing * 0.6;
  player.rotation.z = grounded ? Math.sin(stride) * 0.03 : 0;
  head.position.y = 1.95 + (grounded ? Math.abs(Math.sin(stride)) * 0.04 : 0);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
}
animate();

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const host = document.querySelector('#game');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ab5c5);
scene.fog = new THREE.Fog(0x9ab5c5, 65, 190);
const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 350);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdceeff, 0x53604d, 2.0));
const sun = new THREE.DirectionalLight(0xfff0d7, 3.2);
sun.position.set(-18, 30, 12); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
scene.add(sun);

const state = { started: false, platform: 'pc', view: 'chase', scenario: 'station', quality: 'balanced', throttle: false, brake: false, damage: 0, speed: 0, hitCooldown: 0, direction: -1 };
const mat = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const world = new THREE.Group(); scene.add(world);
const train = new THREE.Group(); world.add(train);
const effects = [];
let obstacles = [];

function box(parent, size, material, pos, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...pos); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

// Track runs along the Z axis. This is a game-scale visual model, not an engineering simulation.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(230, 230), mat(0x637b58));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.16; ground.receiveShadow = true; world.add(ground);
const trackGroup = new THREE.Group(); world.add(trackGroup);
function addTrack(x, length = 200, z = 0) {
  const ballast = box(trackGroup, [4.1, .12, length], mat(0x55585a), [x, -.035, z], false);
  const railMat = mat(0x9da6a8, .28, .8);
  for (const offset of [-1.05, 1.05]) box(trackGroup, [.16, .22, length], railMat, [x + offset, .12, z], false);
  const sleeperMat = mat(0x493c32);
  const count = Math.floor(length / 2.2);
  for (let i = 0; i <= count; i++) box(trackGroup, [2.65, .12, .28], sleeperMat, [x, .015, z - length / 2 + i * 2.2], false);
  return ballast;
}
addTrack(0);

// Train body: stylized, non-destructive game model.
const bodyMat = mat(0xd6dce0, .38, .32);
const accentMat = mat(0x254967, .42, .25);
const glassMat = new THREE.MeshStandardMaterial({ color: 0x8bc4e7, roughness: .18, metalness: .25, emissive: 0x102838 });
box(train, [2.7, 2.25, 8.5], bodyMat, [0, 1.55, 0]);
box(train, [2.72, .38, 8.52], accentMat, [0, .62, 0]);
box(train, [2.55, .36, 1.2], bodyMat, [0, 2.82, -3.55]);
for (const z of [-2.7, -1.3, .1, 1.5, 2.9]) {
  for (const side of [-1, 1]) box(train, [.035, .72, .9], glassMat, [side * 1.365, 1.85, z], false);
}
for (const z of [-2.8, 2.8]) {
  const bogie = box(train, [2.25, .48, 1.4], mat(0x30383d), [0, .38, z]);
  const wheelMat = mat(0x202426, .55, .35);
  for (const x of [-1.15, 1.15]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .22, 20), wheelMat);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, .42, z); wheel.castShadow = true; train.add(wheel);
  }
}
// Simple roof details
box(train, [1.6, .18, 2.1], mat(0x68747a, .55, .3), [0, 2.75, .2]);

function addStationProps() {
  const platformMat = mat(0x9b9b91), edgeMat = mat(0xe4c96c), wallMat = mat(0xc5c2b5);
  for (const side of [-1, 1]) {
    box(world, [5.5, .42, 78], platformMat, [side * 5.4, .05, -22], false);
    box(world, [5.5, .14, 78], edgeMat, [side * 3.15, .31, -22], false);
    for (const z of [-4, -18, -32, -46]) {
      box(world, [.25, 3.7, .3], wallMat, [side * 7.2, 1.9, z], false);
      box(world, [5.5, .18, .35], mat(0x46525b), [side * 7.2, 3.8, z], false);
    }
  }
  box(world, [2.7, 3.2, 8], mat(0xc1bba8), [-10, 1.55, -29], false);
  box(world, [2.9, .18, 8.2], mat(0x59666e), [-10, 3.25, -29], false);
}
function addSidingProps() {
  addTrack(5.3, 170);
  addTrack(-5.3, 170);
  const shedMat = mat(0x8c8170);
  box(world, [8, 3.8, 12], shedMat, [10, 1.9, -23], false);
  box(world, [8.4, .35, 12.4], mat(0x4a5358), [10, 4, -23], false);
  for (const z of [-8, -20, -32, -44]) box(world, [1.2, 1.1, 2], mat(0x7d786f), [-6, .45, z], false);
}
function addReverseProps() {
  for (const x of [-8, 8]) {
    box(world, [2, 1.4, 95], mat(0x526557), [x, .6, -22], false);
    for (const z of [-6, -20, -34, -48]) box(world, [1.1, 4.2, .5], mat(0x6a7777), [x, 2.2, z], false);
  }
}

const obstacleMat = mat(0x7a6250);
function clearScenario() {
  for (let i = world.children.length - 1; i >= 0; i--) {
    const child = world.children[i];
    if (child !== ground && child !== trackGroup && child !== train) world.remove(child);
  }
  obstacles = [];
}
function addObstacle(x, z, size = [3.2, 1.7, 2.6]) {
  const obj = box(world, size, obstacleMat, [x, size[1] / 2, z]);
  obstacles.push({ mesh: obj, x, z, sx: size[0], sz: size[2], hit: false });
}
function buildScenario(name) {
  clearScenario(); state.scenario = name; state.damage = 0; state.speed = 0; state.hitCooldown = 0;
  train.position.set(0, 0, 0); train.rotation.set(0, 0, 0);
  state.direction = name === 'reverse' ? 1 : -1;
  if (name === 'station') {
    addStationProps(); addObstacle(0, -31, [3.8, 1.6, 3]); addObstacle(0, 24, [3.5, 1.4, 3]);
  } else if (name === 'siding') {
    addSidingProps(); addObstacle(0, -27, [3.5, 1.5, 3]); addObstacle(5.3, -42, [3.5, 1.5, 3]);
  } else {
    addReverseProps(); addObstacle(0, 31, [3.8, 1.6, 3]); addObstacle(0, -39, [3.5, 1.5, 3]);
  }
  document.querySelector('#scenarioLabel').textContent = name === 'station' ? '駅構内' : name === 'siding' ? '留置線' : '逆走コース';
  updateHud();
}

function addDamageMark(severity) {
  // Persistent superficial marks and a shaded, shallow dent impression on the train shell.
  const side = Math.random() < .5 ? -1 : 1;
  const z = THREE.MathUtils.randFloat(-3.2, 3.2);
  const scratch = new THREE.Mesh(new THREE.BoxGeometry(.035, .07 + severity * .12, .7 + severity * .9), mat(0x596168, .95));
  scratch.position.set(side * 1.37, THREE.MathUtils.randFloat(1.05, 2.2), z);
  scratch.rotation.x = THREE.MathUtils.randFloat(-.18, .18); train.add(scratch);
  if (severity > .28) {
    const dentMat = new THREE.MeshStandardMaterial({ color: 0x707a80, roughness: .8, metalness: .2 });
    const dent = new THREE.Mesh(new THREE.SphereGeometry(.38 + severity * .28, 16, 10), dentMat);
    dent.scale.set(.12, .62, 1.1); dent.position.set(side * 1.37, 1.55, z); train.add(dent);
  }
  // Keep the prototype lightweight after repeated impacts.
  const marks = train.children.filter(o => o.userData.damageMark);
  scratch.userData.damageMark = true;
  if (marks.length > 50) train.remove(marks[0]);
}
function particleBurst(position, color, count, life, scale = .2) {
  const group = new THREE.Group(); group.position.copy(position); scene.add(group);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95 });
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(scale * (.55 + Math.random()), 7, 6), material);
    mesh.position.set((Math.random() - .5) * 1.4, Math.random() * 1.4, (Math.random() - .5) * 1.4);
    mesh.userData.velocity = new THREE.Vector3((Math.random() - .5) * 3, 1 + Math.random() * 3, (Math.random() - .5) * 3);
    group.add(mesh);
  }
  effects.push({ group, life, initial: life, kind: color === 0xff5a18 ? 'fire' : 'burst' });
}
function impact(obstacle) {
  const severity = Math.min(1, Math.abs(state.speed) / 13);
  if (severity < .04) return;
  state.damage = Math.min(100, state.damage + 10 + severity * 35);
  addDamageMark(severity);
  const p = train.position.clone().add(new THREE.Vector3(0, 1.3, state.direction * 3.8));
  particleBurst(p, 0xffbf55, 16, .75, .13);
  state.speed *= -.28;
  train.position.z += state.direction * 1.2;
  obstacle.hit = true; state.hitCooldown = .8;
  if (state.damage >= 48) particleBurst(train.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xff5a18, 20, 1.6, .25);
  if (state.damage >= 82) {
    particleBurst(train.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xffa52f, 35, 1.1, .42);
    showMessage('演出：大きな衝撃');
  } else showMessage('衝突 — 車体に損傷');
  updateHud();
}
function showMessage(text) {
  const el = document.querySelector('#message'); el.textContent = text; el.classList.remove('hidden');
  clearTimeout(showMessage.timer); showMessage.timer = setTimeout(() => el.classList.add('hidden'), 1500);
}
function updateHud() {
  document.querySelector('#damageLabel').textContent = `${Math.round(state.damage)}%`;
  document.querySelector('#damageBar').style.width = `${state.damage}%`;
  document.querySelector('#speedLabel').textContent = `${Math.round(Math.abs(state.speed) * 4)} km/h`;
}

function applyQuality(value) {
  state.quality = value;
  const mobile = state.platform === 'mobile' || innerWidth < 700;
  const ratio = value === 'performance' ? 1 : value === 'high' ? Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2) : Math.min(devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(ratio); renderer.shadowMap.enabled = value !== 'performance';
  sun.shadow.mapSize.set(value === 'high' ? 2048 : 1024, value === 'high' ? 2048 : 1024);
  renderer.setSize(innerWidth, innerHeight);
}

function update(dt) {
  if (!state.started) return;
  const accel = 5.5, brake = 10;
  if (state.throttle) state.speed += accel * dt * state.direction;
  else if (state.brake) state.speed = THREE.MathUtils.damp(state.speed, 0, brake, dt);
  else state.speed = THREE.MathUtils.damp(state.speed, 0, .45, dt);
  state.speed = THREE.MathUtils.clamp(state.speed, -12, 12);
  train.position.z += state.speed * dt;
  state.hitCooldown = Math.max(0, state.hitCooldown - dt);
  for (const o of obstacles) {
    const overlap = Math.abs(train.position.x - o.x) < (1.35 + o.sx / 2) && Math.abs(train.position.z - o.z) < (4.25 + o.sz / 2);
    if (overlap && !o.hit && state.hitCooldown <= 0) impact(o);
    if (!overlap) o.hit = false;
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]; e.life -= dt;
    for (const particle of e.group.children) {
      particle.position.addScaledVector(particle.userData.velocity, dt);
      particle.userData.velocity.y -= 4 * dt;
      particle.scale.multiplyScalar(1 - Math.min(.9, dt * .7));
    }
    e.group.children[0]?.material && (e.group.children[0].material.opacity = Math.max(0, e.life / e.initial));
    if (e.life <= 0) { scene.remove(e.group); e.group.traverse(o => { o.geometry?.dispose(); }); effects.splice(i, 1); }
  }
  updateHud();
}
function updateCamera(dt) {
  if (state.view === 'top') {
    const desired = new THREE.Vector3(train.position.x, 40, train.position.z + 1);
    camera.position.lerp(desired, 1 - Math.exp(-3 * dt)); camera.up.set(0, 0, -1); camera.lookAt(train.position.x, 0, train.position.z);
    camera.fov = 48; camera.updateProjectionMatrix();
  } else {
    camera.up.set(0, 1, 0);
    const behind = -state.direction;
    const desired = new THREE.Vector3(train.position.x + 8, 7, train.position.z + behind * 15);
    camera.position.lerp(desired, 1 - Math.exp(-2.2 * dt)); camera.lookAt(train.position.x, 1.1, train.position.z - state.direction * 3);
    camera.fov = 54; camera.updateProjectionMatrix();
  }
}

const keys = new Set();
window.addEventListener('keydown', e => { const key = e.key.toLowerCase(); keys.add(key); if ([' ', 'arrowup', 'arrowdown'].includes(key)) e.preventDefault(); });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function refreshKeyboard() {
  if (state.platform !== 'pc') return;
  state.throttle = keys.has('w') || keys.has('arrowup');
  state.brake = keys.has(' ') || keys.has('space');
  if (keys.has('s') || keys.has('arrowdown')) { state.throttle = true; state.direction = 1; }
  else if (state.scenario !== 'reverse') state.direction = -1;
}
for (const button of document.querySelectorAll('[data-control]')) {
  const control = button.dataset.control;
  const down = e => { e.preventDefault(); if (control === 'throttle') state.throttle = true; else if (control === 'brake') state.brake = true; else { state.direction = -state.direction; state.throttle = true; } };
  const up = e => { e.preventDefault(); if (control === 'throttle' || control === 'reverse') state.throttle = false; if (control === 'brake') state.brake = false; };
  button.addEventListener('pointerdown', down); ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => button.addEventListener(type, up));
}

const menu = document.querySelector('#menu');
document.querySelector('#startButton').addEventListener('click', () => {
  state.platform = document.querySelector('#platformSelect').value;
  state.view = document.querySelector('#viewSelect').value;
  buildScenario(document.querySelector('#scenarioSelect').value);
  applyQuality(document.querySelector('#qualitySelect').value);
  state.started = true; menu.classList.add('hidden'); document.querySelector('#hud').classList.remove('hidden');
  document.querySelector('#mobileControls').classList.toggle('hidden', state.platform !== 'mobile');
});
document.querySelector('#viewButton').addEventListener('click', () => { state.view = state.view === 'top' ? 'chase' : 'top'; });
document.querySelector('#menuButton').addEventListener('click', () => { state.started = false; menu.classList.remove('hidden'); document.querySelector('#hud').classList.add('hidden'); document.querySelector('#mobileControls').classList.add('hidden'); });

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(.04, (now - last) / 1000); last = now;
  refreshKeyboard(); update(dt); updateCamera(dt); renderer.render(scene, camera);
}
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyQuality(state.quality); });
applyQuality(state.quality);
buildScenario('station');
requestAnimationFrame(animate);

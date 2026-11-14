import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { QUESTIONS } from './questions.js';

// Assets are imported, not fetched, so the game can build into one
// self-contained HTML file that runs offline straight from file://
import gravelUrl from './assets/scene/gravel.jpg';
import backdropUrl from './assets/scene/court-backdrop.jpg';
const FACES = Object.fromEntries(
  Object.entries(
    import.meta.glob('./assets/faces/*.png', { eager: true, query: '?url', import: 'default' })
  ).map(([path, url]) => [path.split('/').pop().replace('.png', ''), url])
);

// ---------- Constants ----------
const COURT = { width: 5, length: 22, wallH: 0.22 }; // meters; z: -11 .. +11
const THROW_Z = -9.5;
const FAR_THROW_Z = 9.0; // Eden's twin throws from here
const BOULE_R = 0.068;
const JACK_R = 0.042;
const WIN_SCORE = 13;

// ---------- Rosters ----------
const ROSTERS = [
  {
    defaultName: 'Team Ofer',
    players: [
      { key: 'ofer', name: 'Ofer 👑', shirt: 0x3a5ba0 },
      { key: 'mom', name: 'Mom', shirt: 0x9a4a8a },
      { key: 'yariv', name: 'Yariv', shirt: 0x2e6b34 },
      { key: 'eden', name: 'Eden', shirt: 0xc2762a },
    ],
  },
  {
    defaultName: 'Team Shani',
    players: [
      { key: 'shani', name: 'Shani', shirt: 0xa33327 },
      { key: 'gali', name: 'Gali', shirt: 0x2a7a8a },
      { key: 'ori', name: 'Ori', shirt: 0x6a5acd },
      { key: 'happy', name: 'Happy 🐕', dog: true },
    ],
  },
];

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas = $('scene');

// ---------- Three.js scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc4e0);
scene.fog = new THREE.Fog(0x9fc4e0, 30, 80);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
const CAMS = {
  near: { pos: new THREE.Vector3(0, 3.8, THROW_Z - 4.2), look: new THREE.Vector3(0, 0, 2) },
  far: { pos: new THREE.Vector3(0, 3.3, 12.4), look: new THREE.Vector3(0, 0.6, -3) },
};
let camMode = 'near';
const camLook = CAMS.near.look.clone();
camera.position.copy(CAMS.near.pos);
camera.lookAt(camLook);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const small = Math.min(w, h) < 620;
  // lighter on phones
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.6 : 2));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // keep roughly the same width of court in view on a tall phone screen
  const base = 55;
  camera.fov = camera.aspect < 1
    ? THREE.MathUtils.clamp(2 * THREE.MathUtils.radToDeg(
        Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) / camera.aspect)), base, 86)
    : base;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Lights
scene.add(new THREE.HemisphereLight(0xbfd8f0, 0x8a6f4d, 0.7));
const sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
sun.position.set(-12, 16, -6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
scene.add(sun);

function gravelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c2a878';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const v = 150 + Math.random() * 80 | 0;
    g.fillStyle = `rgb(${v},${v - 25},${v - 60})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 16);
  return tex;
}

// Real gravel from the family's own court photo, brightened (the photo is at night).
// Falls back to the procedural texture if the file is missing.
function brightenedTexture(url, { brightness = 1, repeat = null, fade = false, flatten = false, onLoad = null } = {}) {
  const c = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.filter = `brightness(${brightness})${flatten ? ' contrast(0.8) saturate(0.9)' : ''}`;
    g.drawImage(img, 0, 0);
    g.filter = 'none';
    if (fade) {
      // feather the edges so the photo blends into sky and grass instead of
      // showing a hard rectangle
      g.globalCompositeOperation = 'destination-out';
      const side = c.width * 0.18;
      const lr = g.createLinearGradient(0, 0, c.width, 0);
      lr.addColorStop(0, 'rgba(0,0,0,1)');
      lr.addColorStop(side / c.width, 'rgba(0,0,0,0)');
      lr.addColorStop(1 - side / c.width, 'rgba(0,0,0,0)');
      lr.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = lr;
      g.fillRect(0, 0, c.width, c.height);
      const tb = g.createLinearGradient(0, 0, 0, c.height);
      tb.addColorStop(0, 'rgba(0,0,0,0.95)');
      tb.addColorStop(0.22, 'rgba(0,0,0,0)');
      tb.addColorStop(0.9, 'rgba(0,0,0,0)');
      tb.addColorStop(1, 'rgba(0,0,0,0.9)');
      g.fillStyle = tb;
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';
    }
    if (repeat) {
      tex.wrapS = THREE.MirroredRepeatWrapping;
      tex.wrapT = THREE.MirroredRepeatWrapping;
      tex.repeat.set(repeat[0], repeat[1]);
    }
    tex.needsUpdate = true;
    onLoad?.(tex, img);
  };
  img.src = url;
  return tex;
}

const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(COURT.width, COURT.length),
  new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 1 })
);
brightenedTexture(gravelUrl, {
  brightness: 1.3,
  flatten: true,
  repeat: [5, 22],
  onLoad: (tex) => {
    groundMesh.material.map = tex;
    groundMesh.material.needsUpdate = true;
  },
});
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const grass = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({ color: 0x6d8f4e, roughness: 1 })
);
grass.rotation.x = -Math.PI / 2;
grass.position.y = -0.02;
grass.receiveShadow = true;
scene.add(grass);

const plankMat = new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.9 });
function plank(w, d, x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, COURT.wallH, d), plankMat);
  m.position.set(x, COURT.wallH / 2, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
plank(0.08, COURT.length + 0.16, COURT.width / 2 + 0.04, 0);
plank(0.08, COURT.length + 0.16, -COURT.width / 2 - 0.04, 0);
plank(COURT.width, 0.08, 0, COURT.length / 2 + 0.04);
plank(COURT.width, 0.08, 0, -COURT.length / 2 - 0.04);

const circle = new THREE.Mesh(
  new THREE.RingGeometry(0.42, 0.5, 40),
  new THREE.MeshBasicMaterial({ color: 0xdd3322, side: THREE.DoubleSide })
);
circle.rotation.x = -Math.PI / 2;
circle.position.set(0, 0.012, THROW_Z);
scene.add(circle);

// The real clubhouse from the photo, standing at the far end of the court
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
);
backdrop.position.set(0, 0, COURT.length / 2 + 7);
backdrop.rotation.y = Math.PI;
scene.add(backdrop);
brightenedTexture(backdropUrl, {
  brightness: 1.75,
  fade: true,
  onLoad: (tex, img) => {
    const w = 42;
    const h = (w * img.naturalHeight) / img.naturalWidth;
    backdrop.geometry.dispose();
    backdrop.geometry = new THREE.PlaneGeometry(w, h);
    backdrop.position.y = h / 2 - 1.8; // sink the gravel edge below the grass
    backdrop.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  },
});

function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 2.4 * s, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f })
  );
  trunk.position.y = 1.2 * s;
  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(1.5 * s, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 1 })
  );
  leaves.position.y = 3 * s;
  leaves.scale.y = 0.8;
  trunk.castShadow = leaves.castShadow = true;
  g.add(trunk, leaves);
  g.position.set(x, 0, z);
  scene.add(g);
}
tree(-7, 4, 1.3); tree(7.5, -2, 1.1); tree(-8, -7, 1); tree(8, 8, 1.4); tree(-6.5, 12, 1.2);

function banner() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#a33327';
  g.fillRect(0, 0, 1024, 200);
  g.fillStyle = '#f7f0e3';
  g.font = 'bold 64px Georgia';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('★ Joyeux 60e Anniversaire Ofer ★', 512, 100);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide })
  );
  m.position.set(0, 2.8, COURT.length / 2 + 2);
  m.rotation.y = Math.PI;
  scene.add(m);
  for (const x of [-4.1, 4.1]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    pole.position.set(x, 1.85, COURT.length / 2 + 2);
    scene.add(pole);
  }
}
banner();

// ---------- Characters ----------
const SKIN = 0xe8b88a;
const characters = []; // { key, group, home: V3, target: V3, dog, parts }

function nameLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 36px Georgia';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(20,15,8,0.6)';
  const w = g.measureText(text).width + 24;
  g.beginPath(); g.roundRect(128 - w / 2, 8, w, 48, 10); g.fill();
  g.fillStyle = '#f7f0e3';
  g.fillText(text, 128, 34);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  sprite.scale.set(1.3, 0.33, 1);
  return sprite;
}

function smileyFace() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.beginPath(); g.arc(22, 26, 4, 0, 7); g.fill();
  g.beginPath(); g.arc(42, 26, 4, 0, 7); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = 3;
  g.beginPath(); g.arc(32, 36, 12, 0.3, Math.PI - 0.3); g.stroke();
  return new THREE.CanvasTexture(c);
}
const faceTex = smileyFace();

// Later: drop photos into public/faces/<key>.png and they appear on the heads.
// Round photo face on a canvas — used for heads and for Gali's disguise masks
function circularFaceTexture(key, { dot = false, ring = '#f7f0e3' } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      g.save();
      g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.clip();
      g.drawImage(img, 0, 0, 256, 256);
      if (dot) {
        g.beginPath(); g.arc(176, 158, 9, 0, Math.PI * 2);
        g.fillStyle = '#4a2a1e'; g.fill();
      }
      g.restore();
      g.lineWidth = 8; g.strokeStyle = ring;
      g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.stroke();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    };
    img.onerror = reject;
    img.src = FACES[key];
  });
}

async function tryPhotoFace(mesh, key, head, opts = {}) {
  const file = opts.photoKey || key;
  try {
    if (!FACES[file]) return;
    const img = new Image();
    img.onload = () => {
      // circular crop so it reads as a head
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.clip();
      g.drawImage(img, 0, 0, 256, 256);
      if (opts.dot) {
        // Amit = Eden with a beauty spot, so you can tell the twins apart
        g.beginPath();
        g.arc(176, 158, 9, 0, Math.PI * 2);
        g.fillStyle = '#4a2a1e';
        g.fill();
      }
      g.lineWidth = 6; g.strokeStyle = '#f7f0e3';
      g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.stroke();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      // billboard: always faces the camera, replaces the sphere head + smiley
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sprite.name = 'faceSprite';
      sprite.scale.set(0.42, 0.42, 1);
      sprite.position.copy(head.position);
      head.visible = false;
      mesh.visible = false;
      head.parent.add(sprite);
    };
    img.src = FACES[file];
  } catch { /* no photo yet */ }
}

function makePerson({ key, name, shirt, photoKey, dot }) {
  const g = new THREE.Group();
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.55, 10), mat(0x3a3a4a));
  legs.position.y = 0.28;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.55, 12), mat(shirt));
  torso.position.y = 0.85;
  const armGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.45, 8);
  const armL = new THREE.Mesh(armGeo, mat(shirt));
  armL.position.set(-0.22, 0.88, 0); armL.rotation.z = 0.25;
  const armR = new THREE.Mesh(armGeo, mat(shirt));
  armR.position.set(0.22, 0.88, 0); armR.rotation.z = -0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat(SKIN));
  head.position.y = 1.3;
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 16),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true })
  );
  face.position.set(0, 1.31, 0.145);
  tryPhotoFace(face, key, head, { photoKey, dot });
  const label = nameLabel(name);
  label.position.y = 1.75;

  for (const p of [legs, torso, armL, armR, head]) p.castShadow = true;
  g.add(legs, torso, armL, armR, head, face, label);
  return { group: g, parts: { armR, head } };
}

function makeDog({ key, name }) {
  const g = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const fur = 0xc89b5a;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.24), mat(fur));
  body.position.y = 0.32;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), mat(fur));
  head.position.set(0.3, 0.46, 0);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), mat(0xa87c42));
  snout.position.set(0.42, 0.42, 0);
  const earGeo = new THREE.ConeGeometry(0.05, 0.12, 6);
  const earL = new THREE.Mesh(earGeo, mat(0xa87c42));
  earL.position.set(0.26, 0.6, -0.07);
  const earR = new THREE.Mesh(earGeo, mat(0xa87c42));
  earR.position.set(0.26, 0.6, 0.07);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.26, 6), mat(fur));
  tail.position.set(-0.3, 0.45, 0);
  tail.rotation.z = 0.8;
  const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6);
  const legs = [[0.18, -0.08], [0.18, 0.08], [-0.18, -0.08], [-0.18, 0.08]].map(([x, z]) => {
    const l = new THREE.Mesh(legGeo, mat(fur));
    l.position.set(x, 0.11, z);
    return l;
  });
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 16),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true })
  );
  face.position.set(0.37, 0.5, 0);
  face.rotation.y = Math.PI / 2;
  tryPhotoFace(face, key, head);
  const label = nameLabel(name);
  label.position.y = 1.0;
  for (const p of [body, head, snout, tail, ...legs]) p.castShadow = true;
  g.add(body, head, snout, earL, earR, tail, face, label, ...legs);
  return { group: g, parts: { tail, head } };
}

function spawnCharacter(def, teamIdx, slot) {
  const made = def.dog ? makeDog(def) : makePerson(def);
  const x = teamIdx === 0 ? -3.7 : 3.7;
  const z = -8.2 + slot * 1.7;
  made.group.position.set(x, 0, z);
  made.group.rotation.y = teamIdx === 0 ? Math.PI / 2 : -Math.PI / 2; // face the court
  scene.add(made.group);
  const ch = {
    key: def.key, dog: !!def.dog, teamIdx,
    group: made.group, parts: made.parts,
    home: made.group.position.clone(),
    target: made.group.position.clone(),
    homeRotY: made.group.rotation.y,
    anim: null, animUntil: 0,
  };
  characters.push(ch);
  return ch;
}

ROSTERS.forEach((team, ti) => team.players.forEach((p, si) => spawnCharacter(p, ti, si)));
const charOf = (key) => characters.find((c) => c.key === key);

// Amit — Eden's twin, appears on demand at the far end
let amit = null;
function summonAmit() {
  if (amit) return;
  const made = makePerson({ key: 'amit', name: 'Amit 👯', shirt: 0xc2762a, photoKey: 'eden', dot: true });
  made.group.position.set(-1.9, 0, FAR_THROW_Z - 0.6);
  made.group.rotation.y = Math.PI; // face back down the court
  scene.add(made.group);
  amit = made.group;
}
function dismissAmit() {
  if (!amit) return;
  scene.remove(amit);
  amit = null;
}

// ---------- Aim reticle + guide ----------
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.12, 0.18, 32),
  new THREE.MeshBasicMaterial({ color: 0xffee66, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
);
reticle.rotation.x = -Math.PI / 2;
reticle.position.y = 0.015;
reticle.visible = false;
scene.add(reticle);

const guideGeom = new THREE.BufferGeometry();
const guideLine = new THREE.Line(
  guideGeom,
  new THREE.LineDashedMaterial({ color: 0xffee66, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.85 })
);
guideLine.visible = false;
scene.add(guideLine);

// Short launch-angle trail at the hand: tapering dots with a shadow on the
// gravel underneath, so the gap between trail and shadow reads as the angle.
const AIM_DOTS = 13;
const aimTrail = new THREE.Group();
const aimDots = [];
for (let i = 0; i < AIM_DOTS; i++) {
  const t = i / (AIM_DOTS - 1);
  const d = new THREE.Mesh(
    new THREE.SphereGeometry(0.052 * (1 - t * 0.68), 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.95 - t * 0.35 })
  );
  aimDots.push(d);
  aimTrail.add(d);
}
const aimTip = new THREE.Mesh(
  new THREE.ConeGeometry(0.07, 0.19, 10),
  new THREE.MeshBasicMaterial({ color: 0xffaa22 })
);
aimTrail.add(aimTip);
const aimShadowGeom = new THREE.BufferGeometry();
const aimShadow = new THREE.Line(
  aimShadowGeom,
  new THREE.LineBasicMaterial({ color: 0x3a2d18, transparent: true, opacity: 0.55 })
);
aimTrail.add(aimShadow);
aimTrail.visible = false;
scene.add(aimTrail);

// ---------- Physics ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true; // settled balls cost nothing; a hit wakes them

const matGround = new CANNON.Material('ground');
const matBoule = new CANNON.Material('boule');
world.addContactMaterial(new CANNON.ContactMaterial(matGround, matBoule, { friction: 0.45, restitution: 0.32 }));
world.addContactMaterial(new CANNON.ContactMaterial(matBoule, matBoule, { friction: 0.2, restitution: 0.8 }));

const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, material: matGround, shape: new CANNON.Plane() });
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

function wall(w, d, x, z) {
  const b = new CANNON.Body({ type: CANNON.Body.STATIC, material: matGround });
  b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, 0.4, d / 2)));
  b.position.set(x, 0.4, z);
  world.addBody(b);
}
wall(0.08, COURT.length + 0.2, COURT.width / 2 + 0.04, 0);
wall(0.08, COURT.length + 0.2, -COURT.width / 2 - 0.04, 0);
wall(COURT.width + 0.2, 0.08, 0, COURT.length / 2 + 0.04);
wall(COURT.width + 0.2, 0.08, 0, -COURT.length / 2 - 0.04);

// ---------- Balls ----------
const balls = [];
let jackBall = null;

const bouleGeo = new THREE.SphereGeometry(BOULE_R, 24, 18);
const teamMats = [
  new THREE.MeshStandardMaterial({ color: 0xc8c8d0, metalness: 0.95, roughness: 0.25 }),
  new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.95, roughness: 0.3 }),
];

function spawnBall(team, pos, vel) {
  const r = team === -1 ? JACK_R : BOULE_R;
  const mass = team === -1 ? 0.1 : 0.72;
  const body = new CANNON.Body({ mass, material: matBoule, shape: new CANNON.Sphere(r) });
  body.position.copy(pos);
  body.velocity.copy(vel);
  body.linearDamping = 0.01;
  body.angularDamping = 0.1;
  body.allowSleep = true;
  body.sleepSpeedLimit = 0.12;
  body.sleepTimeLimit = 0.4;
  world.addBody(body);

  const mesh = team === -1
    ? new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color: 0xcc2211, roughness: 0.6 }))
    : new THREE.Mesh(bouleGeo, teamMats[team]);
  mesh.castShadow = true;
  scene.add(mesh);

  // a team-coloured ring on the gravel under each ball — much easier to spot
  // from the far end than the ball itself
  const ringCol = team === -1 ? 0xff2200 : (team === 0 ? 0xeaf0ff : 0xffb020);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.9, r * 2.7, 28),
    new THREE.MeshBasicMaterial({ color: ringCol, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

  const ball = { body, mesh, ring, team, r, trapped: false, inHole: false };
  balls.push(ball);
  if (team === -1) jackBall = ball;
  return ball;
}

function removeBall(ball) {
  world.removeBody(ball.body);
  scene.remove(ball.mesh);
  if (ball.ring) scene.remove(ball.ring);
  const i = balls.indexOf(ball);
  if (i >= 0) balls.splice(i, 1);
}

function clearBalls() {
  for (const b of [...balls]) removeBall(b);
  balls.length = 0;
  jackBall = null;
}

// ---------- Holes (Happy's perk) ----------
const holes = []; // { x, z, r, mesh }
const HOLE_R = 0.5;
function digHole(x, z) {
  const grp = new THREE.Group();
  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(HOLE_R, 24),
    new THREE.MeshStandardMaterial({ color: 0x3f3020, roughness: 1 })
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.y = 0.014;
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(HOLE_R, HOLE_R + 0.12, 24),
    new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.016;
  grp.add(crater, rim);
  grp.position.set(x, 0, z);
  scene.add(grp);
  holes.push({ x, z, r: HOLE_R, mesh: grp });
}
// ---------- Ori's magnet boule (perk) ----------
const magnetMat = new THREE.MeshStandardMaterial({
  color: 0x3a2a55, metalness: 0.9, roughness: 0.3,
  emissive: 0x6622aa, emissiveIntensity: 0.6,
});
let magnetPull = null; // { ball, until, ring }

function startMagnetPull(ball) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 1.9, 48),
    new THREE.MeshBasicMaterial({ color: 0xb050ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(ball.body.position.x, 0.02, ball.body.position.z);
  scene.add(ring);
  magnetPull = { ball, until: performance.now() / 1000 + 2.2, ring };
  playMagnet();
  setMessage('🧲 The magnet is pulling everything in!', 3000);
}

function updateMagnetPull(dt, now) {
  if (!magnetPull) return;
  const { ball, ring } = magnetPull;
  const c = ball.body.position;
  ring.position.set(c.x, 0.02, c.z);
  const k = 1 - (magnetPull.until - now) / 2.2; // 0 → 1 over the pull
  ring.scale.setScalar(0.4 + 0.6 * Math.sin(k * Math.PI * 4) ** 2);
  ring.material.opacity = 0.35 * (1 - k);

  for (const b of balls) {
    if (b === ball) continue;
    const dx = c.x - b.body.position.x, dz = c.z - b.body.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 5) continue;
    // stop short of the magnet: brake instead of pulling, so balls gather
    // near it without snapping onto it
    if (d < 0.55) {
      b.body.velocity.x *= 0.72;
      b.body.velocity.z *= 0.72;
      continue;
    }
    // closer balls get pulled harder
    const strength = Math.min(1.5, 0.34 / (d * d)) * (b.team === -1 ? 1.25 : 1);
    b.body.wakeUp();
    b.trapped = false;
    b.body.velocity.x += (dx / d) * strength * dt * 8;
    b.body.velocity.z += (dz / d) * strength * dt * 8;
  }
  if (now > magnetPull.until) {
    scene.remove(ring);
    magnetPull = null;
    game.phase = 'rolling'; // let everything settle, then carry on
  }
}

// ---------- Ofer's whip (perk) ----------
let whip = null; // { t, from, to, ball }

function startWhip(ball) {
  // whichever character is acting swings it — Gali too, when disguised
  const actor = charOf(game.currentPlayer?.key) || charOf('ofer');
  const from = new THREE.Vector3(
    actor ? actor.group.position.x : 0,
    1.25,
    actor ? actor.group.position.z : THROW_Z
  );
  const line = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x3b2412, roughness: 0.75 })
  );
  line.castShadow = true;
  scene.add(line);
  const geom = null;
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffdd55 })
  );
  spark.visible = false;
  scene.add(spark);

  whip = { t: 0, from, ball, line, spark, grabbed: false };
  game.phase = 'whipping';
  reticle.visible = false;
  reticle.material.color.set(0xffee66);
  setAnim(game.currentPlayer?.key || 'ofer', 'whip', 2.6);
  playWhip();
  bigShout('🪢 CRACK!', 1200);
  updateHUD();
}

function updateWhip(dt) {
  if (!whip) return;
  whip.t += dt;
  const { from, ball, line, spark } = whip;
  // rebuild the lash as a tapered 3D cord each frame
  const setLash = (pts) => {
    line.geometry.dispose();
    line.geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts), Math.max(2, pts.length * 2), 0.028, 6, false
    );
  };
  const target = new THREE.Vector3(ball.body.position.x, ball.body.position.y, ball.body.position.z);
  const lashOut = 0.55, hold = 0.4, pullBack = 1.05; // slow, readable crack

  if (whip.t < lashOut) {
    // whip lashes out in a curve toward the ball
    const k = whip.t / lashOut;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const s = (i / 12) * k;
      const p = from.clone().lerp(target, s);
      p.y += Math.sin(s * Math.PI) * 1.1 * (1 - k * 0.5); // arc of the lash
      pts.push(p);
    }
    setLash(pts);
  } else if (whip.t < lashOut + hold) {
    spark.visible = true;
    spark.position.copy(target);
    spark.scale.setScalar(1 + Math.sin(whip.t * 24) * 0.4);
    if (!whip.grabbed) {
      whip.grabbed = true;
      // yank the ball up and back toward Ofer
      ball.body.wakeUp();
      ball.trapped = false;
      ball.body.velocity.set((from.x - target.x) * 1.6, 7.5, (from.z - target.z) * 1.6);
      ball.body.angularVelocity.set(22, 14, 22);
    }
  } else if (whip.t < lashOut + hold + pullBack) {
    spark.visible = false;
    const k = (whip.t - lashOut - hold) / pullBack;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const s = (i / 12) * (1 - k);
      const p = from.clone().lerp(target, s);
      p.y += Math.sin(s * Math.PI) * 0.8;
      pts.push(p);
    }
    if (pts.length > 1) setLash(pts);
    ball.mesh.scale.setScalar(Math.max(0.05, 1 - k));
  } else {
    finishWhip();
  }
}

function finishWhip() {
  if (!whip) return;
  const { ball, line, spark } = whip;
  scene.remove(line);
  scene.remove(spark);
  // the whipped ball leaves the court and becomes Ofer's second boule
  removeBall(ball);
  whip = null;

  const ofer = game.teams[0].players.find((p) => p.key === 'ofer');
  if (ofer) ofer.extra = (ofer.extra || 0) + 1;
  game.phase = 'aim';
  setMessage('Ofer snatched a boule — he throws twice now!', 3500);
  updateHUD();
}

// ---------- Gali's disguise (perk) ----------
let maskAnim = null; // { sprite, t, onDone }

const DISGUISABLE = [
  { key: 'ofer', perkId: 'whip', label: 'Ofer 👑 — the whip 🪢' },
  { key: 'yariv', perkId: 'sniper', label: 'Yariv — the sniper 🎯' },
  { key: 'mom', perkId: 'cleaner', label: 'Mom — the robot cleaner 🤖' },
  { key: 'eden', perkId: 'twin', label: 'Eden — the twin 👯' },
  { key: 'ori', perkId: 'magnet', label: 'Ori — the magnet boule 🧲' },
  { key: 'happy', perkId: 'dig', label: 'Happy 🐕 — dig a hole 🐾' },
];

function showDisguiseChooser() {
  const box = $('disguise-options');
  box.innerHTML = '';
  for (const d of DISGUISABLE) {
    const b = document.createElement('button');
    b.innerHTML = `${d.label}`;
    b.onclick = () => { hide('disguise-screen'); startDisguise(d); };
    box.appendChild(b);
  }
  show('disguise-screen');
}

async function startDisguise(d) {
  const gali = charOf('gali');
  let tex;
  try {
    tex = await circularFaceTexture(d.key, { ring: '#2a9d8f' });
  } catch {
    setMessage('No photo for that player yet!', 2500);
    return;
  }

  // the mask drops in from above and snaps onto Gali's face
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(0.9, 0.9, 1);
  const land = gali.group.position.clone();
  land.y = 1.3;
  land.z += 0.1;
  sprite.position.copy(land).setY(3.4);
  scene.add(sprite);
  playDisguise();
  bigShout('🎭 DISGUISE!', 1600);

  maskAnim = {
    sprite, t: 0, land,
    onDone: () => {
      const face = gali.group.getObjectByName('faceSprite');
      if (face) {
        if (!gali.ownFace) gali.ownFace = face.material.map;
        face.material.map = tex;
        face.material.needsUpdate = true;
      }
      game.disguise = { as: d.key, perkId: d.perkId, label: d.label };
      // the disguise itself buys exactly one use of the copied perk
      game.teams[1].charges[d.perkId] = (game.teams[1].charges[d.perkId] || 0) + 1;
      setMessage(`Gali is wearing ${d.key === 'happy' ? "Happy's" : d.label.split(' ')[0] + "'s"} face — use their perk!`, 4200);
      game.phase = 'aim';
      updateHUD();
    },
  };
  game.phase = 'disguising';
  reticle.visible = false;
  updateHUD();
}

function updateMaskAnim(dt) {
  if (!maskAnim) return;
  maskAnim.t += dt;
  const { sprite, land } = maskAnim;
  const dur = 0.9;
  const k = Math.min(1, maskAnim.t / dur);
  const ease = 1 - Math.pow(1 - k, 3);
  sprite.position.y = 3.4 + (land.y - 3.4) * ease;
  sprite.position.x = land.x;
  sprite.position.z = land.z;
  sprite.material.rotation = (1 - ease) * Math.PI * 1.5;
  const s = 0.9 - 0.52 * ease + (k > 0.85 ? Math.sin((k - 0.85) * 20) * 0.04 : 0);
  sprite.scale.set(s, s, 1);
  if (maskAnim.t > dur + 0.25) {
    scene.remove(sprite);
    const done = maskAnim.onDone;
    maskAnim = null;
    done();
  }
}

let maskOff = null;

// Gali pulls the borrowed face off and is herself again
function removeMask() {
  if (!game.disguise) return;
  const gali = charOf('gali');
  const face = gali?.group.getObjectByName('faceSprite');
  const maskTex = face?.material.map;
  if (face && gali.ownFace) {
    face.material.map = gali.ownFace;
    face.material.needsUpdate = true;
  }
  if (maskTex && gali) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: maskTex, transparent: true }));
    sprite.scale.set(0.38, 0.38, 1);
    sprite.position.set(gali.group.position.x, 1.3, gali.group.position.z + 0.12);
    scene.add(sprite);
    maskOff = { sprite, t: 0, from: sprite.position.clone() };
  }
  game.disguise = null;
  setMessage('Gali tosses the mask away — back to herself!', 2800);
}

function updateMaskOff(dt) {
  if (!maskOff) return;
  maskOff.t += dt;
  const k = maskOff.t / 0.9;
  const s = maskOff.sprite;
  s.position.y = maskOff.from.y + k * 1.7;
  s.position.x = maskOff.from.x - k * 1.0;
  s.material.rotation += dt * 7;
  s.material.opacity = Math.max(0, 1 - k);
  s.scale.setScalar(0.38 * (1 + k * 0.6));
  if (k >= 1) { scene.remove(s); maskOff = null; }
}

function clearDisguise() {
  if (maskOff) { scene.remove(maskOff.sprite); maskOff = null; }
  if (maskAnim) { scene.remove(maskAnim.sprite); maskAnim = null; }
  const gali = charOf('gali');
  if (gali?.ownFace) {
    const face = gali.group.getObjectByName('faceSprite');
    if (face) { face.material.map = gali.ownFace; face.material.needsUpdate = true; }
  }
  game.disguise = null;
}

// nearest boule to a point on the court (never the jack)
function nearestBoule(point) {
  let ball = null, d = Infinity;
  for (const b of balls) {
    if (b.team === -1) continue;
    const dist = Math.hypot(b.body.position.x - point.x, b.body.position.z - point.z);
    if (dist < d) { d = dist; ball = b; }
  }
  return ball ? { ball, d } : null;
}

// ---------- Yariv's sniper (perk) ----------
let snipe = null; // { t, tracer, flash, ball }

function startSnipe(ball) {
  const actor = charOf(game.currentPlayer?.key) || charOf('yariv');
  const from = new THREE.Vector3(
    actor ? actor.group.position.x : 0,
    1.15,
    actor ? actor.group.position.z : THROW_Z
  );
  const to = new THREE.Vector3(ball.body.position.x, ball.body.position.y, ball.body.position.z);

  const tracer = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([from, to]), 2, 0.012, 6, false),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.95 })
  );
  scene.add(tracer);

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc33 })
  );
  flash.position.copy(from);
  scene.add(flash);

  // the hit kicks the ball away from the shooter and spinning into the air
  const dir = to.clone().sub(from).normalize();
  ball.body.wakeUp();
  ball.trapped = false;
  ball.body.velocity.set(dir.x * 7.5, 6.5, dir.z * 7.5);
  ball.body.angularVelocity.set(30, 20, 30);

  snipe = { t: 0, tracer, flash, ball };
  game.phase = 'sniping';
  reticle.visible = false;
  reticle.material.color.set(0xffee66);
  $('crosshair').classList.add('hidden');
  setAnim(game.currentPlayer?.key || 'yariv', 'snipe', 1.4);
  playSniper();
  bigShout('🎯 BANG!', 1200);
  updateHUD();
}

function updateSnipe(dt) {
  if (!snipe) return;
  snipe.t += dt;
  const k = Math.min(1, snipe.t / 0.28);
  snipe.tracer.material.opacity = 0.95 * (1 - k);
  snipe.flash.scale.setScalar(Math.max(0.01, 1 - snipe.t / 0.18));
  snipe.flash.visible = snipe.t < 0.18;
  if (snipe.t > 0.75) finishSnipe();
}

function finishSnipe() {
  if (!snipe) return;
  const { ball, tracer, flash } = snipe;
  scene.remove(tracer);
  scene.remove(flash);
  removeBall(ball);
  snipe = null;
  // Yariv still gets his throw
  game.phase = 'aim';
  setMessage('Boule eliminated — and Yariv still throws!', 3000);
  updateHUD();
}

// ---------- Mom's robot cleaner (perk) ----------
let cleaner = null;
const CLEANER_R = 0.45;

function startCleaner(x) {
  const h = 0.26;
  const body = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: matGround });
  body.addShape(new CANNON.Cylinder(CLEANER_R, CLEANER_R, h, 18));
  body.position.set(x, h / 2, THROW_Z - 0.8);
  body.velocity.set(0, 0, 3.4);
  world.addBody(body);

  const grp = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(CLEANER_R, CLEANER_R, h, 28),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.5, roughness: 0.45 })
  );
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(CLEANER_R * 0.93, CLEANER_R * 0.93, 0.03, 28),
    new THREE.MeshStandardMaterial({ color: 0x9aa0ad, metalness: 0.7, roughness: 0.3 })
  );
  lid.position.y = h / 2;
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x33ddff })
  );
  light.position.set(0, h / 2 + 0.03, CLEANER_R * 0.5);
  shell.castShadow = lid.castShadow = true;
  grp.add(shell, lid, light);
  scene.add(grp);

  cleaner = { body, mesh: grp };
  game.phase = 'cleaning';
  reticle.visible = false;
  reticle.material.color.set(0xffee66);
  playCleaner();
  bigShout('🤖 CLEANING!', 1400);
  setAnim('mom', 'jump', 2);
  updateHUD();
}

function finishCleaner() {
  if (!cleaner) return;
  world.removeBody(cleaner.body);
  scene.remove(cleaner.mesh);
  cleaner = null;
  // Mom still gets her throw
  game.phase = 'aim';
  setMessage('The court is swept — and Mom still throws!', 3000);
  updateHUD();
}

function clearHoles() {
  for (const h of holes) scene.remove(h.mesh);
  holes.length = 0;
}

// ---------- Audio (tsiktsuk + dig) ----------
let audioCtx = null;
function blip(freq, t0, dur = 0.07) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.12, audioCtx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t0 + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(audioCtx.currentTime + t0);
  o.stop(audioCtx.currentTime + t0 + dur + 0.02);
}
function playTsiktsuk() {
  audioCtx ??= new AudioContext();
  for (let i = 0; i < 6; i++) blip(i % 2 ? 2200 : 1800, i * 0.09);
}
function playCleaner() {
  audioCtx ??= new AudioContext();
  for (let i = 0; i < 10; i++) blip(170 + (i % 3) * 25, i * 0.1, 0.12);
}
function playMagnet() {
  audioCtx ??= new AudioContext();
  for (let i = 0; i < 8; i++) blip(420 + i * 110, i * 0.06, 0.13);
}
function playDisguise() {
  audioCtx ??= new AudioContext();
  for (let i = 0; i < 6; i++) blip(300 + i * 160, i * 0.08, 0.1);
  blip(1200, 0.55, 0.12);
}
function playSniper() {
  audioCtx ??= new AudioContext();
  blip(2400, 0, 0.03);
  blip(900, 0.03, 0.06);
  blip(220, 0.08, 0.16);
}
function playWhip() {
  audioCtx ??= new AudioContext();
  blip(1500, 0, 0.04);
  blip(2600, 0.04, 0.05);
  blip(700, 0.1, 0.09);
}
function playDig() {
  audioCtx ??= new AudioContext();
  for (let i = 0; i < 5; i++) blip(300 + Math.random() * 120, i * 0.12, 0.09);
}

// ---------- Game state ----------
const game = {
  phase: 'start', // start | aim-jack | aim | charging | digging | rolling | between
  teams: [
    { name: 'Team Ofer', score: 0, charges: {}, players: ROSTERS[0].players.map((p) => ({ ...p, thrown: false })) },
    { name: 'Team Shani', score: 0, charges: {}, players: ROSTERS[1].players.map((p) => ({ ...p, thrown: false })) },
  ],
  current: 0,
  currentPlayer: null,
  jackThrower: 0,
  throwingJack: false,
  jackTries: 0,
  power: 0,
  powerT: 0,
  aimPoint: new THREE.Vector3(0, 0, 0),
  usedQuestions: new Set(),
  loft: 0.52,
  tsiktsukArmed: false,
  magnetArmed: false,
  pendingMagnet: null,
  repeatThrower: null,
  forcePlayer: null,
  disguise: null,
  twinActive: false,
};

window.__game = game; // test hook
window.__questions = QUESTIONS;
window.__balls = balls;
window.__camFov = () => camera.fov;
window.__refresh = () => updateHUD();
window.__aimAt = (x, z) => { game.aimPoint.set(x, 0, z); reticle.position.set(x, 0.015, z); };

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// ---------- UI ----------
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function setMessage(text, ms = 2600) {
  $('message').textContent = text;
  clearTimeout(setMessage._t);
  if (ms) setMessage._t = setTimeout(() => { $('message').textContent = ''; }, ms);
}
function bigShout(text, ms = 1500) {
  const el = $('bigshout');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(bigShout._t);
  bigShout._t = setTimeout(() => el.classList.add('hidden'), ms);
}

function boulesLeft(team) {
  return team.players.filter((p) => !p.thrown).length
    + team.players.reduce((a, p) => a + (p.extra || 0), 0);
}

function updateHUD() {
  const [t1, t2] = game.teams;
  for (const [el, t] of [[$('score-team1'), t1], [$('score-team2'), t2]]) {
    el.querySelector('.name').textContent = t.name;
    el.querySelector('.pts').textContent = t.score;
    const nTok = Object.values(t.charges).reduce((a, b) => a + b, 0);
    el.querySelector('.tokens').textContent = nTok > 3 ? `🎁×${nTok}` : '🎁'.repeat(nTok);
  }
  $('score-team1').classList.toggle('active', game.current === 0);
  $('score-team2').classList.toggle('active', game.current === 1);
  const p = game.currentPlayer;
  $('turn-banner').textContent = !p ? '' : game.throwingJack
    ? `${p.name} — throw the jack (cochonnet)`
    : game.phase === 'digging'
      ? `${p.name} — click the court to dig!`
      : `${p.name}${game.disguise && p.key === 'gali' ? ` 🎭 as ${game.disguise.as}` : ''} to throw${p.extra > 0 ? ` — ${p.extra + 1} boules in hand!` : ''}` +
        `${game.twinActive ? ' (as Amit, from the far side!)' : ''}`;
  const listLeft = (t) => t.players
    .filter((pl) => !pl.thrown)
    .map((pl) => pl.name.split(' ')[0] + (pl.extra > 0 ? `×${pl.extra + 1}` : ''))
    .join(', ') || '—';
  $('boules-left').textContent = `${t1.name}: ${listLeft(t1)}   |   ${t2.name}: ${listLeft(t2)}`;
  updatePerkBar();
  updatePlayerPicker();
  updateArcPanel();
  updateCharacterTargets();
}

// ---------- Arc (loft) panel ----------
// Side-on profile of the throw, so the angle is unmistakable even though
// the 3D camera looks straight down the court
function drawArcGauge() {
  const c = $('arc-gauge');
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const x0 = 13, y0 = H - 13;

  g.strokeStyle = 'rgba(247,240,227,0.35)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(6, y0); g.lineTo(W - 6, y0); g.stroke();

  // the flight profile at this angle (same maths as the throw, scaled to fit)
  const v = 11, el = game.loft;
  const vx = v * Math.cos(el), vy = v * Math.sin(el);
  const flight = (2 * vy) / 9.82;
  const range = vx * flight;
  const peak = (vy * vy) / (2 * 9.82);
  const sx = (W - 24) / Math.max(range, 1);
  const sy = (H - 26) / Math.max(peak, 0.6);
  const s = Math.min(sx, sy);

  g.strokeStyle = '#ffdd44';
  g.lineWidth = 2.2;
  g.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * flight;
    const px = x0 + vx * t * s;
    const py = y0 - (vy * t - 4.91 * t * t) * s;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();

  // angle wedge at the hand
  g.strokeStyle = 'rgba(255,170,34,0.9)';
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(x0, y0, 17, -el, 0); g.stroke();

  g.fillStyle = '#c8c8d0';
  g.beginPath(); g.arc(x0, y0 - 3, 3.4, 0, Math.PI * 2); g.fill();
}

function updateArcPanel() {
  const panel = $('arc-panel');
  const aiming = ['aim', 'aim-jack', 'charging'].includes(game.phase);
  panel.classList.toggle('hidden', !aiming);
  if (!aiming) return;
  $('arc-label').textContent = `${loftName(game.loft)} ${Math.round(game.loft * 57.3)}°`;
  drawArcGauge();
}

// Choose who throws: defaults to next in line, but any unthrown teammate can take it
function updatePlayerPicker() {
  const el = $('player-picker');
  el.innerHTML = '';
  const canPick = game.phase === 'aim' && !game.twinActive && !game.tsiktsukArmed;
  if (!canPick) return;
  const team = game.teams[game.current];
  const options = team.players.filter((p) => !p.thrown);
  if (options.length < 2) return;
  const label = document.createElement('div');
  label.className = 'picker-label';
  label.textContent = 'Who throws?';
  el.appendChild(label);
  for (const p of options) {
    const b = document.createElement('button');
    b.textContent = (p.key === game.currentPlayer?.key ? '🎯 ' : '') + p.name;
    b.classList.toggle('current', p.key === game.currentPlayer?.key);
    b.onclick = (e) => {
      e.stopPropagation();
      if (p.key === game.currentPlayer?.key) return;
      game.currentPlayer = p;
      setMessage(`${p.name} steps up to throw!`, 2000);
      updateHUD();
    };
    el.appendChild(b);
  }
}

// Perk panel — always visible during play; each perk shows ready / locked state
const PERKS = [
  {
    id: 'tsiktsuk',
    team: 0,
    title: '📢 Yariv: tsiktsuk!',
    hint: "usable when GALI throws — wrecks her aim",
    usable: () => (game.phase === 'aim' || game.phase === 'charging')
      && game.currentPlayer?.key === 'gali' && !game.throwingJack && !game.tsiktsukArmed,
    activate: () => {
      game.tsiktsukArmed = true;
      playTsiktsuk();
      bigShout('TSIK-TSUK!!');
      setAnim('yariv', 'jump', 2.5);
      setAnim('gali', 'tremble', 2.5);
      setMessage("Yariv is making noises... Gali's hands are shaking!", 3000);
    },
  },
  {
    id: 'twin',
    team: 0,
    title: '👯 Eden: duplicate to Amit!',
    hint: "usable on EDEN's turn — throw from the far side",
    usable: () => game.phase === 'aim' && actingAs('eden') && !game.twinActive,
    activate: () => {
      game.twinActive = true;
      camMode = 'far';
      summonAmit();
      bigShout('TWINS!!', 1200);
      setMessage('Amit appears at the far end — throw from behind the jack!', 4000);
    },
  },
  {
    id: 'whip',
    team: 0,
    title: '🪢 Ofer: whip a boule away!',
    hint: "usable on OFER's turn — steal a ball off the court, then throw twice",
    usable: () => game.phase === 'aim' && actingAs('ofer')
      && balls.some((b) => b.team !== -1),
    activate: () => {
      game.phase = 'whip-aim';
      reticle.material.color.set(0xff8844);
      setMessage('Click the boule you want to whip off the court!', 4000);
    },
  },
  {
    id: 'disguise',
    team: 1,
    title: '🎭 Gali: disguise as someone!',
    hint: "usable on GALI's turn — wear their face and use their perk",
    usable: () => game.phase === 'aim' && game.currentPlayer?.key === 'gali' && !game.disguise,
    activate: () => showDisguiseChooser(),
  },
  {
    id: 'sniper',
    team: 0,
    title: '🎯 Yariv: snipe a boule!',
    hint: "usable on YARIV's turn — shoot a ball off the court, he still throws after",
    usable: () => game.phase === 'aim' && actingAs('yariv')
      && balls.some((b) => b.team !== -1),
    activate: () => {
      game.phase = 'sniper-aim';
      reticle.material.color.set(0xff3333);
      $('crosshair').classList.remove('hidden');
      setMessage('🎯 Take aim — click the boule to shoot!', 4000);
    },
  },
  {
    id: 'magnet',
    team: 1,
    title: '🧲 Ori: throw the magnet boule!',
    hint: "usable on ORI's turn — his boule drags every ball toward it",
    usable: () => game.phase === 'aim' && actingAs('ori') && !game.magnetArmed,
    activate: () => {
      game.magnetArmed = true;
      setMessage('🧲 Magnet boule loaded — throw it!', 3500);
      setAnim('ori', 'jump', 1.5);
    },
  },
  {
    id: 'cleaner',
    team: 0,
    title: '🤖 Mom: start the robot cleaner!',
    hint: "usable on MOM's turn — sweeps a column, she still throws after",
    usable: () => game.phase === 'aim' && actingAs('mom'),
    activate: () => {
      game.phase = 'cleaner-aim';
      reticle.material.color.set(0x33ddff);
      setMessage('Click a column — the cleaner will sweep everything in it!', 4000);
    },
  },
  {
    id: 'dig',
    team: 1,
    title: '🐾 Happy: dig a hole!',
    hint: "usable on HAPPY's turn — sucks in balls, she still throws after",
    usable: () => game.phase === 'aim' && actingAs('happy'),
    activate: () => {
      game.phase = 'digging';
      reticle.material.color.set(0x885522);
      setMessage('Click anywhere on the court — Happy will dig there!', 4000);
    },
  },
];
// Gali in disguise counts as the player whose mask she wears
function actingAs(key) {
  if (game.currentPlayer?.key === key) return true;
  return game.currentPlayer?.key === 'gali' && game.disguise?.as === key;
}
// a copied perk is paid for by Gali's own team
const perkTeam = (perk) =>
  game.disguise && perk.id === game.disguise.perkId ? game.teams[1] : game.teams[perk.team];
const chargesOf = (perk) => perkTeam(perk).charges[perk.id] || 0;

function updatePerkBar() {
  const bar = $('perk-bar');
  bar.innerHTML = '';
  if (game.phase === 'start') return;

  // By default only perks you can actually fire right now are shown, so the
  // screen stays clear (and fits a phone). The chip opens the full list.
  const ready = PERKS.filter((p) => chargesOf(p) > 0 && p.usable());
  const owned = PERKS.reduce((a, p) => a + chargesOf(p), 0);
  const list = game.perksOpen ? PERKS : ready;

  for (const perk of list) {
    const team = perkTeam(perk);
    const n = chargesOf(perk);
    const ready = n > 0 && perk.usable();
    const b = document.createElement('button');
    b.className = ready ? 'perk-ready' : 'perk-locked';
    b.disabled = !ready;
    b.innerHTML = ready
      ? `<span class="perk-title">${perk.title} — GO!</span>` +
        `<span class="perk-sub">${team.name} 🎁×${n} · ${perk.hint}</span>`
      : `<span class="perk-title">${perk.title}</span>` +
        `<span class="perk-sub">${n ? '🎁×' + n : 'no 🎁'} · ${perk.hint.split('—')[0].trim()}</span>`;
    if (ready) b.onclick = (e) => {
      e.stopPropagation();
      team.charges[perk.id]--;
      const borrowed = game.disguise && perk.id === game.disguise.perkId;
      perk.activate();
      // the borrowed perk is spent — Gali takes the mask off again
      if (borrowed) removeMask();
      game.perksOpen = false;
      updateHUD();
    };
    bar.appendChild(b);
  }

  const chip = document.createElement('button');
  chip.className = 'perk-toggle';
  bar.classList.toggle('open', !!game.perksOpen);
  chip.textContent = game.perksOpen
    ? '✕ close perks'
    : `🎁 perks${owned ? ` ×${owned}` : ''}${ready.length ? '' : ' — none ready'}`;
  chip.onclick = (e) => {
    e.stopPropagation();
    game.perksOpen = !game.perksOpen;
    updatePerkBar();
  };
  bar.appendChild(chip);
}

// Characters walk to the circle on their turn
function updateCharacterTargets() {
  const now = performance.now() / 1000;
  for (const c of characters) {
    if (c.anim === 'dig' && now < c.animUntil) continue; // let Happy finish digging
    const isCurrent = game.currentPlayer && c.key === game.currentPlayer.key;
    if (isCurrent && !game.twinActive) {
      c.target.set(c.teamIdx === 0 ? -0.85 : 0.85, 0, THROW_Z - 0.4);
    } else {
      c.target.copy(c.home);
    }
  }
}
function setAnim(key, anim, secs) {
  const c = charOf(key);
  if (!c) return;
  c.anim = anim;
  c.animUntil = performance.now() / 1000 + secs;
}

// ---------- Throw mechanics ----------
// Arc (loft) control — a flat throw rolls in like a pointer, a high one
// drops almost straight down and dies on landing, clearing boules in the way.
const LOFT_MIN = 0.18, LOFT_MAX = 1.15;
// how far the mouse sits from the thrower, mapped onto the arc
const AIM_NEAR = 1.6, AIM_FAR = 10.5;
const AIM_RADIUS = 2.4; // the reticle always sits this far out

function loftName(loft) {
  if (loft < 0.32) return '🎳 Roll';
  if (loft < 0.68) return '➿ Half lob';
  if (loft < 0.92) return '🏹 Lob';
  return '☂️ High lob';
}

// the hand is lower for a rolling throw, higher for a lob
function releaseHeight(loft) {
  return 0.95 + loft * 0.72;
}

function throwOrigin() {
  const y = releaseHeight(game.loft);
  return game.twinActive
    ? new CANNON.Vec3(0, y, FAR_THROW_Z)
    : new CANNON.Vec3(0, y, THROW_Z + 0.3);
}

function beginAim(jack) {
  game.throwingJack = jack;
  game.phase = jack ? 'aim-jack' : 'aim';
  if (!jack) {
    // a player holding an extra boule keeps the circle for their second throw
    game.currentPlayer = game.forcePlayer || nextPlayerOf(game.teams[game.current]);
    game.forcePlayer = null;
  }
  else game.currentPlayer = game.teams[game.current].players.find((p) => !p.thrown) || game.teams[game.current].players[0];
  reticle.visible = true;
  reticle.material.color.set(0xffee66);
  updateHUD();
}

function nextPlayerOf(team) {
  return team.players.find((p) => !p.thrown) || null;
}

function throwBall() {
  const origin = throwOrigin();
  let dx = game.aimPoint.x - origin.x, dz = game.aimPoint.z - origin.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;

  // wobble — huge if tsiktsuk'd
  let wob = 0.022, powJit = 0.06;
  const sabotaged = game.tsiktsukArmed && game.currentPlayer?.key === 'gali' && !game.throwingJack;
  if (sabotaged) { wob = 0.13; powJit = 0.45; playTsiktsuk(); bigShout('TSIK-TSUK!!'); }
  const ang = Math.atan2(dx, dz) + (Math.random() - 0.5) * 2 * wob;
  dx = Math.sin(ang); dz = Math.cos(ang);

  const speed = throwSpeed(game.power) * (1 + (Math.random() - 0.5) * powJit);
  const elev = game.loft;
  const vel = new CANNON.Vec3(dx * speed * Math.cos(elev), speed * Math.sin(elev), dz * speed * Math.cos(elev));
  const ball = spawnBall(game.throwingJack ? -1 : game.current, origin, vel);
  // the steeper the arc, the more backspin, so lobs check and stop dead
  // while flat throws keep rolling through
  const spin = 6 + elev * 34;
  ball.body.angularVelocity.set(-dz * spin, 0, dx * spin);
  ball.loft = elev;

  if (game.magnetArmed && !game.throwingJack) {
    ball.magnet = true;
    ball.mesh.material = magnetMat;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(BOULE_R * 1.7, BOULE_R * 0.18, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xb050ff })
    );
    halo.rotation.x = Math.PI / 2;
    ball.mesh.add(halo);
    ball.halo = halo;
    game.magnetArmed = false;
    game.pendingMagnet = ball;
    playMagnet();
    bigShout('🧲 MAGNET!', 1300);
  }

  if (sabotaged) game.tsiktsukArmed = false;
  if (!game.throwingJack && game.currentPlayer) {
    // a whipped-in extra ball lets the same player throw again, immediately
    if (game.currentPlayer.extra > 0) {
      game.currentPlayer.extra--;
      game.repeatThrower = game.currentPlayer;
    } else {
      game.currentPlayer.thrown = true;
    }
  }
  game.phase = 'rolling';
  reticle.visible = false;
  guideLine.visible = false;
  $('power-fill').style.width = '0%';
  updateHUD();
}

function throwSpeed(power) {
  return game.throwingJack ? 2.5 + power * 6 : 3 + power * 8.5;
}

// Short tracer out of the hand showing the launch angle — like a shooting
// game's aim line. Deliberately stubby: it reads the angle, not the landing.
const AIM_REF_SPEED = 7.5; // fixed, so the tracer shows angle and not power
const AIM_SPAN = 0.34;     // seconds of flight drawn

function updateGuide() {
  const show = ['aim', 'aim-jack', 'charging'].includes(game.phase);
  guideLine.visible = false; // the long dashed path is retired
  aimTrail.visible = show;
  if (!show) return;

  const o = throwOrigin();
  const origin = new THREE.Vector3(o.x, o.y, o.z);
  let dx = game.aimPoint.x - origin.x, dz = game.aimPoint.z - origin.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;

  const elev = game.loft;
  const v = new THREE.Vector3(
    dx * AIM_REF_SPEED * Math.cos(elev),
    AIM_REF_SPEED * Math.sin(elev),
    dz * AIM_REF_SPEED * Math.cos(elev)
  );
  const pts = [];
  const p = origin.clone(), vv = v.clone();
  const dt = AIM_SPAN / (AIM_DOTS - 1);
  for (let i = 0; i < AIM_DOTS; i++) {
    pts.push(p.clone());
    aimDots[i].position.copy(p);
    vv.y -= 9.82 * dt;
    p.addScaledVector(vv, dt);
  }

  // arrowhead on the end, pointing along the last bit of the curve
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  aimTip.position.copy(b).addScaledVector(b.clone().sub(a).normalize(), 0.1);
  aimTip.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize()
  );

  // shadow of the trail on the gravel
  aimShadowGeom.setFromPoints(pts.map((q) => new THREE.Vector3(q.x, 0.013, q.z)));
}

// ---------- Settling / turns ----------
let settleFrames = 0;
let rollTimeout = 0;
function checkSettled(dt) {
  rollTimeout += dt;
  let moving = false;
  for (const b of balls) {
    if (b.body.sleepState === CANNON.Body.SLEEPING || b.trapped) continue;
    if (b.body.velocity.lengthSquared() > 0.01 || b.body.position.y > b.r * 2.5) { moving = true; break; }
  }
  settleFrames = moving ? 0 : settleFrames + 1;
  if (settleFrames > 15 || rollTimeout > 6) {
    settleFrames = 0; rollTimeout = 0;
    onBallsSettled();
  }
}

function onBallsSettled() {
  if (game.twinActive) { game.twinActive = false; camMode = 'near'; dismissAmit(); }
  if (game.throwingJack) return onJackSettled();
  if (game.pendingMagnet) {
    const mb = game.pendingMagnet;
    game.pendingMagnet = null;
    game.phase = 'magnet-pull';
    startMagnetPull(mb);
    return;
  }
  const holder = holdingTeam();
  if (holder !== null) {
    setMessage(`${game.teams[holder].name} ${holder === game.current ? 'take' : 'hold'} the point!`);
  }
  nextThrower(holder);
}

function onJackSettled() {
  const p = jackBall.body.position;
  const dist = p.z - THROW_Z;
  const valid = dist > 5 && dist < 11.5 && Math.abs(p.x) < COURT.width / 2 - 0.1;
  if (!valid && game.jackTries < 2) {
    game.jackTries++;
    setMessage('Jack must land 5–11 m away — throw again!');
    removeBall(jackBall);
    jackBall = null;
    beginAim(true);
    return;
  }
  if (!valid) {
    jackBall.body.position.set(0, JACK_R, THROW_Z + 8);
    jackBall.body.velocity.setZero();
  }
  game.jackTries = 0;
  game.current = game.jackThrower;
  beginAim(false);
  if (game.currentPlayer) setMessage(`${game.currentPlayer.name} throws the first boule`);
  else nextThrower(holdingTeam());
}

function boulesOf(team) { return balls.filter((b) => b.team === team); }
function distToJack(b) { return jackBall ? b.body.position.distanceTo(jackBall.body.position) : Infinity; }
// Who holds the point right now, and with how many boules — the same
// count that would be scored if the end stopped here.
function currentPoints() {
  if (!jackBall) return null;
  const holder = holdingTeam();
  if (holder === null) return null;
  const loser = boulesOf(1 - holder);
  const bestLoser = loser.length ? Math.min(...loser.map(distToJack)) : Infinity;
  const count = boulesOf(holder).filter((b) => distToJack(b) < bestLoser).length;
  return { team: holder, count: Math.max(1, count), nearest: Math.min(...boulesOf(holder).map(distToJack)) };
}

function updateHolding() {
  const el = $('holding');
  const p = currentPoints();
  if (!p) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  el.className = `t${p.team}`;
  el.innerHTML =
    `<span class="dot"></span>${game.teams[p.team].name} holds` +
    `<b>${p.count}</b>${p.count > 1 ? 'boules' : 'boule'}` +
    `<span class="cm">closest ${(p.nearest * 100).toFixed(0)} cm</span>`;
}

function holdingTeam() {
  if (!jackBall) return null;
  let best = null, bestD = Infinity;
  for (const b of balls) {
    if (b.team === -1) continue;
    const d = distToJack(b);
    if (d < bestD) { bestD = d; best = b.team; }
  }
  return best;
}

function nextThrower(holder) {
  const [t1, t2] = game.teams;
  const l1 = boulesLeft(t1), l2 = boulesLeft(t2);
  if (l1 === 0 && l2 === 0) return endOfEnd();
  // whipped-in extra boule: same player throws again straight away
  if (game.repeatThrower && !game.repeatThrower.thrown) {
    const p = game.repeatThrower;
    game.repeatThrower = null;
    game.current = game.teams.findIndex((t) => t.players.includes(p));
    game.forcePlayer = p;
    setMessage(`${p.name} throws again — second boule!`, 2600);
    return beginAim(false);
  }
  let next;
  if (l1 === 0) next = 1;
  else if (l2 === 0) next = 0;
  else if (holder === null) next = game.current === 0 ? 1 : 0;
  else next = holder === 0 ? 1 : 0;
  game.current = next;
  beginAim(false);
}

// ---------- End / scoring ----------
function endOfEnd() {
  game.phase = 'between';
  game.currentPlayer = null;
  const holder = holdingTeam();
  if (holder === null) return startEnd(game.jackThrower);
  const loserBoules = boulesOf(1 - holder);
  const bestLoser = loserBoules.length ? Math.min(...loserBoules.map(distToJack)) : Infinity;
  const pts = Math.max(1, boulesOf(holder).filter((b) => distToJack(b) < bestLoser).length);
  game.teams[holder].score += pts;

  updateHUD();
  const w = game.teams[holder];
  if (w.score >= WIN_SCORE) return showWin(holder);

  $('end-title').textContent = `${w.name} score ${pts} point${pts > 1 ? 's' : ''}!`;
  $('end-detail').textContent = `${game.teams[0].name} ${game.teams[0].score} – ${game.teams[1].score} ${game.teams[1].name}`;
  show('end-screen');
  $('next-end-btn').onclick = () => {
    hide('end-screen');
    // both teams get a question each end — losing team answers first
    askTrivia(1 - holder, () => askTrivia(holder, () => startEnd(holder)));
  };
}

function startEnd(jackThrower) {
  clearBalls();
  clearHoles();
  if (cleaner) { world.removeBody(cleaner.body); scene.remove(cleaner.mesh); cleaner = null; }
  dismissAmit();
  game.twinActive = false;
  game.tsiktsukArmed = false;
  game.magnetArmed = false;
  game.pendingMagnet = null;
  if (magnetPull) { scene.remove(magnetPull.ring); magnetPull = null; }
  if (whip) { scene.remove(whip.line); scene.remove(whip.spark); whip = null; }
  if (snipe) { scene.remove(snipe.tracer); scene.remove(snipe.flash); snipe = null; }
  clearDisguise();
  game.repeatThrower = null;
  game.forcePlayer = null;
  $('crosshair').classList.add('hidden');
  camMode = 'near';
  game.teams.forEach((t) => t.players.forEach((p) => { p.thrown = false; p.extra = 0; }));
  game.jackThrower = jackThrower;
  game.current = jackThrower;
  beginAim(true);
}

function showWin(winner) {
  const w = game.teams[winner], l = game.teams[1 - winner];
  $('win-title').textContent = `🏆 ${w.name} win ${w.score}–${l.score}!`;
  $('win-detail').textContent = 'Joyeux 60e anniversaire, Ofer ! 🎂🥳';
  show('win-screen');
  game.phase = 'between';
  $('replay-btn').onclick = () => {
    hide('win-screen');
    game.teams.forEach((t) => { t.score = 0; t.charges = {}; });
    game.usedQuestions.clear();
    startEnd(Math.round(Math.random()));
  };
}

// ---------- Trivia ----------
function askTrivia(teamIdx, done) {
  const available = QUESTIONS.map((q, i) => i).filter((i) => !game.usedQuestions.has(i));
  const pool = available.length ? available : QUESTIONS.map((_, i) => i);
  if (!available.length) game.usedQuestions.clear();
  const qi = pool[Math.floor(Math.random() * pool.length)];
  game.usedQuestions.add(qi);
  const q = QUESTIONS[qi];

  game.phase = 'between';
  $('trivia-team').textContent = game.teams[teamIdx].name;
  $('trivia-question').textContent = q.question;
  $('trivia-result').classList.add('hidden');
  const img = $('trivia-image');
  if (q.image) { img.src = q.image; img.classList.remove('hidden'); }
  else img.classList.add('hidden');
  const box = $('trivia-answers');
  box.innerHTML = '';
  // shuffle display order so the correct answer's position isn't predictable
  const order = q.answers.map((_, i) => i).sort(() => Math.random() - 0.5);
  const buttonFor = {};
  order.forEach((i) => {
    const a = q.answers[i];
    const btn = document.createElement('button');
    buttonFor[i] = btn;
    btn.textContent = a;
    btn.dir = 'auto';
    btn.onclick = () => {
      [...box.children].forEach((b) => (b.disabled = true));
      const ok = i === q.correct;
      btn.classList.add(ok ? 'correct' : 'wrong');
      if (!ok) buttonFor[q.correct].classList.add('correct');
      const res = $('trivia-result');
      res.textContent = ok
        ? '🎁 Correct! Now choose your perk...'
        : 'Oops — no perk this time!';
      res.classList.remove('hidden');
      if (ok) setTimeout(() => showPerkChooser(teamIdx, done), 1300);
      else setTimeout(() => { hide('trivia-screen'); done(); }, 1800);
    };
    box.appendChild(btn);
  });
  show('trivia-screen');
}

function showPerkChooser(teamIdx, done) {
  const team = game.teams[teamIdx];
  $('trivia-team').textContent = team.name;
  $('trivia-question').textContent = '🎁 Choose your perk!';
  $('trivia-result').classList.add('hidden');
  $('trivia-image').classList.add('hidden');
  const box = $('trivia-answers');
  box.innerHTML = '';
  for (const perk of PERKS.filter((p) => p.team === teamIdx)) {
    const b = document.createElement('button');
    b.innerHTML = `${perk.title}<br/><small>${perk.hint}</small>`;
    b.onclick = () => {
      team.charges[perk.id] = (team.charges[perk.id] || 0) + 1;
      hide('trivia-screen');
      setMessage(`${team.name} banked: ${perk.title} — watch for it glowing green bottom-right!`, 4000);
      done();
    };
    box.appendChild(b);
  }
  show('trivia-screen');
}

// ---------- Input ----------
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, .panel, #perk-bar, #arc-panel, #player-picker')) return;
  if (game.phase === 'cleaner-aim') {
    startCleaner(reticle.position.x);
    return;
  }
  if (game.phase === 'sniper-aim') {
    const best = nearestBoule(reticle.position);
    if (!best) { setMessage('No boule on the court to shoot!', 2500); game.phase = 'aim'; $('crosshair').classList.add('hidden'); updateHUD(); return; }
    if (best.d > 1.6) { setMessage('Aim closer to a boule!', 2000); return; }
    startSnipe(best.ball);
    return;
  }
  if (game.phase === 'whip-aim') {
    const best = nearestBoule(reticle.position);
    if (!best) { setMessage('No boule on the court to whip!', 2500); game.phase = 'aim'; updateHUD(); return; }
    if (best.d > 1.6) { setMessage('Click closer to a boule!', 2000); return; }
    startWhip(best.ball);
    return;
  }
  if (game.phase === 'digging') {
    // Happy digs at the clicked spot
    const pos = reticle.position;
    digHole(pos.x, pos.z);
    playDig();
    bigShout('🐾 DIG DIG!', 1200);
    setAnim('happy', 'dig', 2.5);
    const happy = charOf('happy');
    if (happy) happy.target.set(pos.x + 0.45, 0, pos.z); // run to the hole
    reticle.material.color.set(0xffee66);
    setMessage('Happy dug a trap — and still gets her throw!', 3500);
    game.phase = 'aim'; // digging does NOT use up Happy's turn
    updateHUD();
    return;
  }
  if (game.phase === 'aim' || game.phase === 'aim-jack') {
    game.phase = 'charging';
    game.powerT = 0;
    updatePerkBar();
    updatePlayerPicker();
  }
});

window.addEventListener('pointerup', () => {
  if (game.phase === 'charging') throwBall();
});

// ---------- Start ----------
$('start-btn').onclick = () => {
  game.teams[0].name = $('team1-name').value.trim() || 'Team Ofer';
  game.teams[1].name = $('team2-name').value.trim() || 'Team Shani';
  if ($('test-mode').checked) {
    // every perk, 5 charges each, so all of them can be tried immediately
    for (const perk of PERKS) game.teams[perk.team].charges[perk.id] = 5;
  }
  hide('start-screen');
  show('hud');
  startEnd(Math.round(Math.random()));
  const touch = matchMedia('(hover: none)').matches;
  setMessage(touch
    ? 'Touch and hold to charge, drag to aim, lift to throw!'
    : 'Hold the mouse button to charge power, release to throw!', 5000);
};

// ---------- Main loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = performance.now() / 1000;

  // camera glide
  const cam = CAMS[camMode];
  camera.position.lerp(cam.pos, 0.06);
  camLook.lerp(cam.look, 0.06);
  camera.lookAt(camLook);

  // aiming
  if (['aim', 'aim-jack', 'charging', 'digging', 'cleaner-aim', 'whip-aim', 'sniper-aim'].includes(game.phase)) {
    raycaster.setFromCamera(mouse, camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, hit)) {
      hit.x = THREE.MathUtils.clamp(hit.x, -COURT.width / 2 + 0.2, COURT.width / 2 - 0.2);
      const zMin = THROW_Z + 2;
      const zMax = game.twinActive ? FAR_THROW_Z - 2 : COURT.length / 2 - 0.3;
      hit.z = THREE.MathUtils.clamp(hit.z, zMin, zMax);

      const throwing = ['aim', 'aim-jack', 'charging'].includes(game.phase);
      if (throwing) {
        // Mouse sideways = direction. Mouse near/far from the thrower = arc:
        // close in gives a flat roll, pushing it up the court lifts the lob.
        const o = throwOrigin();
        const back = game.twinActive ? -1 : 1; // the twin throws the other way
        let dx = hit.x - o.x;
        let dz = Math.max((hit.z - o.z) * back, 0.9) * back;
        const dist = Math.hypot(dx, dz);
        // near the thrower = high lob that drops short; far up the court =
        // flat throw that carries, which is how you'd actually play the shot
        const k = THREE.MathUtils.clamp((dist - AIM_NEAR) / (AIM_FAR - AIM_NEAR), 0, 1);
        game.loft = LOFT_MAX - k * (LOFT_MAX - LOFT_MIN);
        updateArcPanel();
        // the marker stays at a fixed short radius — it shows angle and side,
        // not where the boule will land
        dx /= dist; dz /= dist;
        game.aimPoint.set(o.x + dx * AIM_RADIUS, 0, o.z + dz * AIM_RADIUS);
        reticle.position.set(game.aimPoint.x, 0.015, game.aimPoint.z);
      } else {
        game.aimPoint.copy(hit);
        reticle.position.set(hit.x, 0.015, hit.z);
      }
    }
  }

  if (game.phase === 'charging') {
    game.powerT += dt;
    const pt = (game.powerT * 0.9) % 2;
    game.power = pt < 1 ? pt : 2 - pt;
    $('power-fill').style.width = `${game.power * 100}%`;
  }
  updateGuide(); // angle tracer follows the mouse the whole time you're aiming
  updateHolding(); // live "who holds the point" readout

  // physics — skip stepping entirely once every ball sleeps
  if (balls.length) {
    const anyAwake = balls.some((b) => b.body.sleepState !== CANNON.Body.SLEEPING)
      || !!cleaner || !!magnetPull || !!whip || !!snipe;
    if (anyAwake) {
      if (cleaner) {
        // wake anything near the robot so it can be shoved aside
        for (const b of balls) {
          if (b.body.position.distanceTo(cleaner.body.position) < 1.8) {
            b.body.wakeUp();
            b.trapped = false;
          }
        }
      }
      world.step(1 / 60, dt, 3);
      for (const b of balls) {
        if (b.body.sleepState === CANNON.Body.SLEEPING) continue;
        const sp = Math.hypot(b.body.velocity.x, b.body.velocity.z);
        if (b.trapped && sp > 0.3) b.trapped = false; // knocked out of the hole
        const onGround = b.body.position.y < b.r * 1.6;
        if (onGround) {
          b.body.velocity.x *= 0.975;
          b.body.velocity.z *= 0.975;
          b.body.angularVelocity.scale(0.97, b.body.angularVelocity);
        }
        // hole suction: a touching ball gets dragged in, then frozen asleep
        if (!b.trapped && onGround) {
          for (const h of holes) {
            const dx = b.body.position.x - h.x, dz = b.body.position.z - h.z;
            const d = Math.hypot(dx, dz);
            if (d < h.r + b.r) {
              b.inHole = true;
              if (sp > 0.1) {
                b.body.velocity.x -= (dx / (d || 1)) * 0.35;
                b.body.velocity.z -= (dz / (d || 1)) * 0.35;
                b.body.velocity.x *= 0.82;
                b.body.velocity.z *= 0.82;
              } else {
                b.trapped = true;
                b.body.velocity.setZero();
                b.body.angularVelocity.setZero();
                b.body.sleep();
              }
              break;
            }
          }
          if (b.inHole) {
            const still = holes.some((h) => Math.hypot(b.body.position.x - h.x, b.body.position.z - h.z) < h.r + b.r);
            if (!still) b.inHole = false;
          }
        }
        b.mesh.position.copy(b.body.position);
        if (b.inHole) b.mesh.position.y -= 0.03;
        b.mesh.quaternion.copy(b.body.quaternion);
      }
    }
    if (game.phase === 'rolling') checkSettled(dt);
  }

  if (whip) updateWhip(dt);
  if (snipe) updateSnipe(dt);
  if (maskAnim) updateMaskAnim(dt);
  if (maskOff) updateMaskOff(dt);
  if (magnetPull) updateMagnetPull(dt, t);
  for (const b of balls) {
    if (b.halo) b.halo.rotation.z += dt * 4;
    // keep each ball's ground ring under it
    if (b.ring) b.ring.position.set(b.body.position.x, 0.016, b.body.position.z);
  }

  // Mom's robot cleaner sweeping its column
  if (cleaner) {
    if (!balls.length) world.step(1 / 60, dt, 3);
    cleaner.mesh.position.copy(cleaner.body.position);
    cleaner.mesh.rotation.y += dt * 3;
    if (cleaner.body.position.z > COURT.length / 2 - 0.3) finishCleaner();
  }

  // characters: glide to targets + idle/special animations
  for (const c of characters) {
    c.group.position.x += (c.target.x - c.group.position.x) * 0.06;
    c.group.position.z += (c.target.z - c.group.position.z) * 0.06;
    let y = 0;
    const active = c.anim && t < c.animUntil;
    if (active && c.anim === 'jump') y = Math.abs(Math.sin(t * 10)) * 0.35;
    else if (active && c.anim === 'tremble') c.group.position.x += Math.sin(t * 40) * 0.015;
    else if (active && c.anim === 'dig') { y = Math.abs(Math.sin(t * 14)) * 0.12; c.group.rotation.x = -0.3; }
    else if (active && c.anim === 'snipe') {
      // crouch into the shot, arm levelled
      c.group.rotation.x = 0.18;
      y = -0.12;
      if (c.parts.armR) c.parts.armR.rotation.z = -1.5;
    }
    else if (active && c.anim === 'whip') {
      // lunge forward and swing the throwing arm overhead
      c.group.rotation.x = -0.25;
      y = 0.06;
      if (c.parts.armR) c.parts.armR.rotation.z = -2.1 + Math.sin(t * 18) * 0.4;
    }
    else {
      c.group.rotation.x = 0;
      if (c.parts.armR) c.parts.armR.rotation.z = -0.25;
      y = c.dog ? 0 : Math.sin(t * 2.2 + c.home.z) * 0.025 + 0.025;
    }
    if (!active && c.anim) { c.anim = null; updateCharacterTargets(); }
    c.group.position.y = y;
    if (c.dog && c.parts.tail) c.parts.tail.rotation.x = Math.sin(t * 9) * 0.5;
  }
  if (amit) amit.position.y = Math.abs(Math.sin(t * 3)) * 0.04;

  renderer.render(scene, camera);
}
animate();

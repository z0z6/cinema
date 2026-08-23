import * as THREE from 'three';
import { buildRoom } from './room.js';
import { createVideoGroups, disposeVideos } from './videos.js';
import { BOUNDS, resolveCollision, crossesSolidWall } from './collision.js';
import { GalleryControls } from './controls.js';
import { CardboardMode } from './cardboard.js';
import { getActiveGamepad, applyGamepadMovement } from './gamepad.js';
import { initMobileControls } from './mobileControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111114);
scene.fog = new THREE.Fog(0x111114, 14, 34);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

renderer.domElement.style.display = 'none';

const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);

const { floorMesh } = buildRoom(scene);

let interactiveVideos = [];
let currentStreams = [];

async function loadStreams() {
  const saved = localStorage.getItem('metaverse_streams');
  if (saved) {
    try {
      currentStreams = JSON.parse(saved);
      console.log('Wczytano streamy z LocalStorage');
    } catch (e) {
      console.error('Błąd parsowania streamów z LocalStorage', e);
    }
  }

  if (!currentStreams || currentStreams.length === 0) {
    try {
      const res = await fetch('videos.json', { cache: 'no-store' });
      if (res.ok) {
        currentStreams = await res.json();
        console.log('Wczytano domyślne streamy z videos.json');
      }
    } catch (err) {
      console.warn('Nie znaleziono videos.json, używam awaryjnych linków.');
      currentStreams = [
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', title: 'Stream 1' },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', title: 'Stream 2' }
      ];
    }
  }
  
  updateSceneVideos();
  renderStreamList();
}

function updateSceneVideos() {
  disposeVideos(scene, interactiveVideos);
  interactiveVideos = createVideoGroups(scene, currentStreams);
}

loadStreams();

const controls = new GalleryControls(camera, renderer.domElement, scene);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
let dwell = 0;
const TELEPORT_DWELL = 2.2;

const cardboard = new CardboardMode(renderer, camera);
let inVR = false;
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);

// --- OBSŁUGA GUI ---
const guiPanel = document.getElementById('stream-gui-panel');
const streamListEl = document.getElementById('stream-list');

document.getElementById('open-stream-gui').addEventListener('click', () => {
  guiPanel.classList.remove('hidden');
  renderStreamList();
});

document.getElementById('close-stream-gui').addEventListener('click', () => {
  guiPanel.classList.add('hidden');
});

function renderStreamList() {
  streamListEl.innerHTML = '';
  currentStreams.forEach((stream, index) => {
    const li = document.createElement('li');
    li.className = 'stream-item';
    li.innerHTML = `
      <span title="${stream.title}: ${stream.url}">${index + 1}. ${stream.title}</span>
      <button class="remove-stream-btn" data-index="${index}">Usuń</button>
    `;
    streamListEl.appendChild(li);
  });

  document.querySelectorAll('.remove-stream-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      currentStreams.splice(idx, 1);
      saveAndApplyStreams();
    });
  });
}

function saveAndApplyStreams() {
  localStorage.setItem('metaverse_streams', JSON.stringify(currentStreams));
  updateSceneVideos();
  renderStreamList();
}

document.getElementById('add-stream-btn').addEventListener('click', () => {
  const urlInput = document.getElementById('stream-url');
  const titleInput = document.getElementById('stream-title');
  
  const url = urlInput.value.trim();
  const title = titleInput.value.trim() || 'Nowy Stream';

  if (url) {
    currentStreams.push({ url, title });
    urlInput.value = '';
    titleInput.value = '';
    saveAndApplyStreams();
  } else {
    alert('Proszę podać adres URL streama.');
  }
});

document.getElementById('reset-streams-btn').addEventListener('click', () => {
  if (confirm('Czy na pewno chcesz usunąć własne streamy i przywrócić domyślne z videos.json?')) {
    localStorage.removeItem('metaverse_streams');
    currentStreams = [];
    loadStreams();
  }
});
// -------------------

function updateGazeTeleport(dt) {
  const dir = new THREE.Vector3();
  const origin = new THREE.Vector3();
  camera.getWorldDirection(dir);
  camera.getWorldPosition(origin);
  const fill = document.getElementById('reticle-fill');

  if (dir.y < -0.15) {
    raycaster.set(origin, dir);
    const hits = raycaster.intersectObject(floorMesh);
    if (hits.length) {
      dwell += dt;
      fill.style.height = Math.min(100, (dwell / TELEPORT_DWELL) * 100) + '%';
      if (dwell >= TELEPORT_DWELL) {
        const targetPoint = hits[0].point.clone();
        const PLAYER_VR_RADIUS = 0.55; 
        resolveCollision(targetPoint, PLAYER_VR_RADIUS, 1.0);
        if (!crossesSolidWall(rig.position, targetPoint, PLAYER_VR_RADIUS)) {
          rig.position.x = targetPoint.x;
          rig.position.z = targetPoint.z;
          resolveCollision(rig.position, PLAYER_VR_RADIUS, 1.0);
        }
        dwell = 0;
        fill.style.height = '0%';
      }
      return;
    }
  }
  dwell = 0;
  fill.style.height = '0%';
}

function updateCaption() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  raycaster.set(origin, dir);
  const targets = interactiveVideos.flatMap(g => g.children);
  const hits = raycaster.intersectObjects(targets, false);
  const captionEl = document.getElementById('artwork-caption');
  if (hits.length && hits[0].distance < 8) {
    const group = hits[0].object.parent;
    captionEl.textContent = group.userData.title || 'Stream wideo';
    captionEl.classList.remove('hidden');
  } else {
    captionEl.classList.add('hidden');
  }
}

window.addEventListener('click', (event) => {
  if (inVR) return;
  if (event.target.closest('.hud-btn, .mode-btn, #intro, #stream-gui-panel')) return;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  raycaster.set(origin, dir);
  const targets = interactiveVideos.flatMap(g => g.children);
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length && hits[0].distance < 8) {
    const group = hits[0].object.parent;
    if (group.userData.isVideo && group.userData.videoElement) {
      const video = group.userData.videoElement;
      video.muted = !video.muted;
      if (!video.muted) video.play();
    }
  }
});

function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (inVR) {
    resolveCollision(rig.position, 0.55, 1.0);
    const gp = getActiveGamepad();
    const reticle = document.getElementById('reticle-ring');
    if (gp) {
      applyGamepadMovement(gp, camera, rig, dt, 2.4, (pos, r) => resolveCollision(pos, Math.max(r, 0.55), 1.0));
      dwell = 0;
      document.getElementById('reticle-fill').style.height = '0%';
      reticle.style.display = 'none';
    } else {
      reticle.style.display = 'block';
      updateGazeTeleport(dt);
    }
    cardboard.render(scene);
  } else {
    controls.update(dt);
    updateCaption();
    renderer.render(scene, camera);
  }
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (inVR) {
    cardboard.updateAspect();
  } else {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
});

function startExperience(mode) {
  renderer.domElement.style.display = 'block';
  controls.setMode(mode);
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  rig.position.set(0, 0, 0);
  
  if (isMobileDevice) {
    document.getElementById('joystick-base').classList.remove('hidden');
  } else {
    renderer.domElement.requestPointerLock();
  }
}

document.getElementById('start-fpp').addEventListener('click', () => startExperience('fpp'));
document.getElementById('start-tpp').addEventListener('click', () => startExperience('tpp'));
document.getElementById('toggle-mode').addEventListener('click', () => controls.toggleMode());

if (isMobileDevice) initMobileControls(controls);

const vrBtn = document.getElementById('start-vr');
if (!isMobileDevice) {
  vrBtn.disabled = true;
  vrBtn.classList.add('long-label');
  vrBtn.querySelector('span').textContent = 'VR dostępne tylko w urządzeniach mobilnych';
}

vrBtn.addEventListener('click', async () => {
  if (vrBtn.disabled) return;
  renderer.domElement.style.display = 'block';
  const vrStart = new THREE.Vector3(0, 0, 0);
  resolveCollision(vrStart, 0.55, 1.0);
  rig.position.copy(vrStart);
  rig.position.y = 0;
  camera.position.set(0, 1.65, 0);
  camera.near = 0.15;
  cardboard.updateAspect();
  await cardboard.enable();
  inVR = true;
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('reticle-ring').style.display = 'block';
  document.getElementById('exit-vr').classList.remove('hidden');
});

document.getElementById('exit-vr').addEventListener('click', () => {
  cardboard.disable();
  inVR = false;
  controls.player.set(0, 0, 0);
  rig.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  document.getElementById('reticle-ring').style.display = 'none';
  document.getElementById('exit-vr').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('intro').classList.remove('hidden');
  renderer.domElement.style.display = 'none';
});

import * as THREE from 'three';
import { buildRoom } from './room.js';
import { createVideoGroups, disposeVideos } from './videos.js';
import { CardboardMode } from './cardboard.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.Fog(0x0a0a0a, 10, 25);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8; // Ciemniej dla efektu kinowego
document.body.appendChild(renderer.domElement);

renderer.domElement.style.display = 'none';

// Statyczny obserwator na środku sali
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);
rig.position.set(0, 0, 0); // Środek sali
camera.position.set(0, 1.65, 0); // Wysokość oczu

const { floorMesh } = buildRoom(scene);

let interactiveVideos = [];
let currentStreams = [];

async function loadStreams() {
  const saved = localStorage.getItem('metaverse_streams');
  if (saved) {
    try {
      currentStreams = JSON.parse(saved);
    } catch (e) {
      console.error('Błąd parsowania streamów', e);
    }
  }

  if (!currentStreams || currentStreams.length === 0) {
    try {
      const res = await fetch('videos.json', { cache: 'no-store' });
      if (res.ok) {
        currentStreams = await res.json();
      }
    } catch (err) {
      currentStreams = [
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', title: 'Film 1' },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', title: 'Film 2' }
      ];
    }
  }
  
  updateSceneVideos();
}

function updateSceneVideos() {
  disposeVideos(scene, interactiveVideos);
  interactiveVideos = createVideoGroups(scene, currentStreams);
}

loadStreams();

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

const cardboard = new CardboardMode(renderer, camera);
let inVR = false;

const vrBtn = document.getElementById('start-vr');

// Sprawdź czy urządzenie mobilne
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
if (!isMobileDevice) {
  vrBtn.disabled = true;
  vrBtn.querySelector('span').textContent = 'VR dostępne tylko na urządzeniach mobilnych';
}

vrBtn.addEventListener('click', async () => {
  if (vrBtn.disabled) return;
  
  renderer.domElement.style.display = 'block';
  
  camera.position.set(0, 1.65, 0);
  camera.near = 0.1;
  cardboard.updateAspect();
  
  await cardboard.enable();
  inVR = true;
  
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
});

document.getElementById('exit-vr').addEventListener('click', () => {
  cardboard.disable();
  inVR = false;
  
  camera.rotation.set(0, 0, 0);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('intro').classList.remove('hidden');
  renderer.domElement.style.display = 'none';
});

// Pokazywanie tytułu filmu na który patrzy użytkownik
function updateCaption() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  raycaster.set(origin, dir);
  
  const targets = interactiveVideos.flatMap(g => g.children);
  const hits = raycaster.intersectObjects(targets, false);
  const captionEl = document.getElementById('video-caption');
  
  if (hits.length && hits[0].distance < 10) {
    const group = hits[0].object.parent;
    captionEl.textContent = group.userData.title || 'Film';
    captionEl.classList.remove('hidden');
  } else {
    captionEl.classList.add('hidden');
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  
  if (inVR) {
    updateCaption();
    cardboard.render(scene);
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

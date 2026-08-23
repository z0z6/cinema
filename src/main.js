import * as THREE from 'three';
import { buildRoom } from './room.js';
import { createVideoGroups, disposeVideos } from './videos.js';
import { CardboardMode } from './cardboard.js';

// === Inicjalizacja sceny ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.Fog(0x0a0a0a, 10, 25);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
document.body.appendChild(renderer.domElement);

renderer.domElement.style.display = 'none';

// === Statyczny obserwator na środku sali ===
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);
rig.position.set(0, 0, 0);
camera.position.set(0, 1.65, 0);

// === Budowa sali ===
const { floorMesh } = buildRoom(scene);

// === Zarządzanie filmami ===
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
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', title: 'Film 1' },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', title: 'Film 2' }
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

// === Kontrolki i VR ===
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

const cardboard = new CardboardMode(renderer, camera);
let inVR = false;

// === Sprawdź urządzenie ===
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
const vrBtn = document.getElementById('start-vr');

if (!isMobileDevice) {
  vrBtn.disabled = true;
  vrBtn.querySelector('span').textContent = 'VR dostępne tylko na urządzeniach mobilnych';
}

// === Obsługa GUI ===
const guiPanel = document.getElementById('stream-gui-panel');
const streamListEl = document.getElementById('stream-list');

// Funkcja pomocnicza do wykrywania typu URL
function detectUrlType(url) {
  if (!url) return 'unknown';
  if (url.includes('mega.nz') || url.includes('mega.co.nz')) return 'MEGA';
  if (/youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed/i.test(url)) return 'YouTube';
  if (/vimeo\.com\/\d+/i.test(url)) return 'Vimeo';
  if (/dailymotion\.com\/video\//i.test(url)) return 'Dailymotion';
  if (/twitch\.tv\//i.test(url)) return 'Twitch';
  if (/\.(m3u8|ts)(\?|$)/i.test(url)) return 'HLS';
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return 'Video';
  return 'Inne';
}

document.getElementById('open-stream-gui-intro')?.addEventListener('click', () => {
  guiPanel.classList.remove('hidden');
  renderStreamList();
});

document.getElementById('open-stream-gui')?.addEventListener('click', () => {
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
    const type = detectUrlType(stream.url);
    li.innerHTML = `
      <span title="${stream.title}: ${stream.url}">${index + 1}. ${stream.title}</span>
      <span class="stream-type">${type}</span>
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
  const title = titleInput.value.trim() || 'Nowy Film';

  if (!url) {
    alert('Proszę podać adres URL filmu.');
    return;
  }

  const isValidUrl = url.startsWith('http://') || url.startsWith('https://');
  const type = detectUrlType(url);
  const isIframeType = ['YouTube', 'Vimeo', 'Dailymotion', 'Twitch'].includes(type);

  if (!isValidUrl) {
    alert('Nieprawidłowy format URL. Link musi zaczynać się od http:// lub https://');
    return;
  }

  if (type === 'unknown') {
    if (!confirm('Link nie wygląda na obsługiwany format. Czy na pewno chcesz go dodać?\n\nObsługiwane:\n• Bezpośrednie linki (.mp4, .webm)\n• MEGA.nz\n• YouTube\n• Vimeo\n• Dailymotion\n• Twitch\n• HLS streams (.m3u8)')) {
      return;
    }
  }

  if (isIframeType) {
    alert('⚠️ Uwaga: Filmy z serwisów streamingowych (' + type + ') mogą nie działać w trybie VR ze względu na ograniczenia technologii iframe. Zostanie wyświetlony placeholder z tytułem filmu.\n\nAby oglądać te filmy w pełni, otwórz link bezpośrednio w przeglądarce.');
  }

  currentStreams.push({ url, title });
  urlInput.value = '';
  titleInput.value = '';
  saveAndApplyStreams();
});

document.getElementById('reset-streams-btn').addEventListener('click', () => {
  if (confirm('Czy na pewno chcesz usunąć własne filmy i przywrócić domyślne z videos.json?')) {
    localStorage.removeItem('metaverse_streams');
    currentStreams = [];
    loadStreams();
  }
});

// === Start VR ===
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

// === Pokazywanie tytułu filmu ===
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

// === Pętla animacji ===
function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  
  if (inVR) {
    updateCaption();
    cardboard.render(scene);
  }
}

renderer.setAnimationLoop(animate);

// === Obsługa resize ===
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (inVR) {
    cardboard.updateAspect();
  } else {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
});

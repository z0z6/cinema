import * as THREE from 'three';
import { generateWallSlots } from './room.js';

/**
 * Tworzy ekran wideo z ramką w scenie 3D.
 * UWAGA: Aby odtwarzać streamy z YouTube/Twitch, potrzebne są bezpośrednie linki do strumienia (np. .mp4, .m3u8).
 * Poniższa implementacja używa natywnego HTML5 <video>, który obsługuje bezpośrednie URL-e.
 */
function buildVideoScreen(group, videoUrl, title, maxWidth, maxHeight) {
  const video = document.createElement('video');
  video.src = videoUrl;
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true; // Wymagane do autoodtwarzania w przeglądarkach
  video.playsInline = true;
  
  video.play().catch(e => console.warn('Autoodtwarzanie wideo zablokowane:', e));

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;

  video.onloadedmetadata = () => {
    const aspect = video.videoWidth / video.videoHeight;
    let w = maxWidth;
    let h = w / aspect;
    if (h > maxHeight) {
      h = maxHeight;
      w = h * aspect;
    }

    const FRAME_DEPTH = 0.15;
    const FRAME_PAD = 0.2;
    
    // Ramka
    const frameGeo = new THREE.BoxGeometry(w + FRAME_PAD * 2, h + FRAME_PAD * 2, FRAME_DEPTH);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.9 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -FRAME_DEPTH / 2;
    group.add(frame);

    // Ekran wideo
    const screenMat = new THREE.MeshBasicMaterial({ map: texture });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screen.position.z = FRAME_DEPTH / 2 + 0.01; // Lekko przed ramką
    group.add(screen);

    // Podświetlenie ekranu
    const light = new THREE.PointLight(0xffffff, 20, 10, 2);
    light.position.set(0, 0, 2.0);
    group.add(light);
  };

  group.userData.isVideo = true;
  group.userData.videoElement = video;
  group.userData.title = title || 'Stream wideo';
}

export async function loadVideos(scene) {
  const slots = generateWallSlots();
  let manifest = [];

  try {
    const res = await fetch('videos.json', { cache: 'no-store' });
    if (res.ok) {
      manifest = await res.json();
    }
  } catch (err) {
    console.warn('Nie znaleziono videos.json, używam domyślnych przykładowych streamów.');
    manifest = [
      { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', title: 'Stream 1 (Big Buck Bunny)' },
      { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', title: 'Stream 2 (Elephants Dream)' }
    ];
  }

  const interactive = [];

  slots.forEach((slot, i) => {
    const group = new THREE.Group();
    group.position.set(...slot.pos);
    group.rotation.y = slot.rotY;

    const entry = manifest[i] || manifest[0]; // Fallback do pierwszego, jeśli brak drugiego
    if (entry && entry.url) {
      buildVideoScreen(group, entry.url, entry.title, slot.maxWidth, slot.maxHeight || 5);
    }

    interactive.push(group);
    scene.add(group);
  });

  return interactive;
}

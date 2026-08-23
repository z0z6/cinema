import * as THREE from 'three';
import { generateWallSlots } from './room.js';

function buildVideoScreen(group, videoUrl, title, maxWidth, maxHeight) {
  const video = document.createElement('video');
  video.src = videoUrl;
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
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

    // DUŻA RAMKA - jak dla obrazów
    const FRAME_DEPTH = 0.15;
    const FRAME_PAD = 0.25; // Grubsza ramka
    
    const frameGeo = new THREE.BoxGeometry(w + FRAME_PAD * 2, h + FRAME_PAD * 2, FRAME_DEPTH);
    const frameMat = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a, 
      roughness: 0.3, 
      metalness: 0.7 
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -FRAME_DEPTH / 2;
    group.add(frame);

    // Ekran wideo
    const screenMat = new THREE.MeshBasicMaterial({ map: texture });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screen.position.z = FRAME_DEPTH / 2 + 0.01;
    group.add(screen);

    // Światło od ekranu (efekt kinowy)
    const screenLight = new THREE.PointLight(0xffffff, 15, 8, 2);
    screenLight.position.set(0, 0, 2.5);
    group.add(screenLight);
  };

  group.userData.isVideo = true;
  group.userData.videoElement = video;
  group.userData.title = title || 'Film';
}

export function disposeVideos(scene, videoGroups) {
  videoGroups.forEach(group => {
    if (group.userData.videoElement) {
      group.userData.videoElement.pause();
      group.userData.videoElement.src = '';
      group.userData.videoElement = null;
    }
    group.traverse((child) => {
      if (child.isMesh) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
        child.geometry.dispose();
      }
    });
    scene.remove(group);
  });
}

export function createVideoGroups(scene, streamsData) {
  const slots = generateWallSlots();
  const interactive = [];

  slots.forEach((slot, i) => {
    const group = new THREE.Group();
    group.position.set(...slot.pos);
    group.rotation.y = slot.rotY;

    const entry = streamsData[i] || streamsData[0];
    
    if (entry && entry.url) {
      buildVideoScreen(group, entry.url, entry.title, slot.maxWidth, slot.maxHeight || 5);
    }

    interactive.push(group);
    scene.add(group);
  });

  return interactive;
}

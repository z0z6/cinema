import * as THREE from 'three';
import { generateWallSlots } from './room.js';

// Funkcja do obsługi linków MEGA
async function getMegaVideoUrl(megaUrl) {
  try {
    console.log('Pobieranie z MEGA:', megaUrl);
    
    // Parsuj link MEGA
    const url = new URL(megaUrl);
    const pathParts = url.pathname.split('/');
    
    let fileId, fileKey;
    
    if (pathParts[1] === 'file') {
      // Format: https://mega.nz/file/ID#KEY
      fileId = pathParts[2];
      fileKey = url.hash.substring(1); // Usuń #
    } else if (pathParts[1] === 'folder') {
      // Format: https://mega.nz/folder/FOLDER_ID#KEY/file/FILE_ID
      fileKey = url.hash.substring(1);
      const fileMatch = url.pathname.match(/\/file\/([^\/]+)/);
      if (fileMatch) {
        fileId = fileMatch[1];
      } else {
        throw new Error('Nie znaleziono ID pliku w linku folderu');
      }
    } else {
      throw new Error('Nieobsługiwany format linku MEGA');
    }

    // Użyj MEGA SDK do pobrania pliku
    const file = mega.File.fromURL(megaUrl);
    await file.loadAttributes();
    
    // Pobierz plik jako Blob
    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const stream = file.download();
      
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      stream.on('error', reject);
    });

    // Utwórz Blob URL
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);
    
    console.log('MEGA plik pobrany, Blob URL:', blobUrl);
    return blobUrl;
    
  } catch (error) {
    console.error('Błąd pobierania z MEGA:', error);
    throw error;
  }
}

// Funkcja sprawdzająca czy URL to MEGA
function isMegaUrl(url) {
  return url.includes('mega.nz') || url.includes('mega.co.nz');
}

async function buildVideoScreen(group, videoUrl, title, maxWidth, maxHeight) {
  let actualVideoUrl = videoUrl;
  
  // Jeśli to link MEGA, pobierz plik i utwórz Blob URL
  if (isMegaUrl(videoUrl)) {
    try {
      actualVideoUrl = await getMegaVideoUrl(videoUrl);
    } catch (error) {
      console.error('Nie udało się pobrać pliku z MEGA:', error);
      // Utwórz placeholder texture z błędem
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Błąd pobierania', 256, 240);
      ctx.fillText('z MEGA', 256, 280);
      
      const errorTexture = new THREE.CanvasTexture(canvas);
      const errorMat = new THREE.MeshBasicMaterial({ map: errorTexture });
      const errorScreen = new THREE.Mesh(new THREE.PlaneGeometry(maxWidth, maxHeight), errorMat);
      errorScreen.position.z = 0.1;
      group.add(errorScreen);
      
      group.userData.isVideo = false;
      group.userData.title = title + ' (BŁĄD)';
      return;
    }
  }

  const video = document.createElement('video');
  video.src = actualVideoUrl;
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

    const FRAME_DEPTH = 0.15;
    const FRAME_PAD = 0.25;
    
    const frameGeo = new THREE.BoxGeometry(w + FRAME_PAD * 2, h + FRAME_PAD * 2, FRAME_DEPTH);
    const frameMat = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a, 
      roughness: 0.3, 
      metalness: 0.7 
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -FRAME_DEPTH / 2;
    group.add(frame);

    const screenMat = new THREE.MeshBasicMaterial({ map: texture });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screen.position.z = FRAME_DEPTH / 2 + 0.01;
    group.add(screen);

    const screenLight = new THREE.PointLight(0xffffff, 15, 8, 2);
    screenLight.position.set(0, 0, 2.5);
    group.add(screenLight);
  };

  group.userData.isVideo = true;
  group.userData.videoElement = video;
  group.userData.title = title || 'Film';
  group.userData.originalUrl = videoUrl;
}

export function disposeVideos(scene, videoGroups) {
  videoGroups.forEach(group => {
    if (group.userData.videoElement) {
      group.userData.videoElement.pause();
      // Zwolnij Blob URL jeśli to MEGA
      if (group.userData.originalUrl && isMegaUrl(group.userData.originalUrl)) {
        const videoSrc = group.userData.videoElement.src;
        if (videoSrc.startsWith('blob:')) {
          URL.revokeObjectURL(videoSrc);
        }
      }
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

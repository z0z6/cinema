import * as THREE from 'three';
import { generateWallSlots } from './room.js';

// === Funkcje pomocnicze ===

function isMegaUrl(url) {
  return url.includes('mega.nz') || url.includes('mega.co.nz');
}

function isHlsUrl(url) {
  return /\.(m3u8|ts)(\?|$)/i.test(url);
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

function isYouTubeUrl(url) {
  return /youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed/i.test(url);
}

function isVimeoUrl(url) {
  return /vimeo\.com\/\d+/i.test(url);
}

function isDailymotionUrl(url) {
  return /dailymotion\.com\/video\//i.test(url);
}

function isTwitchUrl(url) {
  return /twitch\.tv\//i.test(url);
}

function getYouTubeEmbedUrl(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}`;
  }
  return null;
}

function getVimeoEmbedUrl(url) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (match) {
    return `https://player.vimeo.com/video/${match[1]}?autoplay=1&muted=1&loop=1`;
  }
  return null;
}

function getDailymotionEmbedUrl(url) {
  const match = url.match(/dailymotion\.com\/video\/([^_]+)/);
  if (match) {
    return `https://www.dailymotion.com/embed/video/${match[1]}?autoplay=1&mute=1`;
  }
  return null;
}

function getTwitchEmbedUrl(url) {
  const match = url.match(/twitch\.tv\/([^\/\?]+)/);
  if (match) {
    return `https://player.twitch.tv/?channel=${match[1]}&parent=${window.location.hostname}&autoplay=true&muted=true`;
  }
  return null;
}

// === Pobieranie pliku z MEGA ===
async function getMegaVideoUrl(megaUrl) {
  try {
    console.log('Pobieranie z MEGA:', megaUrl);
    
    const file = mega.File.fromURL(megaUrl);
    await file.loadAttributes();
    
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

    const blob = new Blob([buffer], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);
    
    console.log('MEGA plik pobrany, Blob URL:', blobUrl);
    return blobUrl;
    
  } catch (error) {
    console.error('Błąd pobierania z MEGA:', error);
    throw error;
  }
}

// === Tworzenie ekranu z iframe (YouTube, Vimeo, Dailymotion, Twitch) ===
function buildIframeScreen(group, embedUrl, title, maxWidth, maxHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  
  // Gradient tła
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#0f0f1e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Ikona odtwarzania
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2 - 60, 100, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 30, canvas.height / 2 - 100);
  ctx.lineTo(canvas.width / 2 - 30, canvas.height / 2 - 20);
  ctx.lineTo(canvas.width / 2 + 50, canvas.height / 2 - 60);
  ctx.closePath();
  ctx.fill();
  
  // Tytuł
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title || 'Film', canvas.width / 2, canvas.height / 2 + 60);
  
  // Informacja o ograniczeniach
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText('Serwis zewnętrzny - niedostępne w VR', canvas.width / 2, canvas.height / 2 + 120);
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#64c8ff';
  ctx.fillText(embedUrl ? 'Kliknij aby otworzyć w przeglądarce' : '', canvas.width / 2, canvas.height / 2 + 160);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const aspect = 16 / 9;
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

  const screenLight = new THREE.PointLight(0x64c8ff, 10, 8, 2);
  screenLight.position.set(0, 0, 2.5);
  group.add(screenLight);

  group.userData.isVideo = false;
  group.userData.isIframe = true;
  group.userData.embedUrl = embedUrl;
  group.userData.title = title || 'Film';
  
  console.log('Utworzono placeholder dla iframe:', embedUrl);
}

// === Tworzenie ekranu z HLS stream ===
function buildHlsScreen(group, hlsUrl, title, maxWidth, maxHeight) {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = hlsUrl;
    video.play().catch(e => console.warn('Autoodtwarzanie HLS zablokowane:', e));
  } else if (window.Hls && window.Hls.isSupported()) {
    const hls = new window.Hls();
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(e => console.warn('Autoodtwarzanie HLS zablokowane:', e));
    });
    group.userData.hls = hls;
  } else {
    console.error('HLS nie jest obsługiwany w tej przeglądarce');
    return;
  }

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;

  video.onloadedmetadata = () => {
    const aspect = video.videoWidth / video.videoHeight || 16 / 9;
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
  group.userData.title = title || 'Stream HLS';
  group.userData.originalUrl = hlsUrl;
}

// === Tworzenie ekranu z bezpośredniego pliku wideo ===
async function buildVideoScreen(group, videoUrl, title, maxWidth, maxHeight) {
  let actualVideoUrl = videoUrl;
  
  if (isMegaUrl(videoUrl)) {
    try {
      actualVideoUrl = await getMegaVideoUrl(videoUrl);
    } catch (error) {
      console.error('Nie udało się pobrać pliku z MEGA:', error);
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

// === Główna funkcja tworząca ekrany ===
export function createVideoGroups(scene, streamsData) {
  const slots = generateWallSlots();
  const interactive = [];

  slots.forEach((slot, i) => {
    const group = new THREE.Group();
    group.position.set(...slot.pos);
    group.rotation.y = slot.rotY;

    const entry = streamsData[i] || streamsData[0];
    
    if (entry && entry.url) {
      const url = entry.url;
      const title = entry.title;
      
      if (isYouTubeUrl(url)) {
        const embedUrl = getYouTubeEmbedUrl(url);
        if (embedUrl) {
          buildIframeScreen(group, embedUrl, title, slot.maxWidth, slot.maxHeight || 5);
        }
      } else if (isVimeoUrl(url)) {
        const embedUrl = getVimeoEmbedUrl(url);
        if (embedUrl) {
          buildIframeScreen(group, embedUrl, title, slot.maxWidth, slot.maxHeight || 5);
        }
      } else if (isDailymotionUrl(url)) {
        const embedUrl = getDailymotionEmbedUrl(url);
        if (embedUrl) {
          buildIframeScreen(group, embedUrl, title, slot.maxWidth, slot.maxHeight || 5);
        }
      } else if (isTwitchUrl(url)) {
        const embedUrl = getTwitchEmbedUrl(url);
        if (embedUrl) {
          buildIframeScreen(group, embedUrl, title, slot.maxWidth, slot.maxHeight || 5);
        }
      } else if (isHlsUrl(url)) {
        buildHlsScreen(group, url, title, slot.maxWidth, slot.maxHeight || 5);
      } else if (isDirectVideoUrl(url) || isMegaUrl(url)) {
        buildVideoScreen(group, url, title, slot.maxWidth, slot.maxHeight || 5);
      } else {
        console.warn('Nieobsługiwany typ URL:', url);
      }
    }

    interactive.push(group);
    scene.add(group);
  });

  return interactive;
}

// === Czyszczenie zasobów ===
export function disposeVideos(scene, videoGroups) {
  videoGroups.forEach(group => {
    if (group.userData.hls) {
      group.userData.hls.destroy();
      group.userData.hls = null;
    }
    
    if (group.userData.videoElement) {
      group.userData.videoElement.pause();
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

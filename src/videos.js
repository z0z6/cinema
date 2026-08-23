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

// === Tworzenie placeholdera na ekranie (natychmiast) ===
function createPlaceholderScreen(group, title, subtitle, color = '#1a1a2e', accent = '#64c8ff', maxWidth = 8, maxHeight = 5) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, '#0f0f1e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Ikona odtwarzania
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2 - 40, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 20, canvas.height / 2 - 80);
  ctx.lineTo(canvas.width / 2 - 20, canvas.height / 2);
  ctx.lineTo(canvas.width / 2 + 40, canvas.height / 2 - 40);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title || 'Film', canvas.width / 2, canvas.height / 2 + 60);

  if (subtitle) {
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 110);
  }

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
  screen.name = 'screenMesh';
  screen.position.z = FRAME_DEPTH / 2 + 0.01;
  group.add(screen);

  const screenLight = new THREE.PointLight(accent === '#ff4444' ? 0xff4444 : 0x64c8ff, 10, 8, 2);
  screenLight.position.set(0, 0, 2.5);
  screenLight.name = 'screenLight';
  group.add(screenLight);

  return { width: w, height: h, screenMesh: screen };
}

// === Aktualizacja tekstury ekranu ===
function updateScreenTexture(group, newTexture, title) {
  const screen = group.getObjectByName('screenMesh');
  if (screen && screen.material) {
    const oldMap = screen.material.map;
    screen.material.map = newTexture;
    screen.material.needsUpdate = true;
    if (oldMap && oldMap.image && oldMap.image.tagName !== 'VIDEO') {
      oldMap.dispose();
    }
  }
  group.userData.title = title || group.userData.title;
}

// === Pobieranie pliku z MEGA (FIX: nowa wersja MEGAJS + downloadBuffer) ===
async function getMegaVideoUrl(megaUrl) {
  try {
    console.log('Pobieranie z MEGA:', megaUrl);

    // FIX: UMD wersja ustawia window.mega
    const mega = window.mega;
    if (typeof mega === 'undefined' || !mega.File) {
      throw new Error('Biblioteka MEGA (megajs) nie jest załadowana. Sprawdź połączenie internetowe i czy skrypt MEGA się wczytał.');
    }

    const file = mega.File.fromURL(megaUrl);
    await file.loadAttributes();
    console.log('MEGA atrybuty załadowane:', file.name, 'rozmiar:', file.size);

    // FIX: użyj downloadBuffer() zamiast ręcznego streamowania
    // W przeglądarce zwraca Uint8Array (nie Node.js Buffer)
    const buffer = await file.downloadBuffer();
    console.log('MEGA plik pobrany, rozmiar:', buffer.byteLength);

    const blob = new Blob([buffer], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);

    console.log('MEGA Blob URL utworzony:', blobUrl);
    return blobUrl;

  } catch (error) {
    console.error('Błąd pobierania z MEGA:', error);
    throw error;
  }
}

// === Tworzenie ekranu z iframe (YouTube, Vimeo, Dailymotion, Twitch) ===
function buildIframeScreen(group, embedUrl, title, maxWidth, maxHeight) {
  createPlaceholderScreen(
    group,
    title || 'Film',
    'Serwis zewnętrzny - niedostępne w VR',
    '#1a1a2e',
    '#64c8ff',
    maxWidth,
    maxHeight
  );

  group.userData.isVideo = false;
  group.userData.isIframe = true;
  group.userData.embedUrl = embedUrl;
  group.userData.title = title || 'Film';

  console.log('Utworzono placeholder dla iframe:', embedUrl);
}

// === Tworzenie ekranu z HLS stream ===
function buildHlsScreen(group, hlsUrl, title, maxWidth, maxHeight) {
  const { screenMesh } = createPlaceholderScreen(
    group,
    title || 'Stream HLS',
    'Ładowanie streamu...',
    '#1a1a2e',
    '#64c8ff',
    maxWidth,
    maxHeight
  );

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  // Obsługa błędów wideo
  video.onerror = (e) => {
    console.error('Błąd elementu <video> (HLS):', video.error);
    let msg = 'Błąd odtwarzania HLS';
    if (video.error) {
      switch (video.error.code) {
        case 1: msg = 'Przerwane pobieranie (NETWORK_EMPTY)'; break;
        case 2: msg = 'Błąd sieci - sprawdź CORS/URL'; break;
        case 3: msg = 'Błąd dekodowania - uszkodzony plik?'; break;
        case 4: msg = 'Format nieobsługiwany'; break;
      }
    }
    showErrorOnScreen(group, msg, title);
  };

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = hlsUrl;
    video.play().catch(e => console.warn('Autoodtwarzanie HLS zablokowane:', e));
  } else if (window.Hls && window.Hls.isSupported()) {
    const hls = new window.Hls();

    // FIX: obsługa błędów HLS.js
    hls.on(window.Hls.Events.ERROR, (event, data) => {
      console.error('Błąd HLS.js:', data);
      if (data.fatal) {
        let msg = 'Błąd HLS';
        switch (data.type) {
          case window.Hls.ErrorTypes.NETWORK_ERROR:
            msg = 'Błąd sieci HLS - sprawdź URL i CORS';
            break;
          case window.Hls.ErrorTypes.MEDIA_ERROR:
            msg = 'Błąd mediów HLS - uszkodzony stream?';
            break;
          default:
            msg = 'Krytyczny błąd HLS';
        }
        showErrorOnScreen(group, msg, title);
      }
    });

    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(e => console.warn('Autoodtwarzanie HLS zablokowane:', e));
    });
    group.userData.hls = hls;
  } else {
    console.error('HLS nie jest obsługiwany w tej przeglądarce');
    showErrorOnScreen(group, 'HLS nieobsługiwany w tej przeglądarce', title);
    return;
  }

  video.onloadedmetadata = () => {
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    updateScreenTexture(group, texture, title);
  };

  group.userData.isVideo = true;
  group.userData.videoElement = video;
  group.userData.title = title || 'Stream HLS';
  group.userData.originalUrl = hlsUrl;
}

// === Tworzenie ekranu z bezpośredniego pliku wideo ===
async function buildVideoScreen(group, videoUrl, title, maxWidth, maxHeight) {
  const { screenMesh } = createPlaceholderScreen(
    group,
    title || 'Film',
    'Ładowanie wideo...',
    '#1a1a2e',
    '#64c8ff',
    maxWidth,
    maxHeight
  );

  let actualVideoUrl = videoUrl;

  if (isMegaUrl(videoUrl)) {
    try {
      actualVideoUrl = await getMegaVideoUrl(videoUrl);
    } catch (error) {
      console.error('Nie udało się pobrać pliku z MEGA:', error);
      showErrorOnScreen(group, 'Błąd pobierania z MEGA: ' + (error.message || 'nieznany'), title);
      group.userData.isVideo = false;
      group.userData.title = (title || 'Film') + ' (BŁĄD MEGA)';
      return;
    }
  }

  const video = document.createElement('video');
  video.src = actualVideoUrl;
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  // FIX: obsługa błędów wideo
  video.onerror = (e) => {
    console.error('Błąd elementu <video>:', video.error, 'src:', actualVideoUrl);
    let msg = 'Błąd ładowania wideo';
    if (video.error) {
      switch (video.error.code) {
        case 1: msg = 'Przerwane pobieranie'; break;
        case 2: msg = 'Błąd sieci (CORS/404/timeout)'; break;
        case 3: msg = 'Błąd dekodowania'; break;
        case 4: msg = 'Format nieobsługiwany'; break;
      }
    }
    showErrorOnScreen(group, msg, title);
  };

  video.play().catch(e => console.warn('Autoodtwarzanie wideo zablokowane:', e));

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;

  video.onloadedmetadata = () => {
    updateScreenTexture(group, texture, title);
  };

  group.userData.isVideo = true;
  group.userData.videoElement = video;
  group.userData.title = title || 'Film';
  group.userData.originalUrl = videoUrl;
}

// === Wyświetlanie błędu na ekranie (Canvas) ===
function showErrorOnScreen(group, message, title) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a0505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚠ Błąd', canvas.width / 2, canvas.height / 2 - 40);

  ctx.fillStyle = '#ff8888';
  ctx.font = '28px sans-serif';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 20);

  ctx.fillStyle = '#888888';
  ctx.font = '24px sans-serif';
  ctx.fillText(title || '', canvas.width / 2, canvas.height / 2 + 70);

  const errorTexture = new THREE.CanvasTexture(canvas);
  errorTexture.colorSpace = THREE.SRGBColorSpace;
  updateScreenTexture(group, errorTexture, (title || 'Film') + ' (BŁĄD)');

  const light = group.getObjectByName('screenLight');
  if (light) {
    light.color.setHex(0xff4444);
  }
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

    if (entry && entry.url && entry.url.trim() !== '') {
      const url = entry.url.trim();
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
        createPlaceholderScreen(group, title || 'Nieznany', 'Nieobsługiwany format URL', '#1a1a2e', '#ffaa00', slot.maxWidth, slot.maxHeight || 5);
        group.userData.isVideo = false;
        group.userData.title = title || 'Nieznany';
      }
    } else {
      // Pusty slot - placeholder
      createPlaceholderScreen(group, 'Brak filmu', 'Dodaj film w panelu zarządzania', '#1a1a2e', '#444444', slot.maxWidth, slot.maxHeight || 5);
      group.userData.isVideo = false;
      group.userData.title = 'Brak filmu';
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

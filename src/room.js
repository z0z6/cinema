import * as THREE from 'three';
import { BOUNDS, DEPTH } from './collision.js';
import { loadFloorMaterial, loadWallMaterial, loadCeilingMaterial } from './textures.js';

export const ROOM_HEIGHT = 5.5;

export function buildRoom(scene) {
  const H = ROOM_HEIGHT;
  const totalWidth = BOUNDS.maxX - BOUNDS.minX;

  const floorMat = loadFloorMaterial(totalWidth / 4, DEPTH / 4);
  const wallMat = loadWallMaterial(totalWidth / 6, H / 3);
  const wallMatSide = loadWallMaterial(DEPTH / 6, H / 3);
  const ceilMat = loadCeilingMaterial(totalWidth / 4, DEPTH / 4);

  // Podłoga
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, DEPTH), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  scene.add(floor);

  // Sufit
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, DEPTH), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);

  // Ściany
  const northWall = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, H), wallMat);
  northWall.position.set(0, H / 2, -DEPTH / 2);
  northWall.name = 'wall';
  northWall.material.side = THREE.DoubleSide;
  scene.add(northWall);

  const southWall = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, H), wallMat.clone());
  southWall.position.set(0, H / 2, DEPTH / 2);
  southWall.rotation.y = Math.PI;
  southWall.name = 'wall';
  southWall.material.side = THREE.DoubleSide;
  scene.add(southWall);

  const westWall = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, H), wallMatSide);
  westWall.position.set(BOUNDS.minX, H / 2, 0);
  westWall.rotation.y = Math.PI / 2;
  westWall.name = 'wall';
  westWall.material.side = THREE.DoubleSide;
  scene.add(westWall);

  const eastWall = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, H), wallMatSide.clone());
  eastWall.position.set(BOUNDS.maxX, H / 2, 0);
  eastWall.rotation.y = -Math.PI / 2;
  eastWall.name = 'wall';
  eastWall.material.side = THREE.DoubleSide;
  scene.add(eastWall);

  // KINOWE OŚWIETLENIE - bardzo niskie ambient
  scene.add(new THREE.AmbientLight(0xffffff, 0.15)); // Bardzo ciemno
  
  // Delikatne światło skupione na środku (gdzie stoi obserwator)
  const spotCenter = new THREE.SpotLight(0xfff5e6, 8, 12, Math.PI / 6, 0.6, 1.5);
  spotCenter.position.set(0, H - 0.2, 0);
  spotCenter.target.position.set(0, 0, 0);
  scene.add(spotCenter, spotCenter.target);

  // Światła akcentowe przy ekranach (subtelne)
  for (const zOff of [-DEPTH / 2 + 1, DEPTH / 2 - 1]) {
    const accent = new THREE.PointLight(0xfff5e6, 5, 6, 2);
    accent.position.set(0, H - 1, zOff);
    scene.add(accent);
  }

  return { floorMesh: floor };
}

// Dwa duże sloty na przeciwległych ścianach
export function generateWallSlots() {
  const slots = [];
  const margin = 0.1;
  const eyeY = 2.2;
  
  // Północna ściana - duży ekran
  slots.push({ pos: [0, eyeY, -DEPTH / 2 + margin], rotY: 0, maxWidth: 10, maxHeight: 5 });
  // Południowa ściana - duży ekran
  slots.push({ pos: [0, eyeY, DEPTH / 2 - margin], rotY: Math.PI, maxWidth: 10, maxHeight: 5 });

  return slots;
}

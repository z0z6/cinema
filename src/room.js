import * as THREE from 'three';
import { BOUNDS, DEPTH } from './collision.js';
import { loadFloorMaterial, loadWallMaterial, loadCeilingMaterial, loadRugMaterial } from './textures.js';

export const ROOM_HEIGHT = 5.5;

export function buildRoom(scene) {
  const H = ROOM_HEIGHT;
  const totalWidth = BOUNDS.maxX - BOUNDS.minX;

  const floorMat = loadFloorMaterial(totalWidth / 4, DEPTH / 4);
  const wallMat = loadWallMaterial(totalWidth / 6, H / 3);
  const wallMatSide = loadWallMaterial(DEPTH / 6, H / 3);
  const ceilMat = loadCeilingMaterial(totalWidth / 4, DEPTH / 4);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, DEPTH), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, DEPTH), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);

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

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a42, 0.55));

  const spot = new THREE.SpotLight(0xffffff, 85, 16, Math.PI / 4, 0.45, 1.4);
  spot.position.set(0, H - 0.1, 0);
  spot.target.position.set(0, 0, 0);
  scene.add(spot, spot.target);

  for (const zOff of [-DEPTH / 3.2, DEPTH / 3.2]) {
    const fill = new THREE.PointLight(0xfff6ea, 12, 9, 2);
    fill.position.set(0, H - 1.2, zOff);
    scene.add(fill);
  }

  const rugMat = loadRugMaterial(4, 3);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth * 0.6, DEPTH * 0.6), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.02, 0);
  scene.add(rug);

  return { floorMesh: floor };
}

export function generateWallSlots() {
  const slots = [];
  const margin = 0.1;
  const eyeY = 2.2; 
  
  // Północna ściana
  slots.push({ pos: [0, eyeY, -DEPTH / 2 + margin], rotY: 0, maxWidth: 10, maxHeight: 5 });
  // Południowa ściana
  slots.push({ pos: [0, eyeY, DEPTH / 2 - margin], rotY: Math.PI, maxWidth: 10, maxHeight: 5 });

  return slots;
}

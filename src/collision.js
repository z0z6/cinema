export const DEPTH = 16;
export const ROOM_WIDTHS = [24]; // Jedna duża sala główna
export const DOOR_HALF_WIDTH = 0;
export const WALL_THICKNESS = 0;

const totalWidth = ROOM_WIDTHS.reduce((a, b) => a + b, 0);

export const ROOMS = (() => {
  let x = -totalWidth / 2;
  return ROOM_WIDTHS.map((w) => {
    const room = { minX: x, maxX: x + w };
    x += w;
    return room;
  });
})();

export const BOUNDS = {
  minX: -totalWidth / 2,
  maxX: totalWidth / 2,
  minZ: -DEPTH / 2,
  maxZ: DEPTH / 2,
};

export const PARTITIONS = []; // Brak ścian działowych
export const OBSTACLES = [];

export function resolveCollision(pos, radius = 0.5, margin = 0.5) {
  pos.x = Math.max(BOUNDS.minX + margin, Math.min(BOUNDS.maxX - margin, pos.x));
  pos.z = Math.max(BOUNDS.minZ + margin, Math.min(BOUNDS.maxZ - margin, pos.z));

  for (const obs of OBSTACLES) {
    if (obs.radius !== undefined) {
      const dx = pos.x - obs.x, dz = pos.z - obs.z;
      const dist = Math.hypot(dx, dz);
      const minDist = obs.radius + radius;
      if (dist < minDist && dist > 0.0001) {
        const push = minDist / dist;
        pos.x = obs.x + dx * push;
        pos.z = obs.z + dz * push;
      }
    } else {
      const rx0 = obs.minX - radius, rx1 = obs.maxX + radius;
      const rz0 = obs.minZ - radius, rz1 = obs.maxZ + radius;
      if (pos.x > rx0 && pos.x < rx1 && pos.z > rz0 && pos.z < rz1) {
        const dL = pos.x - rx0, dR = rx1 - pos.x, dT = pos.z - rz0, dB = rz1 - pos.z;
        const m = Math.min(dL, dR, dT, dB);
        if (m === dL) pos.x = rx0; else if (m === dR) pos.x = rx1;
        else if (m === dT) pos.z = rz0; else pos.z = rz1;
      }
    }
  }
  return pos;
}

export function crossesSolidWall(from, to, radius = 0.45) {
  return false; // Brak ścian działowych do przecięcia
}

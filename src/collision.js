// Minimalny plik kolizji - tylko dla kompatybilności
// W statycznym VR nie są potrzebne kolizje

export const DEPTH = 16;
export const ROOM_WIDTHS = [24];
export const BOUNDS = {
  minX: -12,
  maxX: 12,
  minZ: -8,
  maxZ: 8,
};

export function resolveCollision(pos, radius = 0.5, margin = 0.5) {
  // Statyczny obserwator - brak kolizji
  return pos;
}

export function crossesSolidWall(from, to, radius = 0.45) {
  return false;
}

export const OSM_TILE_URL = (
  process.env.EXPO_PUBLIC_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
).trim();

export const OSM_ATTRIBUTION = 'OpenStreetMap contributors';

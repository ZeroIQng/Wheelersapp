/**
 * Shared geo helpers — the same haversine the backend uses to pick nearby
 * drivers, and the same ~24 km/h city-driving ETA assumption, so every screen
 * and the backend quote consistent numbers for the same distance.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

/** Rough city-driving ETA (~24 km/h average) — an estimate, never below 1 min. */
export function estimateEtaMinutes(km: number): number {
  return Math.max(1, Math.round(km * 2.5));
}

/** Same assumption in seconds, for wire payloads. Never below one minute. */
export function estimateEtaSeconds(km: number): number {
  return Math.max(60, Math.round(km * 150));
}

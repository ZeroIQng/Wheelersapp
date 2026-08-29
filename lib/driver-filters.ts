/**
 * Driver request filters: which jobs are worth ringing the phone for.
 * At five drivers nothing needs filtering; at two hundred, every phone near
 * Ikeja ringing for every ₦3,000 ride is how drivers mute the app entirely.
 * Client-side v1 — offers still arrive, the feed keeps them out of sight.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DriverFilters = {
  /** Hide requests offering less than this. null = show everything. */
  minFareNgn: number | null;
  /** Hide requests whose pickup is farther than this. null = any distance. */
  maxPickupKm: number | null;
};

export const MIN_FARE_STEPS: (number | null)[] = [null, 3000, 4000, 5000, 7000];
export const MAX_PICKUP_STEPS: (number | null)[] = [null, 2, 5, 10];

const STORAGE_KEY = 'wheelers.driver.requestFilters';

let current: DriverFilters = { minFareNgn: null, maxPickupKm: null };
const listeners = new Set<(filters: DriverFilters) => void>();
let loaded = false;

export function getDriverFilters(): DriverFilters {
  return current;
}

export async function loadDriverFilters(): Promise<DriverFilters> {
  if (!loaded) {
    loaded = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) current = { ...current, ...JSON.parse(raw) };
    } catch {
      // defaults stand
    }
  }
  return current;
}

export function setDriverFilters(next: Partial<DriverFilters>): DriverFilters {
  current = { ...current, ...next };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  listeners.forEach((listener) => listener(current));
  return current;
}

export function subscribeDriverFilters(listener: (filters: DriverFilters) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function nextStep<T>(steps: readonly T[], value: T): T {
  const index = steps.findIndex((step) => step === value);
  return steps[(index + 1) % steps.length] as T;
}

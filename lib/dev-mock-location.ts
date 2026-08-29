/**
 * Dev-only fake GPS.
 *
 * The iOS Simulator and Android emulator sit in Cupertino by default, so a
 * Lagos ride-hailing app running on them finds no drivers, geocodes pickups to
 * California and never matches. This pins the device to a Lagos preset so the
 * whole booking flow can be exercised without a real phone on the road.
 *
 * Compiled out of production: every entry point checks `__DEV__`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MockLocationPreset = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  address: string;
};

/** Spots in Lagos far enough apart to make a real trip, close enough to match. */
export const MOCK_LOCATION_PRESETS: MockLocationPreset[] = [
  { id: 'opebi', label: 'Opebi, Ikeja', lat: 6.6018, lng: 3.3515, address: '102 Opebi Rd, Opebi, Ikeja, Lagos' },
  { id: 'allen', label: 'Allen Avenue, Ikeja', lat: 6.5987, lng: 3.3552, address: 'Allen Ave, Ikeja, Lagos' },
  { id: 'maryland', label: 'Maryland Mall', lat: 6.5679, lng: 3.3672, address: 'Maryland Mall, Ikorodu Rd, Lagos' },
  { id: 'yaba', label: 'Yaba', lat: 6.5158, lng: 3.3786, address: 'Herbert Macaulay Way, Yaba, Lagos' },
  { id: 'surulere', label: 'Surulere', lat: 6.4969, lng: 3.3556, address: '15 Aiyetoro St, Surulere, Lagos' },
  { id: 'vi', label: 'Victoria Island', lat: 6.4281, lng: 3.4219, address: 'Adeola Odeku St, Victoria Island, Lagos' },
  { id: 'lekki', label: 'Lekki Phase 1', lat: 6.4474, lng: 3.4738, address: 'Admiralty Way, Lekki Phase 1, Lagos' },
];

const STORAGE_KEY = 'wheelers.dev.mockLocationPreset';

export function isMockLocationAvailable(): boolean {
  return __DEV__;
}

export async function loadMockLocationPreset(): Promise<MockLocationPreset | null> {
  if (!__DEV__) return null;
  try {
    const id = await AsyncStorage.getItem(STORAGE_KEY);
    return MOCK_LOCATION_PRESETS.find((preset) => preset.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function saveMockLocationPreset(preset: MockLocationPreset | null): Promise<void> {
  if (!__DEV__) return;
  try {
    if (preset) await AsyncStorage.setItem(STORAGE_KEY, preset.id);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}

/** Off → preset 1 → preset 2 → … → Off. */
export function nextMockLocationPreset(current: MockLocationPreset | null): MockLocationPreset | null {
  if (!current) return MOCK_LOCATION_PRESETS[0] ?? null;
  const index = MOCK_LOCATION_PRESETS.findIndex((preset) => preset.id === current.id);
  return MOCK_LOCATION_PRESETS[index + 1] ?? null;
}

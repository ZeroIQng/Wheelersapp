import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PlaceSuggestion } from "@/lib/google-places";

const PLACE_SEARCH_HISTORY_KEY = "wheelers.place-search.history";
const MAX_RECENT_PLACE_SEARCHES = 8;

function isPlaceIcon(value: unknown): value is PlaceSuggestion["icon"] {
  return (
    value === "location-on" ||
    value === "storefront" ||
    value === "flight" ||
    value === "history"
  );
}

function normalizeStoredPlaceSuggestion(
  value: unknown,
): PlaceSuggestion | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PlaceSuggestion>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.subtitle !== "string" ||
    typeof candidate.address !== "string" ||
    !isPlaceIcon(candidate.icon)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    title: candidate.title,
    subtitle: candidate.subtitle,
    address: candidate.address,
    icon: candidate.icon,
  };
}

function getPlaceIdentity(place: PlaceSuggestion): string {
  return place.address.trim().toLowerCase();
}

export async function readRecentPlaceSearches(): Promise<PlaceSuggestion[]> {
  try {
    const raw = await AsyncStorage.getItem(PLACE_SEARCH_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeStoredPlaceSuggestion(item))
      .filter((item): item is PlaceSuggestion => item != null)
      .slice(0, MAX_RECENT_PLACE_SEARCHES);
  } catch {
    return [];
  }
}

export async function saveRecentPlaceSearch(
  place: PlaceSuggestion,
): Promise<PlaceSuggestion[]> {
  const current = await readRecentPlaceSearches();
  const next = [
    place,
    ...current.filter((item) => getPlaceIdentity(item) !== getPlaceIdentity(place)),
  ].slice(0, MAX_RECENT_PLACE_SEARCHES);

  await AsyncStorage.setItem(PLACE_SEARCH_HISTORY_KEY, JSON.stringify(next));

  return next;
}

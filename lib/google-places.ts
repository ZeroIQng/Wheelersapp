import Constants from "expo-constants";

export const googleMapsApiKeyEnvVar = "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY";

export type PlaceSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  icon: "location-on" | "storefront" | "flight" | "history";
  address: string;
};

export type ResolvedPlace = {
  lat: number;
  lng: number;
  address: string;
};

type GoogleAutocompletePrediction = {
  description?: string;
  place_id?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  types?: string[];
};

type GoogleAutocompleteResponse = {
  status?: string;
  predictions?: GoogleAutocompletePrediction[];
  error_message?: string;
};

type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  address_components?: GoogleAddressComponent[];
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: GoogleGeocodeResult[];
  error_message?: string;
};

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  (typeof Constants.expoConfig?.extra?.googleMapsApiKey === "string"
    ? Constants.expoConfig.extra.googleMapsApiKey.trim()
    : undefined);
const lagosCenter = {
  lat: 6.5244,
  lng: 3.3792,
};
const lagosBounds = {
  southWest: {
    lat: 6.23,
    lng: 3.0,
  },
  northEast: {
    lat: 6.7,
    lng: 3.7,
  },
};

function getGoogleMapsApiKey(): string {
  if (!googleMapsApiKey) {
    throw new Error(`Set ${googleMapsApiKeyEnvVar} to use Google Maps.`);
  }

  return googleMapsApiKey;
}

function cleanPart(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function joinUnique(parts: (string | null)[]): string[] {
  const seen = new Set<string>();

  return parts.filter((part): part is string => {
    if (!part) {
      return false;
    }

    const normalized = part.toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function buildContextualQuery(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.toLowerCase();
  if (normalized.includes("lagos") && normalized.includes("nigeria")) {
    return trimmed;
  }

  if (normalized.includes("lagos")) {
    return `${trimmed}, Nigeria`;
  }

  return `${trimmed}, Lagos, Nigeria`;
}

function splitDescription(description: string | undefined): {
  title: string;
  subtitle: string;
} {
  const normalized = cleanPart(description) ?? "";
  if (!normalized) {
    return {
      title: "",
      subtitle: "",
    };
  }

  const [title, ...rest] = normalized.split(",").map((part) => part.trim());

  return {
    title: title ?? normalized,
    subtitle: rest.join(", "),
  };
}

function mapGoogleTypesToIcon(types: string[] | undefined): PlaceSuggestion["icon"] {
  const normalizedTypes = types ?? [];

  if (
    normalizedTypes.includes("airport") ||
    normalizedTypes.includes("transit_station")
  ) {
    return "flight";
  }

  if (
    normalizedTypes.includes("shopping_mall") ||
    normalizedTypes.includes("store") ||
    normalizedTypes.includes("supermarket") ||
    normalizedTypes.includes("restaurant") ||
    normalizedTypes.includes("cafe")
  ) {
    return "storefront";
  }

  return "location-on";
}

function mapPredictionToSuggestion(
  prediction: GoogleAutocompletePrediction,
): PlaceSuggestion | null {
  const placeId = cleanPart(prediction.place_id);
  const description = cleanPart(prediction.description);

  if (!placeId || !description) {
    return null;
  }

  const mainText = cleanPart(prediction.structured_formatting?.main_text);
  const secondaryText = cleanPart(prediction.structured_formatting?.secondary_text);
  const fallback = splitDescription(description);
  const title = mainText ?? fallback.title;
  const subtitle = secondaryText ?? fallback.subtitle;

  return {
    id: placeId,
    title,
    subtitle,
    icon: mapGoogleTypesToIcon(prediction.types),
    address: description,
  };
}

function hasAddressType(
  result: GoogleGeocodeResult,
  expectedType: string,
  matchValue?: string,
): boolean {
  return (result.address_components ?? []).some((component) => {
    if (!(component.types ?? []).includes(expectedType)) {
      return false;
    }

    if (!matchValue) {
      return true;
    }

    const normalizedMatch = matchValue.toLowerCase();
    return (
      component.long_name?.toLowerCase() === normalizedMatch ||
      component.short_name?.toLowerCase() === normalizedMatch
    );
  });
}

function isGoogleResultInNigeria(result: GoogleGeocodeResult): boolean {
  return hasAddressType(result, "country", "ng") || hasAddressType(result, "country", "nigeria");
}

function scoreGeocodeResult(result: GoogleGeocodeResult): number {
  let score = 0;

  if (hasAddressType(result, "street_address")) score += 8;
  if (hasAddressType(result, "premise")) score += 6;
  if (hasAddressType(result, "subpremise")) score += 4;
  if (hasAddressType(result, "route")) score += 3;
  if (hasAddressType(result, "neighborhood")) score += 2;
  if (hasAddressType(result, "locality", "lagos")) score += 5;
  if (hasAddressType(result, "administrative_area_level_1", "lagos")) score += 5;
  if (cleanPart(result.formatted_address)?.toLowerCase().includes("lagos")) score += 3;

  return score;
}

async function fetchGoogleAutocompletePredictions(
  query: string,
): Promise<GoogleAutocompletePrediction[]> {
  const params = new URLSearchParams({
    input: query,
    key: getGoogleMapsApiKey(),
    language: "en",
    components: "country:ng",
    location: `${lagosCenter.lat},${lagosCenter.lng}`,
    radius: "45000",
    strictbounds: "true",
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
  );
  const data = (await response.json()) as GoogleAutocompleteResponse;

  if (!response.ok) {
    throw new Error(`google_places_failed:${response.status}`);
  }

  if (data.status === "OK") {
    return data.predictions ?? [];
  }

  if (data.status === "ZERO_RESULTS") {
    return [];
  }

  throw new Error(data.error_message ?? `google_places_failed:${data.status ?? "unknown"}`);
}

async function fetchGoogleGeocodeResults(query: string): Promise<GoogleGeocodeResult[]> {
  const params = new URLSearchParams({
    address: query,
    key: getGoogleMapsApiKey(),
    language: "en",
    region: "ng",
    components: "country:NG",
    bounds: `${lagosBounds.southWest.lat},${lagosBounds.southWest.lng}|${lagosBounds.northEast.lat},${lagosBounds.northEast.lng}`,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
  );
  const data = (await response.json()) as GoogleGeocodeResponse;

  if (!response.ok) {
    throw new Error(`google_geocode_failed:${response.status}`);
  }

  if (data.status === "OK") {
    return data.results ?? [];
  }

  if (data.status === "ZERO_RESULTS") {
    return [];
  }

  throw new Error(data.error_message ?? `google_geocode_failed:${data.status ?? "unknown"}`);
}

function mapGeocodeResultToResolvedPlace(result: GoogleGeocodeResult): ResolvedPlace | null {
  const lat = result.geometry?.location?.lat;
  const lng = result.geometry?.location?.lng;
  const address = cleanPart(result.formatted_address);

  if (typeof lat !== "number" || typeof lng !== "number" || !address) {
    return null;
  }

  return {
    lat,
    lng,
    address,
  };
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(googleMapsApiKey);
}

export async function fetchGooglePlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    return [];
  }

  const contextualQuery = buildContextualQuery(normalizedInput);
  const predictions = await fetchGoogleAutocompletePredictions(contextualQuery);

  return predictions
    .map(mapPredictionToSuggestion)
    .filter((item): item is PlaceSuggestion => item != null)
    .filter((item, index, items) => {
      const key = `${item.title.toLowerCase()}|${item.address.toLowerCase()}`;
      return (
        items.findIndex((candidate) => {
          const candidateKey = `${candidate.title.toLowerCase()}|${candidate.address.toLowerCase()}`;
          return candidateKey === key;
        }) === index
      );
    })
    .slice(0, 8);
}

export async function resolvePlaceQuery(input: string): Promise<ResolvedPlace> {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    throw new Error("A destination is required before requesting a ride.");
  }

  const queries = joinUnique([buildContextualQuery(normalizedInput), normalizedInput]);

  for (const query of queries) {
    const results = await fetchGoogleGeocodeResults(query);
    const resolved = results
      .filter(isGoogleResultInNigeria)
      .sort((left, right) => scoreGeocodeResult(right) - scoreGeocodeResult(left))
      .map(mapGeocodeResultToResolvedPlace)
      .find((item): item is ResolvedPlace => item != null);

    if (resolved) {
      return resolved;
    }
  }

  throw new Error(`Could not resolve location with Google Maps: ${input}`);
}

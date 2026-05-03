export type PlaceSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  icon: 'location-on' | 'storefront' | 'flight' | 'history';
  lat: number;
  lng: number;
  address: string;
};

export type ResolvedPlace = Pick<PlaceSuggestion, 'lat' | 'lng' | 'address'>;

const lagosBbox = '3.0,6.23,3.7,6.7';
const lagosCenter = {
  lat: '6.5244',
  lon: '3.3792',
};

type PhotonFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    osm_id?: number | string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    suburb?: string;
    county?: string;
    state_district?: string;
    locality?: string;
    postcode?: string;
    state?: string;
    country?: string;
    osm_value?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

const staticPlaces: Record<string, ResolvedPlace> = {
  'current location • lekki phase 1': {
    lat: 6.4473,
    lng: 3.4729,
    address: 'Lekki Phase 1, Lagos, Nigeria',
  },
  'lekki phase 1': {
    lat: 6.4473,
    lng: 3.4729,
    address: 'Lekki Phase 1, Lagos, Nigeria',
  },
  'civic centre': {
    lat: 6.4281,
    lng: 3.4219,
    address: 'Civic Centre, Ozumba Mbadiwe Avenue, Victoria Island, Lagos, Nigeria',
  },
  'civic centre, victoria island': {
    lat: 6.4281,
    lng: 3.4219,
    address: 'Civic Centre, Ozumba Mbadiwe Avenue, Victoria Island, Lagos, Nigeria',
  },
  'the palms mall': {
    lat: 6.4334,
    lng: 3.4586,
    address: 'The Palms Mall, Bisway Street, Lekki, Lagos, Nigeria',
  },
  'murtala muhammed international airport': {
    lat: 6.5774,
    lng: 3.3212,
    address: 'Murtala Muhammed International Airport, Ikeja, Lagos, Nigeria',
  },
  'lekki toll gate': {
    lat: 6.4448,
    lng: 3.4875,
    address: 'Lekki Toll Gate, Lekki-Epe Expressway, Lagos, Nigeria',
  },
  'obalende bus stop': {
    lat: 6.4395,
    lng: 3.4156,
    address: 'Obalende Bus Stop, Eti-Osa, Lagos, Nigeria',
  },
};

function mapPhotonValueToIcon(value: string | undefined): PlaceSuggestion['icon'] {
  if (!value) {
    return 'location-on';
  }

  if (value.includes('airport')) {
    return 'flight';
  }

  if (
    value.includes('mall') ||
    value.includes('shop') ||
    value.includes('store') ||
    value.includes('supermarket')
  ) {
    return 'storefront';
  }

  return 'location-on';
}

function cleanPart(value: string | undefined): string | null {
  if (typeof value !== 'string') {
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

function buildStreetLine(feature: PhotonFeature): string | null {
  const properties = feature.properties;
  const houseNumber = cleanPart(properties?.housenumber);
  const street = cleanPart(properties?.street);

  if (!houseNumber && !street) {
    return null;
  }

  return [houseNumber, street].filter(Boolean).join(' ');
}

function buildTitle(feature: PhotonFeature): string | null {
  const properties = feature.properties;
  const name = cleanPart(properties?.name);
  const streetLine = buildStreetLine(feature);

  if (name && streetLine && name.toLowerCase() === streetLine.toLowerCase()) {
    return streetLine;
  }

  return name ?? streetLine;
}

function buildSubtitle(feature: PhotonFeature): string {
  const properties = feature.properties;
  const streetLine = buildStreetLine(feature);

  return joinUnique([
    streetLine,
    cleanPart(properties?.suburb),
    cleanPart(properties?.district),
    cleanPart(properties?.locality),
    cleanPart(properties?.city),
    cleanPart(properties?.state_district),
    cleanPart(properties?.state),
    cleanPart(properties?.postcode),
    cleanPart(properties?.country),
  ]).join(', ');
}

function buildAddress(title: string, subtitle: string): string {
  return subtitle ? `${title}, ${subtitle}` : title;
}

function normalizeQuery(input: string): string {
  return input.trim().toLowerCase();
}

function findStaticPlace(input: string): ResolvedPlace | null {
  const normalized = normalizeQuery(input);
  return staticPlaces[normalized] ?? null;
}

function isLagosFeature(feature: PhotonFeature): boolean {
  const properties = feature.properties;
  const country = cleanPart(properties?.country)?.toLowerCase();
  if (country !== 'nigeria') {
    return false;
  }

  const locationParts = [
    properties?.city,
    properties?.state,
    properties?.district,
    properties?.suburb,
    properties?.county,
    properties?.state_district,
    properties?.locality,
  ]
    .map((value) => cleanPart(value)?.toLowerCase())
    .filter((value): value is string => Boolean(value));

  return locationParts.some((value) => value.includes('lagos'));
}

function detailScore(feature: PhotonFeature): number {
  const properties = feature.properties;
  let score = 0;

  if (cleanPart(properties?.housenumber)) score += 4;
  if (cleanPart(properties?.street)) score += 3;
  if (cleanPart(properties?.suburb) || cleanPart(properties?.district)) score += 2;
  if (cleanPart(properties?.city)) score += 1;

  return score;
}

async function fetchPhotonSuggestions(query: string): Promise<PhotonResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: '8',
    lang: 'en',
    bbox: lagosBbox,
    lat: lagosCenter.lat,
    lon: lagosCenter.lon,
    osm_tag: '!boundary',
  });

  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`osm_places_failed:${response.status}`);
  }

  return (await response.json()) as PhotonResponse;
}

export function isOsmPlacesConfigured(): boolean {
  return true;
}

export async function fetchOsmPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const normalizedInput = input.trim();
  const primaryData = await fetchPhotonSuggestions(`${normalizedInput}, Lagos, Nigeria`);
  const fallbackData =
    (primaryData.features?.length ?? 0) > 0
      ? null
      : await fetchPhotonSuggestions(normalizedInput);

  return (fallbackData?.features ?? primaryData.features ?? [])
    .filter((feature) => isLagosFeature(feature))
    .sort((left, right) => detailScore(right) - detailScore(left))
    .map((feature) => {
      const title = buildTitle(feature) ?? '';
      const id = String(feature.properties?.osm_id ?? '').trim();
      const coordinates = feature.geometry?.coordinates;
      const lng = coordinates?.[0];
      const lat = coordinates?.[1];

      if (!title || !id || typeof lat !== 'number' || typeof lng !== 'number') {
        return null;
      }

      const subtitle = buildSubtitle(feature);

      return {
        id,
        title,
        subtitle,
        icon: mapPhotonValueToIcon(feature.properties?.osm_value),
        lat,
        lng,
        address: buildAddress(title, subtitle),
      } satisfies PlaceSuggestion;
    })
    .filter((item): item is PlaceSuggestion => item != null)
    .filter((item, index, items) => {
      const key = `${item.title.toLowerCase()}|${item.address.toLowerCase()}`;
      return items.findIndex((candidate) => {
        const candidateKey = `${candidate.title.toLowerCase()}|${candidate.address.toLowerCase()}`;
        return candidateKey === key;
      }) === index;
    });
}

export async function resolvePlaceQuery(input: string): Promise<ResolvedPlace> {
  const staticPlace = findStaticPlace(input);
  if (staticPlace) {
    return staticPlace;
  }

  const suggestions = await fetchOsmPlaceSuggestions(input);
  const firstMatch = suggestions[0];

  if (!firstMatch) {
    throw new Error(`Could not resolve location: ${input}`);
  }

  return {
    lat: firstMatch.lat,
    lng: firstMatch.lng,
    address: firstMatch.address,
  };
}

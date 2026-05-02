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

const nigeriaBbox = '2.668,4.24,14.678,13.892';

type PhotonFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    osm_id?: number | string;
    name?: string;
    street?: string;
    city?: string;
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

function buildSubtitle(feature: PhotonFeature): string {
  const properties = feature.properties;

  return [
    properties?.street,
    properties?.city,
    properties?.state,
    properties?.country,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');
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

export function isOsmPlacesConfigured(): boolean {
  return true;
}

export async function fetchOsmPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({
    q: `${input}, Nigeria`,
    limit: '6',
    lang: 'en',
    bbox: nigeriaBbox,
    osm_tag: '!boundary',
  });

  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`osm_places_failed:${response.status}`);
  }

  const data = (await response.json()) as PhotonResponse;

  return (data.features ?? [])
    .filter((feature) => {
      const country = feature.properties?.country?.trim().toLowerCase();
      return country === 'nigeria';
    })
    .map((feature) => {
      const title = feature.properties?.name?.trim() ?? '';
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
    .filter((item): item is PlaceSuggestion => item != null);
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

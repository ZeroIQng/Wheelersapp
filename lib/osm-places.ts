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
const lagosViewbox = '3.0,6.7,3.7,6.23';
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

type NominatimPlace = {
  place_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
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

function tokenizeQuery(input: string): string[] {
  return normalizeQuery(input)
    .replace(/[^a-z0-9\s,]/g, ' ')
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function buildContextualQuery(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.toLowerCase();
  if (normalized.includes('lagos') && normalized.includes('nigeria')) {
    return trimmed;
  }

  if (normalized.includes('lagos')) {
    return `${trimmed}, Nigeria`;
  }

  return `${trimmed}, Lagos, Nigeria`;
}

function shouldPreferStreetLevelResults(input: string): boolean {
  return (
    /\d/.test(input) ||
    input.includes(',') ||
    /\b(street|st|road|rd|avenue|ave|close|crescent|lane|drive|way)\b/i.test(input)
  );
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

function detailScoreForNominatim(place: NominatimPlace): number {
  const address = place.address;
  let score = 0;

  if (cleanPart(address?.house_number)) score += 4;
  if (cleanPart(address?.road)) score += 3;
  if (cleanPart(address?.suburb) || cleanPart(address?.city_district)) score += 2;
  if (cleanPart(address?.city)) score += 1;

  return score;
}

function queryMatchScore(input: string, title: string, subtitle: string): number {
  const haystack = `${title} ${subtitle}`.toLowerCase();
  const query = normalizeQuery(input);
  const tokens = tokenizeQuery(input);

  let score = haystack.includes(query) ? 6 : 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

async function fetchPhotonSuggestions(query: string): Promise<PhotonResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: '12',
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

async function fetchNominatimSuggestions(query: string): Promise<NominatimPlace[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '8',
    countrycodes: 'ng',
    bounded: '1',
    viewbox: lagosViewbox,
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`osm_places_failed:${response.status}`);
  }

  return (await response.json()) as NominatimPlace[];
}

function isLagosNominatimPlace(place: NominatimPlace): boolean {
  const address = place.address;
  const country = cleanPart(address?.country)?.toLowerCase();
  if (country !== 'nigeria') {
    return false;
  }

  const locationParts = [
    address?.city,
    address?.state,
    address?.suburb,
    address?.city_district,
    address?.neighbourhood,
  ]
    .map((value) => cleanPart(value)?.toLowerCase())
    .filter((value): value is string => Boolean(value));

  return locationParts.some((value) => value.includes('lagos'));
}

function buildNominatimTitle(place: NominatimPlace): string | null {
  const address = place.address;
  const streetLine = [cleanPart(address?.house_number), cleanPart(address?.road)]
    .filter(Boolean)
    .join(' ');
  const name = cleanPart(place.name);

  if (streetLine && name && name.toLowerCase() === streetLine.toLowerCase()) {
    return streetLine;
  }

  return name ?? streetLine ?? cleanPart(place.display_name);
}

function buildNominatimSubtitle(place: NominatimPlace): string {
  const address = place.address;
  const streetLine = [cleanPart(address?.house_number), cleanPart(address?.road)]
    .filter(Boolean)
    .join(' ');

  return joinUnique([
    streetLine || null,
    cleanPart(address?.suburb),
    cleanPart(address?.neighbourhood),
    cleanPart(address?.city_district),
    cleanPart(address?.city),
    cleanPart(address?.state),
    cleanPart(address?.postcode),
    cleanPart(address?.country),
  ]).join(', ');
}

function mapNominatimValueToIcon(place: NominatimPlace): PlaceSuggestion['icon'] {
  const type = cleanPart(place.type)?.toLowerCase() ?? '';

  if (type.includes('airport') || type.includes('aerodrome')) {
    return 'flight';
  }

  if (
    type.includes('mall') ||
    type.includes('shop') ||
    type.includes('supermarket') ||
    type.includes('market')
  ) {
    return 'storefront';
  }

  return 'location-on';
}

type RankedSuggestion = PlaceSuggestion & {
  score: number;
};

function mapPhotonFeatureToSuggestion(
  feature: PhotonFeature,
  input: string,
): RankedSuggestion | null {
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
    id: `photon:${id}`,
    title,
    subtitle,
    icon: mapPhotonValueToIcon(feature.properties?.osm_value),
    lat,
    lng,
    address: buildAddress(title, subtitle),
    score: detailScore(feature) + queryMatchScore(input, title, subtitle),
  };
}

function mapNominatimPlaceToSuggestion(
  place: NominatimPlace,
  input: string,
): RankedSuggestion | null {
  const title = buildNominatimTitle(place);
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  const id = String(place.place_id ?? '').trim();

  if (!title || !id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const subtitle = buildNominatimSubtitle(place);

  return {
    id: `nominatim:${id}`,
    title,
    subtitle,
    icon: mapNominatimValueToIcon(place),
    lat,
    lng,
    address: buildAddress(title, subtitle),
    score: detailScoreForNominatim(place) + queryMatchScore(input, title, subtitle) + 2,
  };
}

export function isOsmPlacesConfigured(): boolean {
  return true;
}

export async function fetchOsmPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const normalizedInput = input.trim();
  const contextualQuery = buildContextualQuery(normalizedInput);
  const shouldUseStreetLookup = shouldPreferStreetLevelResults(normalizedInput);

  const [streetLevelResult, photonPrimaryResult, photonFallbackResult] =
    await Promise.allSettled([
      shouldUseStreetLookup
        ? fetchNominatimSuggestions(contextualQuery)
        : Promise.resolve([] as NominatimPlace[]),
      fetchPhotonSuggestions(contextualQuery),
      contextualQuery === normalizedInput
        ? Promise.resolve(null as PhotonResponse | null)
        : fetchPhotonSuggestions(normalizedInput),
    ]);

  const rankedSuggestions: RankedSuggestion[] = [];

  if (streetLevelResult.status === 'fulfilled') {
    rankedSuggestions.push(
      ...streetLevelResult.value
        .filter((place) => isLagosNominatimPlace(place))
        .map((place) => mapNominatimPlaceToSuggestion(place, normalizedInput))
        .filter((item): item is RankedSuggestion => item != null),
    );
  }

  if (photonPrimaryResult.status === 'fulfilled') {
    rankedSuggestions.push(
      ...((photonPrimaryResult.value.features ?? [])
        .filter((feature) => isLagosFeature(feature))
        .map((feature) => mapPhotonFeatureToSuggestion(feature, normalizedInput))
        .filter((item): item is RankedSuggestion => item != null)),
    );
  }

  if (
    photonFallbackResult.status === 'fulfilled' &&
    photonFallbackResult.value != null
  ) {
    rankedSuggestions.push(
      ...((photonFallbackResult.value.features ?? [])
        .filter((feature) => isLagosFeature(feature))
        .map((feature) => mapPhotonFeatureToSuggestion(feature, normalizedInput))
        .filter((item): item is RankedSuggestion => item != null)),
    );
  }

  return rankedSuggestions
    .sort((left, right) => right.score - left.score)
    .filter((item, index, items) => {
      const key = `${item.title.toLowerCase()}|${item.address.toLowerCase()}`;
      return (
        items.findIndex((candidate) => {
          const candidateKey = `${candidate.title.toLowerCase()}|${candidate.address.toLowerCase()}`;
          return candidateKey === key;
        }) === index
      );
    })
    .slice(0, 8)
    .map(({ score: _score, ...item }) => item);
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

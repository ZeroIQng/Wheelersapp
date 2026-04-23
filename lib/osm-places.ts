export type PlaceSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  icon: 'location-on' | 'storefront' | 'flight' | 'history';
};

const nigeriaBbox = '2.668,4.24,14.678,13.892';

type PhotonFeature = {
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

      if (!title || !id) {
        return null;
      }

      return {
        id,
        title,
        subtitle: buildSubtitle(feature),
        icon: mapPhotonValueToIcon(feature.properties?.osm_value),
      } satisfies PlaceSuggestion;
    })
    .filter((item): item is PlaceSuggestion => item != null);
}

export const DEFAULT_PICKUP_LABEL = "Current location • Lekki Phase 1";
export const DEFAULT_DESTINATION_LABEL = "Civic Centre, Victoria Island";
export const MAX_ADDITIONAL_STOPS = 5;
export const MAX_ROUTE_STOPS = MAX_ADDITIONAL_STOPS + 1;

export type RideItinerary = {
  pickup: string;
  stops: string[];
};

export type RideRouteRow = {
  id: string;
  kind: "pickup" | "stop" | "destination";
  label: string;
  value: string;
};

export type RideEstimate = {
  priceNgn: number;
  priceLabel: string;
  etaMinutes: number;
  etaLabel: string;
  distanceKm: number;
  distanceLabel: string;
  routeNote: string;
};

function sanitizeLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeRideItinerary(
  input?: Partial<RideItinerary> | null,
): RideItinerary {
  const pickup = sanitizeLabel(input?.pickup) ?? DEFAULT_PICKUP_LABEL;
  const candidateStops = Array.isArray(input?.stops) ? input?.stops : [];
  const stops = candidateStops
    .map((stop) => sanitizeLabel(stop))
    .filter((stop): stop is string => stop != null)
    .slice(0, MAX_ROUTE_STOPS);

  return {
    pickup,
    stops: stops.length > 0 ? stops : [DEFAULT_DESTINATION_LABEL],
  };
}

export function serializeRideItinerary(itinerary: RideItinerary): string {
  return encodeURIComponent(JSON.stringify(normalizeRideItinerary(itinerary)));
}

export function parseRideItineraryParam(
  value: string | string[] | undefined,
): RideItinerary {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return normalizeRideItinerary();
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<RideItinerary>;
    return normalizeRideItinerary(parsed);
  } catch {
    return normalizeRideItinerary();
  }
}

export function moveRouteStop(
  stops: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= stops.length ||
    toIndex >= stops.length ||
    fromIndex === toIndex
  ) {
    return stops;
  }

  const next = [...stops];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function getAdditionalStopCount(itinerary: RideItinerary): number {
  return Math.max(0, itinerary.stops.length - 1);
}

export function getRideRouteRows(itinerary: RideItinerary): RideRouteRow[] {
  const normalized = normalizeRideItinerary(itinerary);
  const rows: RideRouteRow[] = [
    {
      id: "pickup",
      kind: "pickup",
      label: "Pickup",
      value: normalized.pickup,
    },
  ];

  normalized.stops.forEach((stop, index) => {
    const isLast = index === normalized.stops.length - 1;
    const label =
      normalized.stops.length === 1
        ? "Destination"
        : isLast
          ? "Final destination"
          : `Stop ${index + 1}`;

    rows.push({
      id: `stop-${index}`,
      kind: isLast ? "destination" : "stop",
      label,
      value: stop,
    });
  });

  return rows;
}

export function estimateRide(itinerary: RideItinerary): RideEstimate {
  const normalized = normalizeRideItinerary(itinerary);
  const extraStops = getAdditionalStopCount(normalized);
  const priceNgn = 3800 + extraStops * 650;
  const etaMinutes = 3 + extraStops * 2;
  const distanceKm = Number((5.2 + extraStops * 1.35).toFixed(1));
  const routeNote =
    extraStops > 0
      ? `Includes ${extraStops} extra stop${extraStops === 1 ? "" : "s"} before arrival.`
      : "Direct ride with pickup and drop-off only.";

  return {
    priceNgn,
    priceLabel: `₦${priceNgn.toLocaleString("en-NG")}`,
    etaMinutes,
    etaLabel: `${etaMinutes} min away`,
    distanceKm,
    distanceLabel: `${distanceKm.toFixed(1)} km trip`,
    routeNote,
  };
}

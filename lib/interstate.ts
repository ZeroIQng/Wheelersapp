import { apiRequest } from "@/lib/api";

/**
 * Interstate travel — Lagos to Ibadan, Abuja to Kaduna, and the rest.
 *
 * The mental model differs from a city ride in the one way that shapes every
 * type here: you are not hailing a driver, you are buying a seat on a
 * *departure* that leaves at a fixed time. Seats are the scarce thing, so
 * almost everything a rider looks at is a count of them.
 *
 * Search is two steps, not one, because the backend keys departures by route:
 * pick the city you are leaving, and the destinations that come back each carry
 * the `routeId` the departure list needs.
 */

export type InterstateOrigin = {
  state: string;
  city: string;
};

export type InterstateDestination = {
  routeId: string;
  state: string;
  city: string;
  terminal: string;
  distanceKm: number;
  durationMinutes: number;
  seatPriceNgn: number;
  charterPriceNgn: number;
};

export type InterstateRouteRef = {
  id: string;
  origin: { state: string; city: string; terminal: string };
  destination: { state: string; city: string; terminal: string };
  distanceKm: number;
  durationMinutes: number;
};

export type InterstateDepartureStatus =
  | "SCHEDULED"
  | "FILLING"
  | "FULL"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "CANCELLED";

/** A departure as the rider's search returns it. */
export type InterstateDeparture = {
  id: string;
  departureAt: string;
  vehicleType: "SEDAN" | "SUV" | "MINIBUS" | "BUS";
  totalSeats: number;
  seatsAvailable: number;
  seatPriceNgn: number;
  status: InterstateDepartureStatus;
  route: InterstateRouteRef;
};

/** A departure as the driver's endpoints return it — more operational detail. */
export type DriverDeparture = {
  id: string;
  status: InterstateDepartureStatus;
  departureAt: string;
  vehicleType: "SEDAN" | "SUV" | "MINIBUS" | "BUS";
  vehiclePlate: string | null;
  totalSeats: number;
  seatsBooked: number;
  seatPriceNgn: number;
  charterPriceNgn: number;
  bookingMode: "SHARED" | "CHARTER";
  /** Every seat sold on this departure — what the trip is worth to run. */
  grossNgn: number;
  departedAt: string | null;
  arrivedAt: string | null;
  route: InterstateRouteRef & {
    origin: { state: string; city: string; terminal: string; lat: number; lng: number };
    destination: { state: string; city: string; terminal: string; lat: number; lng: number };
  };
};

export type InterstateBooking = {
  id: string;
  reference: string;
  mode: "SHARED" | "CHARTER";
  seats: number;
  amountNgn: number;
  /** What the rider offered. Below `listPriceNgn` until a driver accepts it. */
  offeredNgn: number | null;
  listPriceNgn: number | null;
  declineReason: string | null;
  acceptedAt: string | null;
  refundedNgn: number | null;
  status:
    | "PENDING_OFFER"
    | "OFFER_DECLINED"
    | "CONFIRMED"
    | "CANCELLED"
    | "REFUNDED"
    | "COMPLETED"
    | "NO_SHOW";
  passengerName: string | null;
  passengerPhone: string | null;
  pickupNote: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  departure: {
    id: string;
    departureAt: string;
    status: InterstateDepartureStatus;
    vehicleType: string;
    vehiclePlate: string | null;
    seatsAvailable: number;
    driver: {
      id: string;
      name: string | null;
      phone: string | null;
      rating: number | null;
    } | null;
  };
  route: InterstateRouteRef;
};

export type InterstateQuote = {
  routeId: string;
  origin: { state: string; city: string; terminal: string };
  destination: { state: string; city: string; terminal: string };
  distanceKm: number;
  durationMinutes: number;
  mode: "SHARED" | "CHARTER";
  seats: number;
  pricePerSeatNgn: number;
  totalNgn: number;
  alternative: { mode: "SHARED" | "CHARTER"; totalNgn: number; note: string };
};

export type InterstatePassenger = {
  bookingId: string;
  reference: string;
  name: string;
  phone: string | null;
  seats: number;
  mode: "SHARED" | "CHARTER";
  status: string;
  pickupNote: string | null;
};

/* ── rider ───────────────────────────────────────────────────────────────── */

export async function listInterstateOrigins(accessToken: string) {
  return apiRequest<{ origins: InterstateOrigin[] }>("GET", "/interstate/cities", {
    accessToken,
    fallbackError: "We could not load the cities we travel from.",
  });
}

export async function listInterstateDestinations(
  accessToken: string,
  originCity: string,
) {
  return apiRequest<{ from: string; destinations: InterstateDestination[] }>(
    "GET",
    `/interstate/cities?from=${encodeURIComponent(originCity)}`,
    {
      accessToken,
      fallbackError: "We could not load destinations from that city.",
    },
  );
}

export async function listInterstateDepartures(
  accessToken: string,
  params: { routeId: string; date?: string; seats?: number },
) {
  const query = new URLSearchParams({ routeId: params.routeId });
  if (params.date) query.set("date", params.date);
  if (params.seats) query.set("seats", String(params.seats));

  return apiRequest<{ departures: InterstateDeparture[] }>(
    "GET",
    `/interstate/departures?${query.toString()}`,
    {
      accessToken,
      fallbackError: "We could not load trips for that route.",
    },
  );
}

export async function quoteInterstate(
  accessToken: string,
  params: { routeId: string; mode: "SHARED" | "CHARTER"; seats?: number },
) {
  return apiRequest<InterstateQuote>("POST", "/interstate/quote", {
    accessToken,
    body: params,
    fallbackError: "We could not price that trip.",
  });
}

export async function bookInterstateSeats(
  accessToken: string,
  params: {
    departureId: string;
    seats: number;
    /**
     * What the rider is willing to pay in total. At or above the posted fare
     * this books outright; below it, the trip is offered to drivers and nothing
     * is charged until one accepts.
     */
    offeredNgn?: number;
    passengerName?: string;
    passengerPhone?: string;
    pickupNote?: string;
    idempotencyKey?: string;
  },
) {
  return apiRequest<{
    booking: InterstateBooking;
    seatsRemaining?: number;
    pendingOffer: boolean;
    replacedPreviousOffer?: boolean;
  }>("POST", "/interstate/bookings", {
    accessToken,
    body: {
      departureId: params.departureId,
      seats: params.seats,
      offeredNgn: params.offeredNgn,
      passengerName: params.passengerName,
      passengerPhone: params.passengerPhone,
      pickupNote: params.pickupNote,
    },
    idempotencyKey: params.idempotencyKey,
    fallbackError: "We could not complete your booking.",
  });
}

/* ── driver: passenger offers ────────────────────────────────────────────── */

export type InterstateOffer = {
  bookingId: string;
  reference: string;
  seats: number;
  offeredNgn: number;
  listPriceNgn: number;
  pickupNote: string | null;
  createdAt: string;
  passenger: { name: string; phone: string | null };
  departure: {
    id: string;
    departureAt: string;
    seatsAvailable: number;
    seatPriceNgn: number;
    route: InterstateRouteRef;
  };
};

export async function listInterstateOffers(accessToken: string) {
  return apiRequest<{ offers: InterstateOffer[] }>(
    "GET",
    "/interstate/driver/offers",
    {
      accessToken,
      fallbackError: "We could not load passenger offers.",
    },
  );
}

export async function acceptInterstateOffer(
  accessToken: string,
  bookingId: string,
) {
  return apiRequest<{ accepted: boolean; bookingId: string }>(
    "POST",
    `/interstate/driver/offers/${encodeURIComponent(bookingId)}/accept`,
    {
      accessToken,
      fallbackError: "We could not accept this offer.",
    },
  );
}

export async function declineInterstateOffer(
  accessToken: string,
  bookingId: string,
  reason?: string,
) {
  return apiRequest<{ declined: boolean; bookingId: string }>(
    "POST",
    `/interstate/driver/offers/${encodeURIComponent(bookingId)}/decline`,
    {
      accessToken,
      body: { reason },
      fallbackError: "We could not decline this offer.",
    },
  );
}

// The pricing rules live apart from the networking so they can be tested
// against the server's copy of them directly. Re-exported here so callers have
// one place to import interstate things from.
export {
  minimumOfferNgn,
  isBidBelowFare,
  vehiclePriceNgn,
  seatPriceNgn,
  priceForBooking,
  vehicleClass,
  VEHICLE_CLASSES,
  RATE_PER_KM_NGN,
} from "@/lib/interstate-pricing";
export type { InterstateVehicleType, VehicleClass } from "@/lib/interstate-pricing";

/* ── the travel form ─────────────────────────────────────────────────────── */

export type InterstateVehicleOption = {
  type: "SEDAN" | "SUV" | "MINIBUS" | "BUS";
  label: string;
  description: string;
  seats: number;
  /** What the whole vehicle costs — what "just me" pays. */
  alonePriceNgn: number;
  /** What the seats asked for cost when sharing. */
  togetherPriceNgn: number;
  seatPriceNgn: number;
  minimumOfferAloneNgn: number;
  minimumOfferTogetherNgn: number;
};

export async function listInterstateVehicles(
  accessToken: string,
  params: { routeId: string; seats?: number },
) {
  const query = new URLSearchParams({ routeId: params.routeId });
  if (params.seats) query.set("seats", String(params.seats));

  return apiRequest<{
    route: InterstateRouteRef;
    ratePerKmNgn: number;
    vehicles: InterstateVehicleOption[];
  }>("GET", `/interstate/vehicles?${query.toString()}`, {
    accessToken,
    fallbackError: "We could not price that route.",
  });
}

export async function createTravelRequest(
  accessToken: string,
  params: {
    routeId: string;
    departureAt: string;
    vehicleType: string;
    mode: "alone" | "together";
    seats: number;
    offeredNgn?: number;
    passengerName?: string;
    passengerPhone?: string;
    pickupNote?: string;
    idempotencyKey?: string;
  },
) {
  return apiRequest<{
    booking: InterstateBooking;
    listPriceNgn: number;
    pendingOffer: boolean;
  }>("POST", "/interstate/requests", {
    accessToken,
    body: {
      routeId: params.routeId,
      departureAt: params.departureAt,
      vehicleType: params.vehicleType,
      mode: params.mode,
      seats: params.seats,
      offeredNgn: params.offeredNgn,
      passengerName: params.passengerName,
      passengerPhone: params.passengerPhone,
      pickupNote: params.pickupNote,
    },
    idempotencyKey: params.idempotencyKey,
    fallbackError: "We could not send your travel request.",
  });
}

export async function listInterstateBookings(
  accessToken: string,
  options: { upcoming?: boolean } = {},
) {
  const query = options.upcoming ? "?upcoming=true" : "";
  return apiRequest<{ bookings: InterstateBooking[] }>(
    "GET",
    `/interstate/bookings${query}`,
    {
      accessToken,
      fallbackError: "We could not load your trips.",
    },
  );
}

export async function cancelInterstateBooking(
  accessToken: string,
  bookingId: string,
  reason?: string,
) {
  return apiRequest<{ booking: InterstateBooking; refundedNgn: number }>(
    "POST",
    `/interstate/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      accessToken,
      body: { reason },
      fallbackError: "We could not cancel that booking.",
    },
  );
}

/* ── driver ──────────────────────────────────────────────────────────────── */

export async function listClaimableDepartures(accessToken: string) {
  return apiRequest<{ departures: DriverDeparture[] }>(
    "GET",
    "/interstate/driver/available",
    {
      accessToken,
      fallbackError: "We could not load available trips.",
    },
  );
}

export async function listMyInterstateTrips(
  accessToken: string,
  options: { includeFinished?: boolean } = {},
) {
  const query = options.includeFinished ? "?includeFinished=true" : "";
  return apiRequest<{ departures: DriverDeparture[] }>(
    "GET",
    `/interstate/driver/trips${query}`,
    {
      accessToken,
      fallbackError: "We could not load your trips.",
    },
  );
}

export async function claimDeparture(
  accessToken: string,
  departureId: string,
  vehiclePlate?: string,
) {
  return apiRequest<{ departure: DriverDeparture }>(
    "POST",
    `/interstate/driver/departures/${encodeURIComponent(departureId)}/claim`,
    {
      accessToken,
      body: { vehiclePlate },
      fallbackError: "We could not give you this trip.",
    },
  );
}

export async function startDeparture(accessToken: string, departureId: string) {
  return apiRequest<{ departure: DriverDeparture }>(
    "POST",
    `/interstate/driver/departures/${encodeURIComponent(departureId)}/start`,
    {
      accessToken,
      fallbackError: "We could not start this trip.",
    },
  );
}

export async function completeDeparture(accessToken: string, departureId: string) {
  return apiRequest<{ departure: DriverDeparture }>(
    "POST",
    `/interstate/driver/departures/${encodeURIComponent(departureId)}/complete`,
    {
      accessToken,
      fallbackError: "We could not finish this trip.",
    },
  );
}

export async function getDepartureManifest(
  accessToken: string,
  departureId: string,
) {
  return apiRequest<{
    departure: DriverDeparture;
    passengers: InterstatePassenger[];
  }>(
    "GET",
    `/interstate/driver/departures/${encodeURIComponent(departureId)}/manifest`,
    {
      accessToken,
      fallbackError: "We could not load the passenger list.",
    },
  );
}

/* ── shared helpers ──────────────────────────────────────────────────────── */

export function formatNaira(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

/**
 * Departure times phrased the way people talk about travel: "Today, 6:30 AM"
 * beats an ISO string or a bare date every time.
 */
export function formatDepartureTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;

  return `${date.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}, ${time}`;
}

export function formatTravelDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

export function routeLabel(route: InterstateRouteRef): string {
  return `${route.origin.city} → ${route.destination.city}`;
}

/** How a departure's status should read to a person, not a database. */
export function describeDepartureStatus(status: InterstateDepartureStatus): string {
  switch (status) {
    case "SCHEDULED":
      return "Scheduled";
    case "FILLING":
      return "Filling up";
    case "FULL":
      return "Fully booked";
    case "DISPATCHED":
      return "Driver assigned";
    case "IN_TRANSIT":
      return "On the road";
    case "COMPLETED":
      return "Arrived";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

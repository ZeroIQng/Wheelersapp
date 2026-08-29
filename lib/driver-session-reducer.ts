/**
 * The driver session's state machine, as pure functions.
 *
 * Everything the gateway can tell a driver — a new request, a bid answered, a
 * trip starting, ending or being cancelled — is a transition on
 * `DriverSessionState`. Keeping those transitions out of the React hook means
 * the whole bid → paid → matched flow can be exercised in a plain node test,
 * which is how the "bid card never updates after the rider pays" bug should
 * have been caught.
 */
import type { DriverActiveRide, RideEstimateWaypoint, RideRouteGeometry } from '@/lib/api';

export type DriverStatus =
  | 'offline'
  | 'online'
  | 'offered'
  | 'navigating'
  | 'arrived'
  | 'active'
  | 'completed';

export type RideOffer = {
  rideId: string;
  riderId: string;
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops: RideEstimateWaypoint[];
  fareEstimateNgn: number;
  /**
   * What the rider is actually offering right now. A rider counter-offer only
   * moves this field — fareEstimateNgn stays at the original estimate — so a
   * screen that reads fareEstimateNgn shows a stale price forever.
   */
  riderOfferNgn?: number;
  plannedDistanceKm?: number;
  plannedDurationSeconds?: number;
  /**
   * Driver→pickup at match time, from the backend. A seed for the live
   * "to pickup" card — screens recompute from the phone's own GPS when a fix
   * is available.
   */
  pickupDistanceKm?: number;
  pickupEtaSeconds?: number;
  expiresAt: string;
  route?: RideRouteGeometry;
  /** Shared ride: several riders picked up and dropped along one route. */
  isGroupRide?: boolean;
  riderCount?: number;
  /** Parallel to `stops` — which waypoints are pickups vs drop-offs. */
  stopKinds?: ('pickup' | 'dropoff')[];
  /**
   * Group rides: each rider's own leg and seat offer. The driver negotiates
   * per seat — accept one rider's price, bid another — not on a lump sum.
   */
  groupMembers?: GroupSeat[];
};

export type GroupSeat = {
  rideId: string;
  riderId: string;
  pickup: RideEstimateWaypoint;
  dropoff: RideEstimateWaypoint;
  offerNgn: number;
};

export type DriverRide = {
  rideId: string;
  riderId: string;
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops: RideEstimateWaypoint[];
  fareNgn: number;
  plannedDistanceKm?: number;
  plannedDurationSeconds?: number;
  route?: RideRouteGeometry;
  startedAt?: string;
  completedAt?: string;
  completedFareNgn?: number;
  distanceKm?: number;
  durationSeconds?: number;
  riderPaid?: boolean;
  riderPhone?: string;
  liveDistanceKm?: number;
};

/**
 * A bid the driver has sent, waiting on the rider. Snapshotted from the offer
 * at bid time because the offer card expires after 30s while the rider has
 * minutes to decide — by the time ride:matched arrives, the offer is usually
 * gone from the queue, and the match used to be silently dropped.
 */
export type PendingBid = {
  offer: RideOffer;
  amountNgn: number;
  sentAt: string;
  /**
   * The rider picked this bid and (on wallet rides) paid for it. Set from
   * `ride:offer_accepted`, which the gateway sends the moment the rider pays —
   * a beat before ride-service turns it into the `ride:matched` that starts
   * the trip. Without it the card kept saying "waiting for rider" over money
   * that had already moved.
   */
  acceptedAt?: string;
  agreedFareNgn?: number;
  riderPaid?: boolean;
  /** The rider came back with a different price after this bid was sent. */
  counteredAt?: string;
};

export type DriverSessionState = {
  status: DriverStatus;
  /**
   * Every live request, newest first. Offers used to be a single slot, so a
   * second request silently overwrote the first and the driver never knew it
   * existed — they only ever saw whichever one arrived last.
   */
  offers: RideOffer[];
  /** The offer currently open on screen. */
  currentOffer: RideOffer | null;
  currentRide: DriverRide | null;
  /** Bids sent and not yet answered, keyed by rideId. */
  pendingBids: Record<string, PendingBid>;
};

export const defaultDriverSession: DriverSessionState = {
  status: 'offline',
  offers: [],
  currentOffer: null,
  currentRide: null,
  pendingBids: {},
};

// ── Payload parsing ────────────────────────────────────────────────────────

export function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseWaypoint(value: unknown): RideEstimateWaypoint | null {
  const record = getRecord(value);
  if (!record) return null;
  const lat = getNumber(record.lat);
  const lng = getNumber(record.lng);
  const address = getString(record.address);
  if (lat === undefined || lng === undefined || !address) return null;
  return { lat, lng, address };
}

export function parseWaypointList(value: unknown): RideEstimateWaypoint[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseWaypoint).filter((w): w is RideEstimateWaypoint => w !== null);
}

/** Drops requests whose bid window has already closed. */
export function pruneExpiredOffers(offers: RideOffer[], now: number = Date.now()): RideOffer[] {
  return offers.filter((offer) => {
    const expiresMs = new Date(offer.expiresAt).getTime();
    return !Number.isFinite(expiresMs) || expiresMs > now;
  });
}

/**
 * Where a backend ride status puts the driver in this session. Anything
 * before assignment isn't a trip yet; anything after completion is over.
 */
export function statusFromRideStatus(rideStatus: string | undefined): DriverStatus | null {
  switch (rideStatus) {
    case 'DRIVER_ASSIGNED':
    case 'DRIVER_EN_ROUTE':
      return 'navigating';
    case 'ARRIVED':
      return 'arrived';
    case 'IN_PROGRESS':
      return 'active';
    default:
      return null;
  }
}

/** Trip progress order — a sync must never move the driver backwards. */
const TRIP_STATUS_RANK: Record<DriverStatus, number> = {
  offline: 0,
  online: 1,
  offered: 2,
  navigating: 3,
  arrived: 4,
  active: 5,
  completed: 6,
};

function rideFromSnapshot(ride: DriverActiveRide): DriverRide {
  return {
    rideId: ride.rideId,
    riderId: ride.riderId,
    pickup: ride.pickup,
    destination: ride.destination,
    stops: ride.stops ?? [],
    fareNgn: ride.agreedFareNgn,
    startedAt: ride.startedAt ?? undefined,
    riderPaid: ride.riderPaid,
    riderPhone: ride.riderPhone ?? undefined,
  };
}

// ── Transitions ────────────────────────────────────────────────────────────

/**
 * A bid the driver just sent, remembered past the offer card's short life.
 * The ride also leaves the requests queue: one ride, one card — a request
 * you've answered lives on your bid card, never beside it as a duplicate.
 */
export function recordBid(
  prev: DriverSessionState,
  offer: RideOffer,
  amountNgn: number,
  sentAt: string = new Date().toISOString(),
): DriverSessionState {
  return {
    ...prev,
    offers: prev.offers.filter((queued) => queued.rideId !== offer.rideId),
    pendingBids: {
      ...prev.pendingBids,
      [offer.rideId]: { offer, amountNgn, sentAt },
    },
  };
}

/** How long a sent bid stays alive with no answer: the backend auction runs
 *  180s; a little grace covers clock skew and a re-armed timer. */
export const BID_LIFETIME_MS = 210_000;
/** An accepted-but-never-matched bid holds on longer — the resync will
 *  usually turn it into a trip; after this, it's genuinely dead. */
const ACCEPTED_BID_LIFETIME_MS = 10 * 60_000;

/**
 * Client-side backstop for bids the backend never resolved — a dropped
 * ride:bid_timeout frame must not leave "waiting for rider" on screen
 * forever. Returns `prev` untouched when nothing expired.
 */
export function pruneExpiredBids(prev: DriverSessionState, now: number = Date.now()): DriverSessionState {
  const entries = Object.entries(prev.pendingBids);
  if (entries.length === 0) return prev;

  const kept = entries.filter(([, bid]) => {
    const base = new Date(bid.counteredAt ?? bid.sentAt).getTime();
    if (!Number.isFinite(base)) return false;
    const lifetime = bid.acceptedAt ? ACCEPTED_BID_LIFETIME_MS : BID_LIFETIME_MS;
    return now - base < lifetime;
  });
  if (kept.length === entries.length) return prev;
  return { ...prev, pendingBids: Object.fromEntries(kept) };
}

/**
 * Adopt the ride the backend says this driver is on (from
 * GET /drivers/me/rides/active). Returns `prev` untouched when the snapshot
 * describes nothing that is a live trip.
 */
export function applyActiveRideSnapshot(
  prev: DriverSessionState,
  ride: DriverActiveRide | null,
): DriverSessionState {
  if (!ride) return prev;
  const status = statusFromRideStatus(ride.rideStatus);
  if (!status) return prev;

  const sameRide = prev.currentRide?.rideId === ride.rideId;
  const nextStatus =
    sameRide && TRIP_STATUS_RANK[prev.status] > TRIP_STATUS_RANK[status] ? prev.status : status;
  const snapshot = rideFromSnapshot(ride);
  return {
    ...prev,
    status: nextStatus,
    offers: [],
    currentOffer: null,
    pendingBids: {},
    currentRide:
      sameRide && prev.currentRide
        ? {
            ...prev.currentRide,
            fareNgn: snapshot.fareNgn || prev.currentRide.fareNgn,
            riderPaid: prev.currentRide.riderPaid || snapshot.riderPaid,
            riderPhone: prev.currentRide.riderPhone ?? snapshot.riderPhone,
            startedAt: prev.currentRide.startedAt ?? snapshot.startedAt,
          }
        : snapshot,
  };
}

/**
 * Apply one gateway message. Returns the next state, or `null` when the
 * message is not a session transition (errors, chat, wallet pings) — the
 * caller handles those.
 */
export function reduceDriverSession(
  prev: DriverSessionState,
  type: string,
  payload: Record<string, unknown>,
  now: number = Date.now(),
): DriverSessionState | null {
  if (type === 'ride:offer') {
    const pickup = parseWaypoint(payload.pickup);
    const destination = parseWaypoint(payload.destination);
    if (!pickup || !destination) return prev;

    const incoming: RideOffer = {
      rideId: getString(payload.rideId) ?? '',
      riderId: getString(payload.riderId) ?? '',
      pickup,
      destination,
      stops: parseWaypointList(payload.stops),
      fareEstimateNgn: getNumber(payload.fareEstimateNgn) ?? 0,
      riderOfferNgn: getNumber(payload.riderOfferNgn),
      plannedDistanceKm: getNumber(payload.plannedDistanceKm),
      plannedDurationSeconds: getNumber(payload.plannedDurationSeconds),
      pickupDistanceKm: getNumber(payload.pickupDistanceKm),
      pickupEtaSeconds: getNumber(payload.pickupEtaSeconds),
      expiresAt: getString(payload.expiresAt) ?? '',
      route: payload.route as RideRouteGeometry | undefined,
      isGroupRide: payload.isGroupRide === true,
      riderCount: getNumber(payload.riderCount),
      stopKinds: Array.isArray(payload.stopKinds)
        ? payload.stopKinds.filter(
            (k): k is 'pickup' | 'dropoff' => k === 'pickup' || k === 'dropoff',
          )
        : undefined,
      groupMembers:
        Array.isArray(payload.groupMembers) && payload.groupMembers.length > 0
          ? (payload.groupMembers as GroupSeat[])
          : undefined,
    };

    // A re-broadcast for a ride we've already BID on is the rider talking
    // back (usually a counter-offer). It updates the bid card — it must
    // never reappear in the requests queue as a seemingly new job.
    const existingBid = prev.pendingBids[incoming.rideId];
    if (existingBid) {
      const previousAsk = existingBid.offer.riderOfferNgn ?? existingBid.offer.fareEstimateNgn;
      const nextAsk = incoming.riderOfferNgn ?? incoming.fareEstimateNgn;
      return {
        ...prev,
        offers: pruneExpiredOffers(prev.offers, now).filter(
          (queued) => queued.rideId !== incoming.rideId,
        ),
        currentOffer:
          prev.currentOffer?.rideId === incoming.rideId ? incoming : prev.currentOffer,
        pendingBids: {
          ...prev.pendingBids,
          [incoming.rideId]: {
            ...existingBid,
            offer: incoming,
            counteredAt:
              nextAsk !== previousAsk ? new Date(now).toISOString() : existingBid.counteredAt,
          },
        },
      };
    }

    // Same rideId means a re-priced version of a request already in the
    // queue, so it replaces that entry rather than adding a duplicate.
    const others = pruneExpiredOffers(prev.offers, now).filter(
      (queued) => queued.rideId !== incoming.rideId,
    );
    const offers = [incoming, ...others];

    // Don't yank the driver off a request they're reading. Only take over
    // the screen when nothing is open, or when this update is for the very
    // request they're looking at.
    const keepsCurrent =
      prev.currentOffer !== null && prev.currentOffer.rideId !== incoming.rideId;

    return {
      ...prev,
      status: prev.currentRide ? prev.status : 'offered',
      offers,
      currentOffer: keepsCurrent ? prev.currentOffer : incoming,
    };
  }

  if (type === 'driver:accept:accepted') {
    // Bid sent — stay on the offer screen, wait for rider to accept
    return { ...prev, status: 'offered' };
  }

  if (type === 'ride:matched') {
    // Rider accepted (and paid) — now navigate to pickup. Also arrives as a
    // resync on every reconnect while a trip is assigned, in which case
    // rideStatus tells us how far along the trip already is.
    const matchedRideId = getString(payload.rideId);
    const offer =
      (matchedRideId
        ? (prev.currentOffer?.rideId === matchedRideId ? prev.currentOffer : undefined) ??
          prev.offers.find((queued) => queued.rideId === matchedRideId) ??
          prev.pendingBids[matchedRideId]?.offer
        : prev.currentOffer) ?? null;

    // The gateway ships the route with the match, so the trip can be rebuilt
    // even when the offer card is long gone (expired, app restarted mid-bid,
    // socket down when the rider paid).
    const payloadPickup = parseWaypoint(payload.pickup);
    const payloadDestination = parseWaypoint(payload.destination);

    const rideId = matchedRideId ?? offer?.rideId;
    const riderId = getString(payload.riderId) ?? offer?.riderId;
    const pickup = payloadPickup ?? offer?.pickup;
    const destination = payloadDestination ?? offer?.destination;

    if (!rideId || !riderId || !pickup || !destination) {
      console.warn('[driver-session] ride:matched for unknown ride', matchedRideId);
      return prev;
    }

    const incomingStatus = statusFromRideStatus(getString(payload.rideStatus)) ?? 'navigating';
    const sameRide = prev.currentRide?.rideId === rideId;
    // A resync never drags an in-progress trip backwards: the DB write for
    // "arrived"/"started" can trail the socket ack by a moment.
    const status =
      sameRide && TRIP_STATUS_RANK[prev.status] > TRIP_STATUS_RANK[incomingStatus]
        ? prev.status
        : incomingStatus;

    const riderPaid =
      payload.riderPaid === true ||
      prev.pendingBids[rideId]?.riderPaid === true ||
      (sameRide && prev.currentRide?.riderPaid === true);

    return {
      ...prev,
      status,
      // Taking this ride drops every other request — the driver is busy.
      offers: [],
      currentOffer: null,
      pendingBids: {},
      currentRide: {
        ...(sameRide ? prev.currentRide : null),
        rideId,
        riderId,
        pickup,
        destination,
        stops:
          Array.isArray(payload.stops) && payload.stops.length > 0
            ? parseWaypointList(payload.stops)
            : offer?.stops ?? (sameRide ? prev.currentRide?.stops : undefined) ?? [],
        fareNgn:
          getNumber(payload.agreedFareNgn) ??
          (sameRide ? prev.currentRide?.fareNgn : undefined) ??
          offer?.fareEstimateNgn ??
          0,
        plannedDistanceKm:
          offer?.plannedDistanceKm ?? (sameRide ? prev.currentRide?.plannedDistanceKm : undefined),
        plannedDurationSeconds:
          offer?.plannedDurationSeconds ??
          (sameRide ? prev.currentRide?.plannedDurationSeconds : undefined),
        route: offer?.route ?? (sameRide ? prev.currentRide?.route : undefined),
        startedAt: getString(payload.startedAt) ?? (sameRide ? prev.currentRide?.startedAt : undefined),
        riderPaid,
        riderPhone: getString(payload.riderPhone) ?? (sameRide ? prev.currentRide?.riderPhone : undefined),
      },
    };
  }

  if (type === 'ride:offer_accepted') {
    // The rider chose this bid and paid. ride:matched follows within a beat
    // (ride-service turns the acceptance into an assignment) — but the driver
    // should see "paid" now, not "waiting", and if the match never lands the
    // card still tells the truth.
    const rideId = getString(payload.rideId);
    if (!rideId) return prev;
    const bid = prev.pendingBids[rideId];
    if (!bid) return prev;
    return {
      ...prev,
      pendingBids: {
        ...prev.pendingBids,
        [rideId]: {
          ...bid,
          acceptedAt: new Date(now).toISOString(),
          agreedFareNgn: getNumber(payload.agreedFareNgn) ?? bid.amountNgn,
          // Wallet rides are held at acceptance; anything else is paid later.
          riderPaid: getString(payload.paymentMethod) !== 'CASH',
        },
      },
    };
  }

  if (type === 'ride:bid_timeout') {
    // Auction over, nobody chosen — the request and any bid on it are gone.
    const rideId = getString(payload.rideId);
    if (!rideId) return prev;
    const hasBid = rideId in prev.pendingBids;
    const hasOffer = prev.offers.some((queued) => queued.rideId === rideId);
    if (!hasBid && !hasOffer && prev.currentOffer?.rideId !== rideId) return prev;

    const pendingBids = { ...prev.pendingBids };
    delete pendingBids[rideId];
    const offers = prev.offers.filter((queued) => queued.rideId !== rideId);
    return {
      ...prev,
      offers,
      currentOffer: prev.currentOffer?.rideId === rideId ? offers[0] ?? null : prev.currentOffer,
      status: prev.currentRide
        ? prev.status
        : offers.length > 0 || prev.currentOffer?.rideId !== rideId
          ? prev.status
          : 'online',
      pendingBids,
    };
  }

  if (type === 'ride:rider_paid') {
    const rideId = getString(payload.rideId);
    if (!rideId) return prev;
    const bid = prev.pendingBids[rideId];
    const isCurrent = prev.currentRide?.rideId === rideId;
    if (!bid && !isCurrent) return prev;
    return {
      ...prev,
      pendingBids: bid ? { ...prev.pendingBids, [rideId]: { ...bid, riderPaid: true } } : prev.pendingBids,
      currentRide:
        isCurrent && prev.currentRide ? { ...prev.currentRide, riderPaid: true } : prev.currentRide,
    };
  }

  if (type === 'driver:reject:accepted') {
    const rejectedRideId = getString(payload.rideId) ?? prev.currentOffer?.rideId;
    const offers = pruneExpiredOffers(prev.offers, now).filter(
      (queued) => queued.rideId !== rejectedRideId,
    );

    // Rejecting one request should surface the next one waiting, not dump
    // the driver back to an empty home screen.
    return {
      ...prev,
      status: prev.currentRide ? prev.status : offers.length > 0 ? 'offered' : 'online',
      offers,
      currentOffer: offers[0] ?? null,
    };
  }

  if (type === 'ride:arrived:ack') {
    return { ...prev, status: 'arrived' };
  }

  if (type === 'ride:start:accepted' || type === 'ride:started') {
    return {
      ...prev,
      status: 'active',
      currentRide: prev.currentRide
        ? {
            ...prev.currentRide,
            startedAt: getString(payload.startedAt) ?? new Date(now).toISOString(),
          }
        : prev.currentRide,
    };
  }

  if (type === 'ride:end:accepted' || type === 'ride:completed') {
    return {
      ...prev,
      status: 'completed',
      currentRide: prev.currentRide
        ? {
            ...prev.currentRide,
            completedAt: getString(payload.completedAt) ?? new Date(now).toISOString(),
            completedFareNgn: getNumber(payload.fareNgn) ?? prev.currentRide.fareNgn,
            distanceKm: getNumber(payload.distanceKm),
            durationSeconds: getNumber(payload.durationSeconds),
          }
        : prev.currentRide,
    };
  }

  // ride:cancel:accepted is the gateway's ack of the driver's own cancel; the
  // broadcast ride:cancelled follows. Both mean the same thing here.
  if (type === 'ride:cancelled' || type === 'ride:cancel:accepted') {
    const cancelledRideId = getString(payload.rideId);
    // Only the cancelled ride leaves the queue; other live requests stay.
    const offers = pruneExpiredOffers(prev.offers, now).filter(
      (queued) => queued.rideId !== cancelledRideId,
    );
    const cancelledCurrentRide = !cancelledRideId || prev.currentRide?.rideId === cancelledRideId;

    const pendingBids = { ...prev.pendingBids };
    if (cancelledRideId) delete pendingBids[cancelledRideId];

    return {
      ...prev,
      status: offers.length > 0 ? 'offered' : 'online',
      offers,
      currentOffer:
        prev.currentOffer && prev.currentOffer.rideId !== cancelledRideId
          ? prev.currentOffer
          : offers[0] ?? null,
      currentRide: cancelledCurrentRide ? null : prev.currentRide,
      pendingBids,
    };
  }

  if (type === 'ride:gps_update') {
    if (!prev.currentRide) return prev;
    return {
      ...prev,
      currentRide: {
        ...prev.currentRide,
        liveDistanceKm: getNumber(payload.totalDistanceKm) ?? prev.currentRide.liveDistanceKm,
      },
    };
  }

  if (type === 'ride:route:updated') {
    if (!prev.currentRide) return prev;
    const destination = parseWaypoint(payload.destination);
    return {
      ...prev,
      currentRide: {
        ...prev.currentRide,
        destination: destination ?? prev.currentRide.destination,
        stops: parseWaypointList(payload.stops) ?? prev.currentRide.stops,
        plannedDistanceKm: getNumber(payload.plannedDistanceKm) ?? prev.currentRide.plannedDistanceKm,
        plannedDurationSeconds:
          getNumber(payload.plannedDurationSeconds) ?? prev.currentRide.plannedDurationSeconds,
        route: (payload.route as RideRouteGeometry | undefined) ?? prev.currentRide.route,
      },
    };
  }

  return null;
}

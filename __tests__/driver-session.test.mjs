/**
 * The driver's side of the ride auction, end to end: bid → rider pays →
 * matched → trip. This is the flow that used to strand a driver on a
 * "⏳ Bid sent · waiting for rider" card after the rider had already paid.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(here, '..');
const outFile = join(mkdtempSync(join(tmpdir(), 'wheelers-driver-session-')), 'reducer.cjs');

execFileSync('npx', [
  'esbuild', join(projectRoot, 'lib/driver-session-reducer.ts'),
  '--bundle', '--platform=node', '--format=cjs', `--outfile=${outFile}`,
], { cwd: projectRoot, stdio: 'pipe' });

const {
  reduceDriverSession,
  recordBid,
  applyActiveRideSnapshot,
  pruneExpiredBids,
  dismissBid,
  defaultDriverSession,
} = createRequire(import.meta.url)(outFile);

const PICKUP = { lat: 6.6018, lng: 3.3515, address: '102 Opebi Rd, Ikeja' };
const DEST = { lat: 6.4969, lng: 3.3556, address: '15 Aiyetoro St, Surulere' };
const NOW = Date.parse('2026-08-28T20:01:00.000Z');

function online() {
  return { ...defaultDriverSession, status: 'online' };
}

function offerPayload(rideId = 'ride-1', extra = {}) {
  return {
    rideId,
    riderId: 'rider-1',
    pickup: PICKUP,
    destination: DEST,
    stops: [],
    fareEstimateNgn: 5200,
    riderOfferNgn: 6000,
    plannedDistanceKm: 17.2,
    plannedDurationSeconds: 1740,
    // The offer card lives 30s — far shorter than the rider takes to pay.
    expiresAt: new Date(NOW + 30_000).toISOString(),
    ...extra,
  };
}

/** Driver sees a request and bids on it. */
function bidSent(rideId = 'ride-1') {
  let s = reduceDriverSession(online(), 'ride:offer', offerPayload(rideId), NOW);
  const offer = s.currentOffer;
  s = recordBid(s, offer, 6000, new Date(NOW).toISOString());
  s = reduceDriverSession(s, 'driver:accept:accepted', { rideId }, NOW);
  // The driver closes the request card and goes back to the map.
  return { ...s, currentOffer: null };
}

test('a bid outlives the 30-second offer card', () => {
  const s = bidSent();
  assert.ok(s.pendingBids['ride-1'], 'the bid is remembered');
  assert.equal(s.pendingBids['ride-1'].amountNgn, 6000);
  assert.equal(s.pendingBids['ride-1'].acceptedAt, undefined, 'nobody has answered yet');
});

test('the rider paying flips the bid to accepted/paid before the match lands', () => {
  const s = reduceDriverSession(bidSent(), 'ride:offer_accepted', {
    rideId: 'ride-1',
    riderId: 'rider-1',
    agreedFareNgn: 6000,
    paymentMethod: 'WALLET',
  }, NOW + 120_000);

  const bid = s.pendingBids['ride-1'];
  assert.ok(bid.acceptedAt, 'the card must stop saying "waiting for rider"');
  assert.equal(bid.riderPaid, true, 'wallet rides are paid at acceptance');
  assert.equal(bid.agreedFareNgn, 6000);
  assert.equal(s.currentRide, null, 'no trip yet — ride:matched starts it');
});

test('a cash acceptance is accepted but not paid', () => {
  const s = reduceDriverSession(bidSent(), 'ride:offer_accepted', {
    rideId: 'ride-1', riderId: 'rider-1', agreedFareNgn: 6000, paymentMethod: 'CASH',
  }, NOW);
  assert.equal(s.pendingBids['ride-1'].riderPaid, false);
});

test('ride:matched two minutes later still starts the trip from the remembered bid', () => {
  // Offer card expired long ago; the match carries only ids and money
  // (what older gateways send).
  const s = reduceDriverSession(bidSent(), 'ride:matched', {
    rideId: 'ride-1',
    riderId: 'rider-1',
    agreedFareNgn: 6000,
    riderPaid: true,
    riderPhone: '+2348000000000',
  }, NOW + 150_000);

  assert.equal(s.status, 'navigating');
  assert.deepEqual(s.pendingBids, {}, 'the bid is resolved');
  assert.deepEqual(s.offers, [], 'other requests are dropped — the driver is busy');
  assert.equal(s.currentRide.rideId, 'ride-1');
  assert.equal(s.currentRide.fareNgn, 6000);
  assert.equal(s.currentRide.riderPaid, true);
  assert.equal(s.currentRide.riderPhone, '+2348000000000');
  assert.equal(s.currentRide.pickup.address, PICKUP.address, 'route rebuilt from the bid');
  assert.equal(s.currentRide.plannedDistanceKm, 17.2);
});

test('ride:matched for a ride this phone never saw is rebuilt from the payload route', () => {
  // App restarted mid-bid: no offer, no pending bid. The gateway now ships
  // pickup/destination with the match, so the trip must still appear.
  const s = reduceDriverSession(online(), 'ride:matched', {
    rideId: 'ride-9',
    riderId: 'rider-9',
    pickup: PICKUP,
    destination: DEST,
    stops: [],
    agreedFareNgn: 4500,
    rideStatus: 'DRIVER_ASSIGNED',
    riderPaid: true,
  }, NOW);

  assert.equal(s.status, 'navigating');
  assert.equal(s.currentRide.rideId, 'ride-9');
  assert.equal(s.currentRide.destination.address, DEST.address);
});

test('ride:matched with no route and no memory of the ride is ignored, not crashed', () => {
  const before = online();
  const s = reduceDriverSession(before, 'ride:matched', { rideId: 'ghost', riderId: 'r' }, NOW);
  assert.equal(s, before);
});

test('a reconnect resync reflects how far the trip already is', () => {
  let s = reduceDriverSession(online(), 'ride:matched', {
    rideId: 'ride-1', riderId: 'rider-1', pickup: PICKUP, destination: DEST,
    rideStatus: 'IN_PROGRESS', agreedFareNgn: 6000, resync: true,
  }, NOW);
  assert.equal(s.status, 'active', 'an in-progress ride reopens on the trip screen');

  // The driver ended the trip locally; a resync that still says IN_PROGRESS
  // (DB write trailing the ack) must not drag them back into the trip.
  s = reduceDriverSession(s, 'ride:end:accepted', { fareNgn: 6000 }, NOW);
  assert.equal(s.status, 'completed');
  s = reduceDriverSession(s, 'ride:matched', {
    rideId: 'ride-1', riderId: 'rider-1', pickup: PICKUP, destination: DEST,
    rideStatus: 'IN_PROGRESS', resync: true,
  }, NOW);
  assert.equal(s.status, 'completed', 'never moves a trip backwards');
});

test('a paid flag learned on the bid survives into the trip', () => {
  let s = reduceDriverSession(bidSent(), 'ride:offer_accepted', {
    rideId: 'ride-1', agreedFareNgn: 6000, paymentMethod: 'WALLET',
  }, NOW);
  s = reduceDriverSession(s, 'ride:matched', { rideId: 'ride-1', riderId: 'rider-1' }, NOW);
  assert.equal(s.currentRide.riderPaid, true);
});

test('ride:rider_paid marks the bid, or the trip, paid', () => {
  let s = reduceDriverSession(bidSent(), 'ride:rider_paid', { rideId: 'ride-1' }, NOW);
  assert.equal(s.pendingBids['ride-1'].riderPaid, true);

  s = reduceDriverSession(s, 'ride:matched', { rideId: 'ride-1', riderId: 'rider-1', riderPaid: false }, NOW);
  assert.equal(s.currentRide.riderPaid, true, 'paid on the bid is paid on the trip');
});

test('cancellation clears the bid; other bids are untouched', () => {
  let s = bidSent('ride-1');
  s = reduceDriverSession(s, 'ride:offer', offerPayload('ride-2'), NOW);
  s = recordBid(s, s.currentOffer, 5000);
  s = { ...s, currentOffer: null };

  s = reduceDriverSession(s, 'ride:cancelled', { rideId: 'ride-1' }, NOW);
  assert.equal(s.pendingBids['ride-1'], undefined);
  assert.ok(s.pendingBids['ride-2']);
  assert.equal(s.currentRide, null);
});

test('the driver cancelling their own trip clears it on the ack', () => {
  let s = reduceDriverSession(bidSent(), 'ride:matched', { rideId: 'ride-1', riderId: 'rider-1' }, NOW);
  assert.equal(s.status, 'navigating');
  s = reduceDriverSession(s, 'ride:cancel:accepted', { rideId: 'ride-1' }, NOW);
  assert.equal(s.currentRide, null);
  assert.equal(s.status, 'online');
});

test('the active-ride snapshot adopts a missed match and clears stale bids', () => {
  const s = applyActiveRideSnapshot(bidSent(), {
    rideId: 'ride-1',
    riderId: 'rider-1',
    driverId: 'drv-1',
    rideStatus: 'DRIVER_ASSIGNED',
    paymentMethod: 'WALLET',
    pickup: PICKUP,
    destination: DEST,
    stops: [],
    agreedFareNgn: 6000,
    riderOfferNgn: 6000,
    riderPaid: true,
    riderPhone: null,
    matchedAt: new Date(NOW).toISOString(),
    arrivedAt: null,
    startedAt: null,
  });
  assert.equal(s.status, 'navigating');
  assert.equal(s.currentRide.rideId, 'ride-1');
  assert.deepEqual(s.pendingBids, {});
});

test('a snapshot with no live trip changes nothing', () => {
  const before = bidSent();
  assert.equal(applyActiveRideSnapshot(before, null), before);
  assert.equal(
    applyActiveRideSnapshot(before, { rideId: 'x', rideStatus: 'COMPLETED', pickup: PICKUP, destination: DEST, stops: [], agreedFareNgn: 0 }),
    before,
  );
});

test('bidding removes the request from the queue — one ride, one card', () => {
  let s = reduceDriverSession(online(), 'ride:offer', offerPayload('ride-1'), NOW);
  assert.equal(s.offers.length, 1);
  s = recordBid(s, s.currentOffer, 6000, new Date(NOW).toISOString());
  assert.equal(s.offers.length, 0, 'the answered request must not sit beside the bid card');
  assert.ok(s.pendingBids['ride-1']);
});

test('a rider counter-offer updates the bid card instead of spawning a new request', () => {
  let s = bidSent('ride-1');
  // Backend re-broadcasts the request with the rider\'s new number.
  s = reduceDriverSession(s, 'ride:offer', offerPayload('ride-1', { riderOfferNgn: 3600 }), NOW + 60_000);
  assert.equal(s.offers.length, 0, 'no duplicate card');
  const bid = s.pendingBids['ride-1'];
  assert.equal(bid.offer.riderOfferNgn, 3600, 'the card carries the rider\'s new ask');
  assert.ok(bid.counteredAt, 'marked as countered');
  assert.equal(bid.amountNgn, 6000, 'my own bid amount is untouched');

  // Same price re-broadcast (driver came online etc.) is not a "counter".
  const again = reduceDriverSession(bidSent('ride-2'), 'ride:offer', offerPayload('ride-2'), NOW);
  assert.equal(again.pendingBids['ride-2'].counteredAt, undefined);
});

test('a timed-out bid becomes a terminal card that says why — never vanishes', () => {
  const s = reduceDriverSession(bidSent('ride-1'), 'ride:bid_timeout', { rideId: 'ride-1' }, NOW);
  const bid = s.pendingBids['ride-1'];
  assert.equal(bid.outcome, 'expired', 'stays visible with its outcome');
  assert.ok(bid.resolvedAt);
  assert.deepEqual(s.offers, []);

  // Rider chose someone else → same shape, different story.
  const lost = reduceDriverSession(bidSent('ride-2'), 'ride:bid_lost', { rideId: 'ride-2' }, NOW);
  assert.equal(lost.pendingBids['ride-2'].outcome, 'lost');

  // A dead bid never absorbs a fresh broadcast for its old rideId.
  const revived = reduceDriverSession(s, 'ride:offer', offerPayload('ride-1'), NOW);
  assert.equal(revived.pendingBids['ride-1'].outcome, 'expired', 'terminal stays terminal');

  // The driver can swipe the story away.
  assert.deepEqual(dismissBid(s, 'ride-1').pendingBids, {});

  // Unknown ride: no-op, same reference.
  const before = online();
  assert.equal(reduceDriverSession(before, 'ride:bid_timeout', { rideId: 'ghost' }, NOW), before);
});

test('an unresolved bid past its auction turns terminal, then leaves after the linger', () => {
  const s = bidSent('ride-1');
  assert.equal(pruneExpiredBids(s, NOW + 40_000), s, 'young bids survive, same reference');

  // Offer clock (30s card) + grace passes with no verdict → terminal, visible.
  const stale = pruneExpiredBids(s, NOW + 50_000);
  assert.equal(stale.pendingBids['ride-1'].outcome, 'expired', 'converted, not deleted');

  // …and only after the 10-minute linger does the card actually leave.
  assert.deepEqual(pruneExpiredBids(stale, NOW + 50_000 + 601_000).pendingBids, {});

  // A counter refreshes the offer (fresh expiresAt) — negotiation alive.
  const countered = reduceDriverSession(s, 'ride:offer',
    offerPayload('ride-1', { riderOfferNgn: 3600, expiresAt: new Date(NOW + 130_000).toISOString() }), NOW + 40_000);
  assert.equal(pruneExpiredBids(countered, NOW + 60_000).pendingBids['ride-1'].outcome, undefined);

  // An accepted bid holds much longer (resync will normally convert it).
  const accepted = reduceDriverSession(bidSent('ride-2'), 'ride:offer_accepted', { rideId: 'ride-2', paymentMethod: 'WALLET' }, NOW);
  assert.ok(pruneExpiredBids(accepted, NOW + 300_000).pendingBids['ride-2']);
  assert.deepEqual(pruneExpiredBids(accepted, NOW + 601_000).pendingBids, {});
});

test('the full happy path: offer → bid → paid → matched → arrived → started → completed', () => {
  let s = bidSent();
  s = reduceDriverSession(s, 'ride:offer_accepted', { rideId: 'ride-1', agreedFareNgn: 6000, paymentMethod: 'WALLET' }, NOW);
  s = reduceDriverSession(s, 'ride:matched', { rideId: 'ride-1', riderId: 'rider-1', agreedFareNgn: 6000, riderPaid: true }, NOW);
  assert.equal(s.status, 'navigating');
  s = reduceDriverSession(s, 'ride:arrived:ack', { rideId: 'ride-1' }, NOW);
  assert.equal(s.status, 'arrived');
  s = reduceDriverSession(s, 'ride:start:accepted', { rideId: 'ride-1', startedAt: new Date(NOW).toISOString() }, NOW);
  assert.equal(s.status, 'active');
  assert.ok(s.currentRide.startedAt);
  s = reduceDriverSession(s, 'ride:end:accepted', { rideId: 'ride-1', fareNgn: 6000, distanceKm: 17.4 }, NOW);
  assert.equal(s.status, 'completed');
  assert.equal(s.currentRide.completedFareNgn, 6000);
  assert.equal(s.currentRide.distanceKm, 17.4);
});

test('messages that are not session transitions are reported as unhandled', () => {
  assert.equal(reduceDriverSession(online(), 'chat:message', {}, NOW), null);
  assert.equal(reduceDriverSession(online(), 'wallet:updated', {}, NOW), null);
});

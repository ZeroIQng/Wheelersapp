/**
 * The rules of the ride auction.
 *
 * This is the screen a rider stares at while deciding who to travel with, so
 * the failure modes are specific: the same driver listed twice, a stale "you
 * offered ₦3,000" sitting under a price that has since moved, or the cheapest
 * bid buried below a dearer one.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'wheelers-offers-')), 'offers.cjs');

execFileSync('npx', [
  'esbuild', join(projectRoot, 'lib/ride-offers.ts'),
  '--bundle', '--platform=node', '--format=cjs', `--outfile=${outFile}`,
], { cwd: projectRoot, stdio: 'pipe' });

const { mergeOffer, applyRiderCounter, dismissOffer, bestOffer } =
  createRequire(import.meta.url)(outFile);

function bid(driverId, counterOfferNgn, extra = {}) {
  return {
    driverId,
    driverUserId: `user-${driverId}`,
    counterOfferNgn,
    driverName: `Driver ${driverId}`,
    driverRating: 4.8,
    vehiclePlate: 'WLR 000 AA',
    vehicleModel: 'Toyota Corolla',
    etaSeconds: 300,
    receivedAt: '2026-08-26T10:00:00.000Z',
    ...extra,
  };
}

test('the cheapest bid is always first', () => {
  const offers = [bid('a', 5000), bid('b', 3000), bid('c', 4000)]
    .reduce(mergeOffer, []);

  assert.deepEqual(offers.map((o) => o.driverId), ['b', 'c', 'a']);
  assert.equal(bestOffer(offers).driverId, 'b');
});

test('a tie on price is broken by who arrives sooner', () => {
  const offers = [
    bid('far', 3000, { etaSeconds: 900 }),
    bid('near', 3000, { etaSeconds: 120 }),
  ].reduce(mergeOffer, []);

  assert.equal(offers[0].driverId, 'near',
    'at the same price the closer driver is the better offer');
});

test('a driver who re-bids replaces their own entry, never appears twice', () => {
  let offers = [bid('a', 5000), bid('b', 4000)].reduce(mergeOffer, []);
  offers = mergeOffer(offers, bid('a', 3200));

  assert.equal(offers.length, 2, 'the same driver must not occupy two rows');
  assert.equal(offers[0].driverId, 'a');
  assert.equal(offers[0].counterOfferNgn, 3200, 'the newest price wins');
});

test("a driver's new price clears the rider's unanswered counter", () => {
  // Otherwise the card reads "You offered ₦3,000 — waiting for their reply"
  // underneath a number the driver has already moved past.
  let offers = mergeOffer([], bid('a', 5000));
  offers = applyRiderCounter(offers, 'a', 3000);
  assert.equal(offers[0].riderCounterNgn, 3000);

  offers = mergeOffer(offers, bid('a', 4200));
  assert.equal(offers[0].riderCounterNgn, undefined,
    'a stale counter against a changed price misleads the rider');
});

test('a rider counter marks only the driver it was sent to', () => {
  const offers = applyRiderCounter(
    [bid('a', 5000), bid('b', 4000)].reduce(mergeOffer, []),
    'b',
    3500,
  );

  const byId = Object.fromEntries(offers.map((o) => [o.driverId, o]));
  assert.equal(byId.b.riderCounterNgn, 3500);
  assert.equal(byId.a.riderCounterNgn, undefined,
    'countering one driver must not look like countering everybody');
});

test('dismissing a bid removes it and leaves the rest alone', () => {
  const offers = [bid('a', 5000), bid('b', 4000), bid('c', 3000)]
    .reduce(mergeOffer, []);

  const remaining = dismissOffer(offers, 'b');
  assert.deepEqual(remaining.map((o) => o.driverId), ['c', 'a']);
});

test('a dismissed driver can bid again and comes back', () => {
  // Dismissal is local and silent — the driver was never told, so nothing
  // should stop them returning with a better price.
  let offers = [bid('a', 5000), bid('b', 4000)].reduce(mergeOffer, []);
  offers = dismissOffer(offers, 'a');
  assert.equal(offers.length, 1);

  offers = mergeOffer(offers, bid('a', 2500));
  assert.equal(offers.length, 2);
  assert.equal(offers[0].driverId, 'a', 'their better price now leads the list');
});

test('merging never mutates the list it was given', () => {
  const original = [bid('a', 5000)];
  const snapshot = JSON.parse(JSON.stringify(original));

  mergeOffer(original, bid('b', 4000));
  applyRiderCounter(original, 'a', 3000);
  dismissOffer(original, 'a');

  assert.deepEqual(original, snapshot,
    'React state updates depend on these returning new arrays');
});

test('an empty auction has no best offer', () => {
  assert.equal(bestOffer([]), null);
});

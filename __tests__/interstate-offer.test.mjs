/**
 * The interstate offer floor, and the rule that decides whether naming a price
 * books a seat or starts a negotiation.
 *
 * Both the app and the server compute this floor. They have to agree: if the
 * app lets a rider dial to a number the server then rejects, the rider gets a
 * refusal for a price the UI told them was allowed.
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
const backendRoot = join(projectRoot, '..', 'Wheelers-Backend');

function bundle(entry, name) {
  const outFile = join(mkdtempSync(join(tmpdir(), `wheelers-${name}-`)), `${name}.cjs`);
  execFileSync('npx', [
    'esbuild', entry, '--bundle', '--platform=node', '--format=cjs',
    `--outfile=${outFile}`,
  ], { cwd: projectRoot, stdio: 'pipe' });
  return createRequire(import.meta.url)(outFile);
}

const app = bundle(join(projectRoot, 'lib/interstate-pricing.ts'), 'app-interstate');
const server = bundle(
  join(backendRoot, 'packages/db/src/clients/interstate-pricing.ts'),
  'server-interstate',
);

test('the app and the server agree on the floor, to the naira', () => {
  // Any disagreement here is a rider being refused a price the stepper offered.
  for (const listPrice of [1000, 3500, 6000, 8250, 10_000, 12_500, 45_000, 100_000]) {
    assert.equal(
      app.minimumOfferNgn(listPrice),
      server.minimumOfferNgn(listPrice),
      `floors diverge at a posted fare of ${listPrice}`,
    );
  }
});

test('the floor is never above the posted fare', () => {
  // A floor above list would make every offer illegal, including paying full.
  for (const listPrice of [100, 999, 1000, 7777, 999_999]) {
    assert.ok(
      app.minimumOfferNgn(listPrice) <= listPrice,
      `floor ${app.minimumOfferNgn(listPrice)} exceeds the fare ${listPrice}`,
    );
  }
});

test('the floor is a round number a person would actually type', () => {
  for (const listPrice of [3333, 7777, 12_345]) {
    assert.equal(app.minimumOfferNgn(listPrice) % 100, 0,
      'a stepper that lands on ₦2,333.10 is not a price anyone offers');
  }
});

test('a free trip cannot produce a negative floor', () => {
  assert.equal(app.minimumOfferNgn(0), 0);
});

const isBid = app.isBidBelowFare;

test('paying the posted fare exactly books outright — it is not a bid', () => {
  // The boundary that matters most: an off-by-one here would send every
  // full-price booking into a driver queue instead of confirming it.
  assert.equal(isBid(10_000, 10_000), false);
  assert.equal(isBid(9_999, 10_000), true);
  assert.equal(isBid(10_001, 10_000), false);
});

test('offering above the posted fare books outright at the higher price', () => {
  assert.equal(isBid(15_000, 10_000), false);
});

test('seat count multiplies the fare before anything is compared', () => {
  const perSeat = 6_500;
  const seats = 3;
  const listPrice = perSeat * seats;

  assert.equal(listPrice, 19_500);
  // Paying one seat's fare for three seats is a bid, and a long way under the
  // floor — the rider must be stopped, not quietly booked.
  assert.equal(isBid(perSeat, listPrice), true);
  assert.ok(perSeat < app.minimumOfferNgn(listPrice));
});

/* ── the ₦450/km car list ─────────────────────────────────────────────────── */

test('the app and the server quote the same rate per km', () => {
  assert.equal(app.RATE_PER_KM_NGN, 450);
  assert.equal(server.RATE_PER_KM_NGN, app.RATE_PER_KM_NGN);
});

test('every car class matches between the app and the server', () => {
  // A car the app prices differently from the server is a rider being quoted
  // one number and charged another.
  assert.equal(app.VEHICLE_CLASSES.length, server.VEHICLE_CLASSES.length);

  for (const appCar of app.VEHICLE_CLASSES) {
    const serverCar = server.VEHICLE_CLASSES.find((car) => car.type === appCar.type);
    assert.ok(serverCar, `${appCar.type} is missing on the server`);
    assert.equal(appCar.seats, serverCar.seats, `${appCar.type} seat count differs`);
    assert.equal(
      appCar.rateMultiplier,
      serverCar.rateMultiplier,
      `${appCar.type} rate multiplier differs`,
    );
  }
});

test('a whole vehicle is priced from distance, rate and class', () => {
  // Lagos → Ibadan is roughly 130 km. A sedan is the baseline: 130 × 450.
  const sedan = app.vehiclePriceNgn(130, 'SEDAN');
  assert.equal(sedan, 58_500);

  // Everything bigger costs more to run over the same road.
  assert.ok(app.vehiclePriceNgn(130, 'SUV') > sedan);
  assert.ok(app.vehiclePriceNgn(130, 'MINIBUS') > app.vehiclePriceNgn(130, 'SUV'));
  assert.ok(app.vehiclePriceNgn(130, 'BUS') > app.vehiclePriceNgn(130, 'MINIBUS'));
});

test('a seat gets cheaper as the vehicle gets bigger', () => {
  // The whole reason to share: a coach seat must undercut a sedan seat.
  const seats = app.VEHICLE_CLASSES.map((car) => app.seatPriceNgn(130, car.type));
  for (let i = 1; i < seats.length; i += 1) {
    assert.ok(
      seats[i] < seats[i - 1],
      `${app.VEHICLE_CLASSES[i].type} seats should undercut ${app.VEHICLE_CLASSES[i - 1].type}`,
    );
  }
});

test('a full vehicle of seats always covers what the vehicle costs to run', () => {
  // Rounding per seat must never round *down* past the vehicle price, or a
  // full trip sells for less than the fuel.
  for (const car of app.VEHICLE_CLASSES) {
    for (const km of [40, 130, 287, 611]) {
      assert.ok(
        app.seatPriceNgn(km, car.type) * car.seats >= app.vehiclePriceNgn(km, car.type),
        `${car.type} over ${km} km sells a full vehicle at a loss`,
      );
    }
  }
});

test('going alone pays for the vehicle; sharing pays for the seats', () => {
  const alone = app.priceForBooking({
    distanceKm: 130, vehicleType: 'MINIBUS', mode: 'alone', seats: 1,
  });
  const oneSeat = app.priceForBooking({
    distanceKm: 130, vehicleType: 'MINIBUS', mode: 'together', seats: 1,
  });

  assert.equal(alone, app.vehiclePriceNgn(130, 'MINIBUS'),
    'alone must charge for the whole vehicle regardless of the seats asked for');
  assert.ok(oneSeat < alone, 'one seat cannot cost what the whole bus costs');
  assert.equal(
    app.priceForBooking({ distanceKm: 130, vehicleType: 'MINIBUS', mode: 'together', seats: 3 }),
    oneSeat * 3,
  );
});

test('the app and the server agree on every price a rider can be shown', () => {
  for (const car of app.VEHICLE_CLASSES) {
    for (const km of [12, 130, 287, 611, 1024]) {
      assert.equal(app.vehiclePriceNgn(km, car.type), server.vehiclePriceNgn(km, car.type));
      assert.equal(app.seatPriceNgn(km, car.type), server.seatPriceNgn(km, car.type));
      for (const mode of ['alone', 'together']) {
        const args = { distanceKm: km, vehicleType: car.type, mode, seats: 2 };
        assert.equal(app.priceForBooking(args), server.priceForBooking(args),
          `${car.type} ${mode} over ${km} km differs between app and server`);
      }
    }
  }
});

test('a route with no distance prices at nothing rather than NaN', () => {
  for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(app.vehiclePriceNgn(bad, 'SEDAN'), 0);
    assert.equal(app.seatPriceNgn(bad, 'SEDAN'), 0);
  }
});

test('an unknown vehicle type falls back rather than crashing', () => {
  assert.equal(app.vehicleClass('SPACESHIP').type, 'SEDAN');
});

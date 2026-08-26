/**
 * Pickup resolution.
 *
 * The bug this guards: DEFAULT_PICKUP_LABEL used to be
 * "Current location • Lekki Phase 1", and the booking path geocodes the pickup
 * *string* — so every rider who did not retype their pickup was collected in
 * Lekki Phase 1 regardless of where they actually were.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'wheelers-route-')), 'ride-route.cjs');

execFileSync('npx', [
  'esbuild', join(projectRoot, 'lib/ride-route.ts'),
  '--bundle', '--platform=node', '--format=cjs', `--outfile=${outFile}`,
], { cwd: projectRoot, stdio: 'pipe' });

const {
  CURRENT_LOCATION_LABEL,
  DEFAULT_PICKUP_LABEL,
  isCurrentLocationLabel,
  normalizeRideItinerary,
} = createRequire(import.meta.url)(outFile);

test('the default pickup names no city', () => {
  assert.equal(DEFAULT_PICKUP_LABEL, CURRENT_LOCATION_LABEL);
  assert.doesNotMatch(DEFAULT_PICKUP_LABEL, /lekki|victoria|ikeja|lagos/i,
    'a hardcoded neighbourhood here silently books everyone from that spot');
});

test('an unset pickup is recognised as "use the device"', () => {
  for (const value of ['', '   ', 'Current location', 'current location', undefined, null]) {
    assert.equal(isCurrentLocationLabel(value), true, `expected sentinel for ${JSON.stringify(value)}`);
  }
  // The old label shape must still resolve to the device, not to Lekki.
  assert.equal(isCurrentLocationLabel('Current location • Lekki Phase 1'), true);
});

test('a real address is never mistaken for the device sentinel', () => {
  for (const value of ['Allen Avenue, Ikeja', '12 Admiralty Way, Lekki', 'Jibowu Terminal']) {
    assert.equal(isCurrentLocationLabel(value), false);
  }
});

test('normalising an empty itinerary leaves pickup on the device sentinel', () => {
  const itinerary = normalizeRideItinerary();
  assert.equal(isCurrentLocationLabel(itinerary.pickup), true);
});

test('an explicit pickup survives normalisation', () => {
  const itinerary = normalizeRideItinerary({ pickup: 'Allen Avenue, Ikeja', stops: ['Yaba'] });
  assert.equal(itinerary.pickup, 'Allen Avenue, Ikeja');
  assert.equal(isCurrentLocationLabel(itinerary.pickup), false);
});

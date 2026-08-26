/**
 * Where the rider app sends people, run against the real auth-state module.
 *
 * Signing in is the whole of onboarding: there is no phone-verification step,
 * so every signed-in rider goes to /rider. The migration case matters most —
 * anyone stored half-way through the old phone flow must land in the app, not
 * on a route that no longer exists.
 *
 *   node --test __tests__/rider-auth-routing.test.mjs
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
const outFile = join(mkdtempSync(join(tmpdir(), 'wheelers-auth-')), 'auth-state.cjs');

execFileSync(
  'npx',
  [
    'esbuild', join(projectRoot, 'lib/auth-state.ts'),
    '--bundle', '--platform=node', '--format=cjs',
    `--alias:expo-secure-store=${join(here, 'stubs/secure-store.cjs')}`,
    `--alias:@/lib/access-token=${join(here, 'stubs/access-token.cjs')}`,
    `--outfile=${outFile}`,
  ],
  { cwd: projectRoot, stdio: 'pipe' },
);

const req = createRequire(import.meta.url);
const {
  readStoredAuthState,
  persistAuthenticatedRole,
  clearStoredAuthState,
  getAuthenticatedRoute,
  getPostLoginRoute,
} = req(outFile);
const store = req(join(here, 'stubs/secure-store.cjs')).__store;

const KEY = 'wheelers.auth.state';
test.beforeEach(() => store.clear());

test('a fresh install has no session, so the entry screen shows', async () => {
  assert.equal(await readStoredAuthState(), null);
});

test('signing in as a rider goes straight to the app', async () => {
  const state = await persistAuthenticatedRole('RIDER');
  assert.equal(state.onboardingComplete, true, 'there is nothing left to onboard');
  assert.equal(getAuthenticatedRoute(state), '/rider');
  assert.equal(getPostLoginRoute('RIDER'), '/rider');

  const reread = await readStoredAuthState();
  assert.equal(getAuthenticatedRoute(reread), '/rider', 'still true after a restart');
});

test('a driver still lands in the driver app', async () => {
  const state = await persistAuthenticatedRole('DRIVER');
  assert.equal(getAuthenticatedRoute(state), '/driver/(tabs)/home');
  assert.equal(getPostLoginRoute('DRIVER'), '/driver/(tabs)/home');
});

test('someone mid-way through the removed phone flow is not stranded', async () => {
  // Exactly what the previous build left on a device.
  store.set(KEY, JSON.stringify({
    role: 'RIDER',
    onboardingComplete: false,
    onboardingRoute: '/otp-verify',
    pendingPhone: '+2348012345678',
    pendingOtpChannel: 'whatsapp',
  }));

  const state = await readStoredAuthState();
  assert.equal(state.onboardingRoute, '/rider', 'the old route no longer exists');
  assert.equal(state.onboardingComplete, true);
  assert.equal(getAuthenticatedRoute(state), '/rider');
  assert.equal(state.pendingPhone, undefined, 'the phone fields are gone from the shape');
});

test('a stored driver from the old build still routes to the driver app', async () => {
  store.set(KEY, JSON.stringify({
    role: 'DRIVER',
    onboardingComplete: false,
    onboardingRoute: '/phone-auth',
    pendingPhone: null,
  }));
  const state = await readStoredAuthState();
  assert.equal(getAuthenticatedRoute(state), '/driver/(tabs)/home');
});

test('corrupt or unknown stored state is treated as signed out', async () => {
  store.set(KEY, 'not json at all');
  assert.equal(await readStoredAuthState(), null);

  store.set(KEY, JSON.stringify({ role: 'ALIEN' }));
  assert.equal(await readStoredAuthState(), null);
});

test('signing out clears the session', async () => {
  await persistAuthenticatedRole('RIDER');
  await clearStoredAuthState();
  assert.equal(await readStoredAuthState(), null);
});

/**
 * What a rider actually reads when something fails.
 *
 * The bug class this guards: developer text escaping into the UI. Before this
 * layer existed, a rider whose phone dropped off Wi-Fi was told
 * "Could not reach the Wheelers backend. Configured API base URL: http://... If
 * you are testing on a physical device, use your computer LAN IP" — which is
 * advice for whoever is running the dev server, not for someone standing at a
 * motor park.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'wheelers-errors-')), 'errors.cjs');

execFileSync('npx', [
  'esbuild', join(projectRoot, 'lib/error-messages.ts'),
  '--bundle', '--platform=node', '--format=cjs',
  // __DEV__ is a React Native global; production is the case that matters here.
  '--define:__DEV__=false',
  `--outfile=${outFile}`,
], { cwd: projectRoot, stdio: 'pipe' });

const { describeError, toUserMessage } = createRequire(import.meta.url)(outFile);

/** Mirrors lib/api.ts's ApiError shape closely enough for the status branches. */
class FakeApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

test('a message written for a person survives untouched', () => {
  // The backend deliberately writes rider-facing copy. Rewriting it would be
  // a downgrade, so it must pass straight through.
  const kept = 'You need a Wheelers wallet before booking. Fund your account first.';
  assert.equal(toUserMessage(new Error(kept)), kept);
});

test('developer text never reaches the rider', () => {
  const developerMessages = [
    'EXPO_PUBLIC_API_BASE_URL is not configured.',
    'Cannot read property "lat" of undefined',
    'PrismaClientKnownRequestError: Unique constraint failed',
    'connect ECONNREFUSED 127.0.0.1:4000',
    'WebSocket closed before the connection was established',
    'JSON Parse error: Unexpected token <',
    'Missing required field: pickup',
    'TypeError: Network response was not ok',
  ];

  for (const message of developerMessages) {
    const shown = toUserMessage(new Error(message), 'We could not do that.');
    assert.equal(shown, 'We could not do that.',
      `"${message}" leaked to the user`);
    assert.doesNotMatch(shown, /EXPO_PUBLIC|prisma|ECONNREFUSED|undefined|TypeError/i);
  }
});

test('a bare HTTP status phrase is not a message', () => {
  // Seen in the wild: opening Travel before the routes were deployed showed a
  // rider the word "Not found" and nothing else.
  for (const phrase of [
    'Not found',
    'Bad Request',
    'Internal Server Error',
    'Unauthorized',
    'Request failed.',
    'Error',
  ]) {
    const shown = toUserMessage(new FakeApiError(phrase, 404), 'We could not load that.');
    assert.notEqual(shown, phrase, `"${phrase}" reached the user unchanged`);
    assert.ok(shown.length > phrase.length, 'the replacement should say more, not less');
  }
});

test('being offline says so, whatever phrasing it arrives in', () => {
  for (const message of [
    'Network request failed',
    'Could not reach the Wheelers backend.',
    'The request timed out',
  ]) {
    const shown = toUserMessage(new Error(message));
    assert.match(shown, /offline|connection/i, `"${message}" should read as connectivity`);
  }
});

test('HTTP statuses become next actions, not status codes', () => {
  const cases = [
    [401, /sign in/i],
    [403, /sign in/i],
    [404, /could not find/i],
    [409, /already changed|refresh/i],
    [429, /too many|wait/i],
    [500, /servers|try again/i],
    [503, /servers|try again/i],
  ];

  for (const [status, expected] of cases) {
    // A body with developer text forces the status branch.
    const error = new FakeApiError('Internal Server Error 500 internal', status);
    const shown = toUserMessage(error, 'Fallback.');
    assert.match(shown, expected, `status ${status} produced "${shown}"`);
    assert.doesNotMatch(shown, new RegExp(String(status)),
      'a raw status code is not something a rider can act on');
  }
});

test("an API error's own wording still wins when it was written for a person", () => {
  const error = new FakeApiError('Another driver has already taken this trip.', 409);
  assert.equal(toUserMessage(error), 'Another driver has already taken this trip.');
});

test('a wall of text is treated as a dump, not a message', () => {
  const stackDump = 'Error: something\n' + '    at Object.<anonymous> (/app/x.js:1:1)\n'.repeat(20);
  assert.equal(toUserMessage(new Error(stackDump), 'Please try again.'), 'Please try again.');
});

test('nothing at all still yields a sentence', () => {
  assert.equal(toUserMessage(null, 'Please try again.'), 'Please try again.');
  assert.equal(toUserMessage(undefined, 'Please try again.'), 'Please try again.');
  assert.equal(toUserMessage({}, 'Please try again.'), 'Please try again.');
  assert.equal(toUserMessage(new Error(''), 'Please try again.'), 'Please try again.');
});

test('retryable is set for the failures worth retrying', () => {
  assert.equal(describeError(new FakeApiError('boom', 500)).retryable, true);
  assert.equal(describeError(new FakeApiError('slow down', 429)).retryable, true);
  // A 409 means the world moved on; hammering the same call will not fix it.
  assert.equal(describeError(new FakeApiError('Already taken.', 409)).retryable, false);
});

/** Regenerate app icons + native splash mark from the brand SVG. */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('assets/brand/logo.svg', 'utf8');
const ORANGE = '#FF7700';
const GLYPH = svg.match(/<path[^>]*\/>|<path[\s\S]*?\/>/)?.[0] ?? '';

const squareTile = svg.replace(/rx="[^"]*"/, 'rx="0"');           // iOS masks its own corners
const glyphOnly = (fill) =>
  `<svg width="83" height="83" viewBox="-14 -14 111 111" xmlns="http://www.w3.org/2000/svg">${GLYPH.replace('#FFF8EC', fill)}</svg>`; // padded into the adaptive safe zone

async function png(svgText, size, out) {
  await sharp(Buffer.from(svgText)).resize(size, size).png().toFile(out);
  console.log('✓', out);
}

await png(squareTile, 1024, 'assets/images/icon.png');
await png(svg, 512, 'assets/images/splash-logo.png');
await png(glyphOnly('#FFF8EC'), 1024, 'assets/images/android-icon-foreground.png');
await png(glyphOnly('#FFFFFF'), 1024, 'assets/images/android-icon-monochrome.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: ORANGE } })
  .png().toFile('assets/images/android-icon-background.png');
console.log('✓ assets/images/android-icon-background.png');

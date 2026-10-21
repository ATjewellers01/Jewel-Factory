/**
 * One-off generator for the PWA icons + iOS splash screens, from the gold
 * "JF" monogram in public/logo-icon.png. Outputs are committed, so this only
 * needs re-running when the logo or brand colour changes:
 *
 *   pnpm generate:pwa-assets
 *
 * Keep SPLASH_SCREENS in sync with lib/pwa-splash.ts (which emits the
 * matching <link rel="apple-touch-startup-image"> tags).
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { PWA_BACKGROUND, SPLASH_SCREENS, splashFileName } from '../lib/pwa-splash';

const ROOT = path.resolve(__dirname, '..');
const LOGO = path.join(ROOT, 'public/logo-icon.png');
const ICON_DIR = path.join(ROOT, 'public/icons');
const SPLASH_DIR = path.join(ROOT, 'public/splash');

// Logo centred on a solid brand square. `scale` is the logo's share of the
// canvas — maskable icons keep it inside Android's 80% safe zone.
async function square(size: number, scale: number, out: string) {
  const logoSize = Math.round(size * scale);
  const logo = await sharp(LOGO).resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: PWA_BACKGROUND } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
}

async function splash(width: number, height: number, out: string) {
  const logoSize = Math.round(Math.min(width, height) * 0.32);
  const logo = await sharp(LOGO).resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width, height, channels: 3, background: PWA_BACKGROUND } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(out);
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true });
  await mkdir(SPLASH_DIR, { recursive: true });

  await square(192, 0.72, path.join(ICON_DIR, 'icon-192.png'));
  await square(512, 0.72, path.join(ICON_DIR, 'icon-512.png'));
  await square(512, 0.6, path.join(ICON_DIR, 'icon-maskable-512.png'));
  await square(180, 0.72, path.join(ICON_DIR, 'apple-touch-icon-180.png'));

  for (const screen of SPLASH_SCREENS) {
    await splash(screen.width * screen.ratio, screen.height * screen.ratio, path.join(SPLASH_DIR, splashFileName(screen)));
  }
  console.log(`Wrote 4 icons + ${SPLASH_SCREENS.length} splash screens.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

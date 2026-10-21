// Shared by app/layout.tsx (apple-touch-startup-image tags) and
// scripts/generate_pwa_assets.ts (the PNGs themselves). iOS only shows a
// splash whose pixel size matches the device exactly, so each entry is one
// device class in portrait, as CSS width x height @ device pixel ratio.

export const PWA_THEME_COLOR = '#17120b';
export const PWA_BACKGROUND = '#17120b';

export type SplashScreen = { width: number; height: number; ratio: number };

export const SPLASH_SCREENS: SplashScreen[] = [
  { width: 440, height: 956, ratio: 3 }, // iPhone 16 Pro Max
  { width: 402, height: 874, ratio: 3 }, // iPhone 16 Pro
  { width: 430, height: 932, ratio: 3 }, // iPhone 14/15 Pro Max, 15/16 Plus
  { width: 393, height: 852, ratio: 3 }, // iPhone 14/15 Pro, 15, 16
  { width: 428, height: 926, ratio: 3 }, // iPhone 12/13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // iPhone 12/13/14, 12/13 Pro
  { width: 375, height: 812, ratio: 3 }, // iPhone X/XS/11 Pro, 12/13 mini
  { width: 414, height: 896, ratio: 3 }, // iPhone XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // iPhone XR, 11
  { width: 375, height: 667, ratio: 2 }, // iPhone SE, 6/7/8
  { width: 1024, height: 1366, ratio: 2 }, // iPad Pro 12.9"
  { width: 834, height: 1194, ratio: 2 }, // iPad Pro 11"
  { width: 820, height: 1180, ratio: 2 }, // iPad Air, iPad 10th gen
  { width: 768, height: 1024, ratio: 2 }, // iPad mini, older iPads
];

export function splashFileName({ width, height, ratio }: SplashScreen) {
  return `splash-${width * ratio}x${height * ratio}.png`;
}

export function splashMedia({ width, height, ratio }: SplashScreen) {
  return `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`;
}

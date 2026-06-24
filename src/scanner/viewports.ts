import type { ViewportConfig, ViewportKey } from "./types.js";

export const VIEWPORTS: ViewportConfig[] = [
  {
    key: "mobile",
    label: "Mobile",
    width: 390,
    devicePixelRatio: 2,
    icon: "📱",
  },
  {
    key: "tablet",
    label: "Tablet",
    width: 768,
    devicePixelRatio: 2,
    icon: "📱",
  },
  {
    key: "desktop",
    label: "Desktop",
    width: 1280,
    devicePixelRatio: 1.5,
    icon: "🖥️",
  },
];

export function getViewport(key: ViewportKey): ViewportConfig {
  const viewport = VIEWPORTS.find((v) => v.key === key);
  if (!viewport) {
    throw new Error(`Unknown viewport: ${key}`);
  }
  return viewport;
}

/** Rough mobile download speed for time-to-load estimates (bytes per ms). */
export const MOBILE_BYTES_PER_MS = 40_000 / 1000; // ~40 KB/s on 3G-ish

export function estimateLoadDelayMs(bytes: number): number {
  return Math.round(bytes / MOBILE_BYTES_PER_MS);
}

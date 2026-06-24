import type { ImageCandidate } from "./types.js";

export function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

export function parseSrcset(srcset: string): ImageCandidate[] {
  if (!srcset.trim()) return [];

  return srcset
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1] ?? "";

      if (descriptor.endsWith("w")) {
        return { url, width: parseInt(descriptor, 10) };
      }
      if (descriptor.endsWith("x")) {
        return { url, density: parseFloat(descriptor) };
      }
      return { url };
    });
}

/**
 * Compute rendered slot width (CSS px) for a viewport given a sizes attribute.
 * Supports common patterns; falls back to 100vw when unknown.
 */
export function computeSlotWidth(
  sizes: string,
  viewportWidth: number,
  widthAttr?: number,
): number {
  if (widthAttr && widthAttr > 0) {
    return Math.min(widthAttr, viewportWidth);
  }

  const normalized = sizes.trim();
  if (!normalized || normalized === "auto") {
    return viewportWidth;
  }

  const candidates = normalized.split(",").map((s) => s.trim());
  let fallback = viewportWidth;

  for (let i = candidates.length - 1; i >= 0; i--) {
    const part = candidates[i];
    const spaceIdx = part.lastIndexOf(" ");
    const condition = spaceIdx > 0 ? part.slice(0, spaceIdx).trim() : "";
    const size = spaceIdx > 0 ? part.slice(spaceIdx + 1).trim() : part;

    if (!condition) {
      fallback = parseSizeValue(size, viewportWidth);
      break;
    }

    if (matchesMedia(condition, viewportWidth)) {
      return parseSizeValue(size, viewportWidth);
    }
  }

  return fallback;
}

function parseSizeValue(size: string, viewportWidth: number): number {
  if (size.endsWith("vw")) {
    return (parseFloat(size) / 100) * viewportWidth;
  }
  if (size.endsWith("px")) {
    return parseFloat(size);
  }
  if (size.endsWith("rem")) {
    return parseFloat(size) * 16;
  }
  if (size.endsWith("em")) {
    return parseFloat(size) * 16;
  }
  if (size.endsWith("%")) {
    return (parseFloat(size) / 100) * viewportWidth;
  }
  if (size === "auto") {
    return viewportWidth;
  }
  const numeric = parseFloat(size);
  return Number.isFinite(numeric) ? numeric : viewportWidth;
}

function matchesMedia(condition: string, viewportWidth: number): boolean {
  const maxMatch = condition.match(/\(max-width:\s*(\d+)px\)/);
  if (maxMatch) {
    return viewportWidth <= parseInt(maxMatch[1], 10);
  }

  const minMatch = condition.match(/\(min-width:\s*(\d+)px\)/);
  if (minMatch) {
    return viewportWidth >= parseInt(minMatch[1], 10);
  }

  return false;
}

/**
 * Select the image candidate a browser would pick from a w-descriptor srcset.
 */
export function selectFromSrcset(
  candidates: ImageCandidate[],
  slotWidth: number,
  dpr: number,
): ImageCandidate | null {
  const withWidth = candidates.filter((c) => c.width && c.width > 0);
  if (withWidth.length === 0) {
    return candidates[0] ?? null;
  }

  const target = slotWidth * dpr;
  const sorted = [...withWidth].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));

  const adequate = sorted.find((c) => (c.width ?? 0) >= target);
  return adequate ?? sorted[sorted.length - 1];
}

export function detectFormat(url: string): string {
  const path = url.split("?")[0].split("#")[0].toLowerCase();
  if (path.endsWith(".webp")) return "webp";
  if (path.endsWith(".avif")) return "avif";
  if (path.endsWith(".png")) return "png";
  if (path.endsWith(".gif")) return "gif";
  if (path.endsWith(".svg")) return "svg";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "jpeg";
  return "unknown";
}

export function estimateBytesForWidth(
  baseBytes: number,
  baseWidth: number,
  targetWidth: number,
): number {
  if (baseWidth <= 0 || targetWidth <= 0) return baseBytes;
  const ratio = Math.min(1, targetWidth / baseWidth);
  return Math.round(baseBytes * ratio * ratio);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

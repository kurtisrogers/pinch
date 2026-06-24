import JSZip from "jszip";
import {
  baseName,
  encodeImage,
  extensionForFormat,
  loadImageFromFile,
} from "./compress.js";
import type {
  OptimizeOptions,
  OptimizeProgress,
  OptimizeResult,
  OptimizedVariant,
  ResponsiveWidths,
} from "./types.js";
import { DEFAULT_WIDTHS } from "./types.js";

type ProgressCallback = (progress: OptimizeProgress) => void;

export async function optimizeImageFile(
  file: File,
  options: OptimizeOptions,
  onProgress: ProgressCallback,
): Promise<OptimizeResult> {
  onProgress({ phase: "loading", message: "Shaking the pixels loose…" });

  const img = await loadImageFromFile(file);
  const stem = baseName(file.name);
  const ext = extensionForFormat(options.format);

  const widths = buildWidthPlan(
    img.naturalWidth,
    options.responsive,
    options.widths,
  );

  const variants: OptimizedVariant[] = [];

  for (let i = 0; i < widths.length; i++) {
    const { label, width } = widths[i];
    onProgress({
      phase: "processing",
      message: `Crushing ${label} (${width}px)…`,
      current: i + 1,
      total: widths.length,
    });

    const { blob, height } = await encodeImage(
      img,
      width,
      options.format,
      options.quality,
    );

    const suffix = options.responsive ? `-${label}-${width}w` : "";
    variants.push({
      label,
      width,
      height,
      blob,
      byteSize: blob.size,
      filename: `${stem}${suffix}.${ext}`,
    });
  }

  const originalBytes = file.size;
  const best = variants.reduce((a, b) => (a.byteSize < b.byteSize ? a : b));
  const savedBytes = Math.max(0, originalBytes - best.byteSize);
  const savedPercent = originalBytes > 0 ? (savedBytes / originalBytes) * 100 : 0;

  onProgress({ phase: "complete", message: "Cheers — optimization complete!" });

  return {
    fileName: file.name,
    originalBytes,
    originalWidth: img.naturalWidth,
    originalHeight: img.naturalHeight,
    variants,
    srcsetSnippet: buildSrcsetSnippet(stem, ext, variants),
    savedBytes,
    savedPercent,
  };
}

function buildWidthPlan(
  naturalWidth: number,
  responsive: boolean,
  widths: ResponsiveWidths,
): Array<{ label: string; width: number }> {
  if (!responsive) {
    return [{ label: "full", width: naturalWidth }];
  }

  const plan = [
    { label: "mobile", width: widths.mobile },
    { label: "tablet", width: widths.tablet },
    { label: "desktop", width: widths.desktop },
  ];

  const seen = new Set<number>();
  return plan
    .map((entry) => ({
      ...entry,
      width: Math.min(entry.width, naturalWidth),
    }))
    .filter((entry) => {
      if (seen.has(entry.width)) return false;
      seen.add(entry.width);
      return true;
    });
}

function buildSrcsetSnippet(
  stem: string,
  ext: string,
  variants: OptimizedVariant[],
): string {
  const srcset = variants.map((v) => `${stem}-${v.label}-${v.width}w.${ext} ${v.width}w`).join(",\n  ");
  return `<img
  src="${stem}-desktop-${variants[variants.length - 1]?.width ?? ""}w.${ext}"
  srcset="
  ${srcset}"
  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
  alt=""
/>`;
}

export async function downloadVariant(variant: OptimizedVariant): Promise<void> {
  triggerDownload(variant.blob, variant.filename);
}

export async function downloadAllAsZip(
  result: OptimizeResult,
  format: string,
): Promise<void> {
  const zip = new JSZip();
  for (const variant of result.variants) {
    zip.file(variant.filename, variant.blob);
  }
  zip.file("srcset.html", result.srcsetSnippet);
  zip.file(
    "README.txt",
    `Pinch responsive image set\nOriginal: ${result.fileName}\nFormat: ${format}\n\nDrop these files in your project and use srcset.html as a starting point.`,
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const stem = baseName(result.fileName);
  triggerDownload(blob, `${stem}-responsive-set.zip`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { DEFAULT_WIDTHS };

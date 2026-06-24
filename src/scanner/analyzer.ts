import { loadImageViaProxy } from "./fetcher.js";
import type {
  ImageAnalysis,
  ImageMetadata,
  ParsedImage,
  ScanProgress,
  ScanSummary,
  ViewportAnalysis,
  ViewportKey,
} from "./types.js";
import {
  computeSlotWidth,
  detectFormat,
  estimateBytesForWidth,
  resolveUrl,
  selectFromSrcset,
} from "./utils.js";
import { estimateLoadDelayMs, getViewport, VIEWPORTS } from "./viewports.js";
import { countInlineBackgroundImages, parseImagesFromHtml } from "./parser.js";
import { fetchHtml, normalizeUrl } from "./fetcher.js";

type ProgressCallback = (progress: ScanProgress) => void;

export async function scanPage(
  inputUrl: string,
  onProgress: ProgressCallback,
): Promise<ScanSummary> {
  const url = normalizeUrl(inputUrl);

  onProgress({ phase: "fetching", message: "Fetching page HTML…" });
  const html = await fetchHtml(url);

  onProgress({ phase: "parsing", message: "Parsing images…" });
  const parsedImages = parseImagesFromHtml(html, url);
  const bgCount = countInlineBackgroundImages(html);

  if (parsedImages.length === 0) {
    throw new Error(
      bgCount > 0
        ? `Found ${bgCount} CSS background image(s) but no <img> tags to analyze.`
        : "No analyzable images found on this page.",
    );
  }

  const images: ImageAnalysis[] = [];

  for (let i = 0; i < parsedImages.length; i++) {
    onProgress({
      phase: "analyzing",
      message: `Analyzing image ${i + 1} of ${parsedImages.length}…`,
      current: i + 1,
      total: parsedImages.length,
    });

    try {
      const analysis = await analyzeImage(parsedImages[i], url);
      images.push(analysis);
    } catch {
      // Skip images we can't load (broken URLs, unsupported formats)
    }
  }

  if (images.length === 0) {
    throw new Error("Could not load any images from this page for analysis.");
  }

  const summary = buildSummary(url, images);

  onProgress({ phase: "complete", message: "Scan complete" });
  return summary;
}

async function analyzeImage(
  parsed: ParsedImage,
  pageUrl: string,
): Promise<ImageAnalysis> {
  const metadata = await loadImageMetadata(parsed.src);
  const viewports = VIEWPORTS.map((vp) =>
    analyzeForViewport(parsed, metadata, vp.key, pageUrl),
  );

  const avgWaste =
    viewports.reduce((sum, v) => sum + v.wastePercent, 0) / viewports.length;

  return {
    parsed,
    metadata,
    viewports,
    totalWastePercent: avgWaste,
    recommendations: buildRecommendations(parsed, metadata, viewports),
  };
}

async function loadImageMetadata(url: string): Promise<ImageMetadata> {
  const { width, height, byteSize } = await loadImageViaProxy(url);
  return {
    url,
    naturalWidth: width,
    naturalHeight: height,
    byteSize,
    format: detectFormat(url),
  };
}

function analyzeForViewport(
  parsed: ParsedImage,
  metadata: ImageMetadata,
  viewportKey: ViewportKey,
  pageUrl: string,
): ViewportAnalysis {
  const vp = getViewport(viewportKey);
  const issues: string[] = [];

  const { srcset, sizes } = resolveEffectiveSrcset(parsed, vp.width);
  const slotWidth = computeSlotWidth(
    sizes,
    vp.width,
    parsed.widthAttr,
  );
  const neededWidth = Math.ceil(slotWidth * vp.devicePixelRatio);
  const aspect =
    metadata.naturalHeight > 0
      ? metadata.naturalHeight / metadata.naturalWidth
      : 1;
  const displayHeight = Math.round(slotWidth * aspect);

  let selectedUrl = parsed.src;
  let selectedWidth = metadata.naturalWidth;
  let actualBytes = metadata.byteSize;
  let isResponsive = parsed.srcset.length > 0 || parsed.inPicture;

  if (metadata.format === "svg") {
    return {
      viewport: viewportKey,
      displayWidth: Math.round(slotWidth),
      displayHeight,
      selectedUrl,
      selectedWidth: metadata.naturalWidth,
      neededWidth,
      actualBytes,
      optimalBytes: actualBytes,
      wastedBytes: 0,
      wastePercent: 0,
      isResponsive: true,
      issues: ["SVG scales cleanly — no raster waste"],
    };
  }

  if (srcset.length > 0) {
    const selected = selectFromSrcset(srcset, slotWidth, vp.devicePixelRatio);
    if (selected) {
      selectedUrl = resolveUrl(pageUrl, selected.url);
      selectedWidth = selected.width ?? metadata.naturalWidth;
      if (selected.width && selected.width !== metadata.naturalWidth) {
        actualBytes = estimateBytesForWidth(
          metadata.byteSize,
          metadata.naturalWidth,
          selected.width,
        );
      }
    }
  } else {
    issues.push("No srcset — full-resolution image served to all devices");
  }

  if (!parsed.sizes && !parsed.widthAttr && parsed.srcset.length > 0) {
    issues.push("Missing sizes attribute — browser assumes 100vw");
  }

  if (!parsed.loading || parsed.loading !== "lazy") {
    issues.push("Consider loading=\"lazy\" for below-fold images");
  }

  if (selectedWidth > neededWidth * 1.25) {
    const overserveRatio = selectedWidth / neededWidth;
    issues.push(
      `Serving ${selectedWidth}px image for ${neededWidth}px slot (${overserveRatio.toFixed(1)}× overserved)`,
    );
  }

  const optimalWidth = Math.min(neededWidth, metadata.naturalWidth);
  const optimalBytes = estimateBytesForWidth(
    metadata.byteSize,
    metadata.naturalWidth,
    optimalWidth,
  );

  const wastedBytes = Math.max(0, actualBytes - optimalBytes);
  const wastePercent =
    actualBytes > 0 ? (wastedBytes / actualBytes) * 100 : 0;

  if (wastePercent < 5 && isResponsive) {
    issues.length = 0;
    issues.push("Well optimized for this viewport");
  }

  return {
    viewport: viewportKey,
    displayWidth: Math.round(slotWidth),
    displayHeight,
    selectedUrl,
    selectedWidth,
    neededWidth,
    actualBytes,
    optimalBytes,
    wastedBytes,
    wastePercent,
    isResponsive,
    issues,
  };
}

function resolveEffectiveSrcset(
  parsed: ParsedImage,
  viewportWidth: number,
): { srcset: ParsedImage["srcset"]; sizes: string } {
  if (parsed.inPicture && parsed.pictureSources.length > 0) {
    for (const source of parsed.pictureSources) {
      if (!source.media || matchesViewportMedia(source.media, viewportWidth)) {
        if (source.srcset.length > 0) {
          return { srcset: source.srcset, sizes: source.sizes || parsed.sizes };
        }
      }
    }
  }

  return { srcset: parsed.srcset, sizes: parsed.sizes };
}

function matchesViewportMedia(media: string, viewportWidth: number): boolean {
  const maxMatch = media.match(/\(max-width:\s*(\d+)px\)/);
  if (maxMatch) return viewportWidth <= parseInt(maxMatch[1], 10);

  const minMatch = media.match(/\(min-width:\s*(\d+)px\)/);
  if (minMatch) return viewportWidth >= parseInt(minMatch[1], 10);

  return true;
}

function buildRecommendations(
  parsed: ParsedImage,
  metadata: ImageMetadata,
  viewports: ViewportAnalysis[],
): string[] {
  const recs: string[] = [];

  if (parsed.srcset.length === 0 && metadata.naturalWidth > 800) {
    recs.push(
      `Add srcset with widths around ${viewports.map((v) => v.neededWidth).join(", ")}px`,
    );
  }

  if (!parsed.sizes && parsed.srcset.length > 0) {
    recs.push('Add a sizes attribute describing rendered width (e.g. sizes="(max-width: 768px) 100vw, 50vw")');
  }

  if (metadata.format === "jpeg" || metadata.format === "png") {
    recs.push("Serve WebP or AVIF versions via <picture> for 25–50% smaller files");
  }

  if (parsed.inPicture && parsed.pictureSources.every((s) => !s.type)) {
    recs.push("Use <source type=\"image/webp\"> for modern format fallbacks");
  }

  const highWaste = viewports.filter((v) => v.wastePercent > 30);
  if (highWaste.length > 0) {
    recs.push(
      `Biggest savings on ${highWaste.map((v) => v.viewport).join(" & ")} — prioritize srcset widths near ${highWaste.map((v) => v.neededWidth).join("/")}px`,
    );
  }

  return [...new Set(recs)];
}

function buildSummary(url: string, images: ImageAnalysis[]): ScanSummary {
  const byViewport = {} as ScanSummary["byViewport"];

  for (const vp of VIEWPORTS) {
    let totalBytes = 0;
    let optimalBytes = 0;
    let imagesWithWaste = 0;

    for (const img of images) {
      const analysis = img.viewports.find((v) => v.viewport === vp.key);
      if (!analysis) continue;
      totalBytes += analysis.actualBytes;
      optimalBytes += analysis.optimalBytes;
      if (analysis.wastedBytes > 0) imagesWithWaste++;
    }

    const wastedBytes = totalBytes - optimalBytes;
    byViewport[vp.key] = {
      totalBytes,
      optimalBytes,
      wastedBytes,
      wastePercent: totalBytes > 0 ? (wastedBytes / totalBytes) * 100 : 0,
      imagesWithWaste,
    };
  }

  const totalBytes = images.reduce((sum, img) => sum + img.metadata.byteSize, 0);
  const pageLoadImpactMs = {} as ScanSummary["pageLoadImpactMs"];

  for (const vp of VIEWPORTS) {
    pageLoadImpactMs[vp.key] = estimateLoadDelayMs(byViewport[vp.key].wastedBytes);
  }

  return {
    url,
    scannedAt: new Date().toISOString(),
    imageCount: images.length,
    totalBytes,
    byViewport,
    images: images.sort((a, b) => b.totalWastePercent - a.totalWastePercent),
    pageLoadImpactMs,
  };
}

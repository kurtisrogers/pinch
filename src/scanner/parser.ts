import type { ParsedImage, PictureSource } from "./types.js";
import { getBaseUrl } from "./fetcher.js";
import { parseSrcset, resolveUrl } from "./utils.js";

export function parseImagesFromHtml(html: string, pageUrl: string): ParsedImage[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const baseUrl = getBaseUrl(pageUrl);
  const results: ParsedImage[] = [];
  let counter = 0;

  const pictures = doc.querySelectorAll("picture");
  const imgsInPicture = new Set<Element>();

  pictures.forEach((picture) => {
    const img = picture.querySelector("img");
    if (!img) return;

    imgsInPicture.add(img);
    const sources: PictureSource[] = [];

    picture.querySelectorAll("source").forEach((source) => {
      sources.push({
        srcset: parseSrcset(source.getAttribute("srcset") ?? ""),
        sizes: source.getAttribute("sizes") ?? "",
        media: source.getAttribute("media") ?? "",
        type: source.getAttribute("type") ?? "",
      });
    });

    const src = img.getAttribute("src") ?? img.getAttribute("data-src") ?? "";
    if (!src) return;

    results.push(buildParsedImage(`img-${counter++}`, img, src, baseUrl, true, sources));
  });

  doc.querySelectorAll("img").forEach((img) => {
    if (imgsInPicture.has(img)) return;

    const src = img.getAttribute("src") ?? img.getAttribute("data-src") ?? "";
    if (!src || src.startsWith("data:")) return;

    results.push(buildParsedImage(`img-${counter++}`, img, src, baseUrl, false, []));
  });

  return dedupeBySrc(results);
}

function buildParsedImage(
  id: string,
  img: Element,
  src: string,
  baseUrl: string,
  inPicture: boolean,
  pictureSources: PictureSource[],
): ParsedImage {
  const widthAttr = parseOptionalInt(img.getAttribute("width"));
  const heightAttr = parseOptionalInt(img.getAttribute("height"));

  return {
    id,
    src: resolveUrl(baseUrl, src),
    srcset: parseSrcset(img.getAttribute("srcset") ?? ""),
    sizes: img.getAttribute("sizes") ?? "",
    widthAttr,
    heightAttr,
    alt: img.getAttribute("alt") ?? "",
    loading: img.getAttribute("loading") ?? undefined,
    inPicture,
    pictureSources,
    element: inPicture ? "picture" : "img",
  };
}

function parseOptionalInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dedupeBySrc(images: ParsedImage[]): ParsedImage[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    if (seen.has(img.src)) return false;
    seen.add(img.src);
    return true;
  });
}

export function countInlineBackgroundImages(html: string): number {
  const matches = html.match(/background-image\s*:\s*url\(/gi);
  return matches?.length ?? 0;
}

import { GIFEncoder, applyPalette, quantize } from "gifenc";
import type { ExportFormat } from "./types.js";

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImageFromUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}

export function scaledHeight(sourceWidth: number, sourceHeight: number, targetWidth: number): number {
  return Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth));
}

export async function encodeImage(
  img: HTMLImageElement,
  targetWidth: number,
  format: ExportFormat,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const height = scaledHeight(img.naturalWidth, img.naturalHeight, targetWidth);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(img, 0, 0, targetWidth, height);

  if (format === "gif") {
    const blob = encodeGif(canvas, ctx);
    return { blob, width: targetWidth, height };
  }

  const mime = mimeForFormat(format);
  const blob = await canvasToBlob(canvas, mime, quality / 100);
  return { blob, width: targetWidth, height };
}

function mimeForFormat(format: ExportFormat): string {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Failed to encode ${mime}`))),
      mime,
      quality,
    );
  });
}

function encodeGif(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Blob {
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const palette = quantize(data, 256);
  const index = applyPalette(data, palette);

  const gif = GIFEncoder();
  gif.writeFrame(index, width, height, { palette, delay: 0 });
  gif.finish();

  return new Blob([new Uint8Array(gif.bytes())], { type: "image/gif" });
}

export function extensionForFormat(format: ExportFormat): string {
  switch (format) {
    case "jpeg":
      return "jpg";
    case "webp":
      return "webp";
    case "png":
      return "png";
    case "gif":
      return "gif";
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}

export function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-") || "image";
}

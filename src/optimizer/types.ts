export type ExportFormat = "png" | "jpeg" | "webp" | "gif";

export interface ResponsiveWidths {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface OptimizeOptions {
  format: ExportFormat;
  quality: number;
  responsive: boolean;
  widths: ResponsiveWidths;
}

export interface OptimizedVariant {
  label: string;
  width: number;
  height: number;
  blob: Blob;
  byteSize: number;
  filename: string;
}

export interface OptimizeResult {
  fileName: string;
  originalBytes: number;
  originalWidth: number;
  originalHeight: number;
  variants: OptimizedVariant[];
  srcsetSnippet: string;
  savedBytes: number;
  savedPercent: number;
}

export interface OptimizeProgress {
  phase: "loading" | "processing" | "complete" | "error";
  message: string;
  current?: number;
  total?: number;
}

export const DEFAULT_WIDTHS: ResponsiveWidths = {
  mobile: 780,
  tablet: 1536,
  desktop: 1920,
};

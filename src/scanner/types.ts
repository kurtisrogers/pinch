export type ViewportKey = "mobile" | "tablet" | "desktop";

export interface ViewportConfig {
  key: ViewportKey;
  label: string;
  width: number;
  devicePixelRatio: number;
  icon: string;
}

export interface ImageCandidate {
  url: string;
  width?: number;
  density?: number;
}

export interface ParsedImage {
  id: string;
  src: string;
  srcset: ImageCandidate[];
  sizes: string;
  widthAttr?: number;
  heightAttr?: number;
  alt: string;
  loading?: string;
  inPicture: boolean;
  pictureSources: PictureSource[];
  element: "img" | "picture";
}

export interface PictureSource {
  srcset: ImageCandidate[];
  sizes: string;
  media: string;
  type: string;
}

export interface ImageMetadata {
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  byteSize: number;
  format: string;
}

export interface ViewportAnalysis {
  viewport: ViewportKey;
  displayWidth: number;
  displayHeight: number;
  selectedUrl: string;
  selectedWidth: number;
  neededWidth: number;
  actualBytes: number;
  optimalBytes: number;
  wastedBytes: number;
  wastePercent: number;
  isResponsive: boolean;
  issues: string[];
}

export interface ImageAnalysis {
  parsed: ParsedImage;
  metadata: ImageMetadata;
  viewports: ViewportAnalysis[];
  totalWastePercent: number;
  recommendations: string[];
}

export interface ScanSummary {
  url: string;
  scannedAt: string;
  imageCount: number;
  totalBytes: number;
  byViewport: Record<
    ViewportKey,
    {
      totalBytes: number;
      optimalBytes: number;
      wastedBytes: number;
      wastePercent: number;
      imagesWithWaste: number;
    }
  >;
  images: ImageAnalysis[];
  pageLoadImpactMs: Record<ViewportKey, number>;
}

export interface ScanProgress {
  phase: "fetching" | "parsing" | "analyzing" | "complete" | "error";
  message: string;
  current?: number;
  total?: number;
}

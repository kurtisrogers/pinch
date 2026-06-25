export type DevSeverity = "error" | "warning" | "info";

export interface DevFinding {
  id: string;
  category: string;
  severity: DevSeverity;
  title: string;
  description: string;
  detail?: string;
}

export interface PageContext {
  url: string;
  html: string;
  headers: Record<string, string>;
  doc: Document;
}

export interface DevAuditReport {
  url: string;
  scannedAt: string;
  sections: DevReportSection[];
  ogPreview?: OgPreview;
}

export interface DevReportSection {
  id: string;
  title: string;
  icon: string;
  findings: DevFinding[];
}

export interface OgPreview {
  title: string;
  description: string;
  image?: string;
  url: string;
  siteName?: string;
}

export interface CrawlPlusReport {
  spider: import("../spider/types.js").SpiderReport;
  redirects: DevFinding[];
  mixedContent: DevFinding[];
  sitemap: DevFinding[];
  componentDrift: DevFinding[];
}

export interface HarSummary {
  fileName: string;
  entryCount: number;
  totalBytes: number;
  domains: Array<{ domain: string; count: number; bytes: number }>;
  slowest: Array<{ url: string; durationMs: number }>;
  findings: DevFinding[];
}

export interface DiffResult {
  url: string;
  baselineDate: string;
  currentDate: string;
  changes: DevFinding[];
}

export interface StoredBaseline {
  url: string;
  savedAt: string;
  report: DevAuditReport;
}

export interface DevProgress {
  phase: string;
  message: string;
  current?: number;
  total?: number;
}

export interface CrawlOptions {
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  sameOrigin: boolean;
}

export type LinkZone = "content" | "navigation" | "footer" | "other";

export interface ParsedLink {
  href: string;
  absoluteUrl: string;
  anchorText: string;
  zone: LinkZone;
}

export interface CrawledPage {
  url: string;
  depth: number;
  title: string;
  links: ParsedLink[];
  fetchError?: string;
}

export type LinkStatus =
  | "ok"
  | "dead"
  | "redirect"
  | "skipped"
  | "error";

export interface CheckedLink {
  sourcePage: string;
  href: string;
  absoluteUrl: string;
  anchorText: string;
  zone: LinkZone;
  status: LinkStatus;
  httpStatus?: number;
  message?: string;
}

export interface SpiderProgress {
  phase: "crawling" | "checking" | "complete" | "error";
  message: string;
  current?: number;
  total?: number;
}

export interface SpiderReport {
  startUrl: string;
  scannedAt: string;
  options: CrawlOptions;
  pages: CrawledPage[];
  links: CheckedLink[];
  summary: {
    pagesCrawled: number;
    linksFound: number;
    linksChecked: number;
    deadLinks: number;
    okLinks: number;
    skippedLinks: number;
    errorLinks: number;
  };
}

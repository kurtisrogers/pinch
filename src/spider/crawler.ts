import { fetchHtml, normalizeUrl } from "../scanner/fetcher.js";
import type { CrawlOptions, CrawledPage, SpiderProgress } from "./types.js";
import {
  canonicalizeUrl,
  extractInternalLinks,
  extractLinks,
  extractPageTitle,
  isSameOrigin,
} from "./parser.js";

type ProgressCallback = (progress: SpiderProgress) => void;

interface QueueItem {
  url: string;
  depth: number;
}

export async function crawlSite(
  inputUrl: string,
  options: Omit<CrawlOptions, "startUrl">,
  onProgress: ProgressCallback,
): Promise<CrawledPage[]> {
  const startUrl = normalizeUrl(inputUrl);
  const startOrigin = new URL(startUrl).origin;
  const startCanonical = canonicalizeUrl(startUrl);

  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  const queue: QueueItem[] = [{ url: startCanonical, depth: 0 }];

  while (queue.length > 0 && pages.length < options.maxPages) {
    const item = queue.shift()!;
    if (visited.has(item.url)) continue;
    visited.add(item.url);

    onProgress({
      phase: "crawling",
      message: `Crawling page ${pages.length + 1} (depth ${item.depth}): ${truncate(item.url, 60)}`,
      current: pages.length + 1,
      total: Math.min(options.maxPages, pages.length + queue.length + 1),
    });

    let html = "";
    let fetchError: string | undefined;

    try {
      html = await fetchHtml(item.url);
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Fetch failed";
    }

    const links = html ? extractLinks(html, item.url) : [];
    const title = html ? extractPageTitle(html) : "";

    pages.push({
      url: item.url,
      depth: item.depth,
      title,
      links,
      fetchError,
    });

    if (html && item.depth < options.maxDepth) {
      const internal = extractInternalLinks(
        links,
        startOrigin,
        options.sameOrigin,
      );

      for (const nextUrl of internal) {
        if (visited.has(nextUrl)) continue;
        if (!options.sameOrigin || isSameOrigin(nextUrl, startOrigin)) {
          queue.push({ url: nextUrl, depth: item.depth + 1 });
        }
      }
    }

    await delay(200);
  }

  return pages;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

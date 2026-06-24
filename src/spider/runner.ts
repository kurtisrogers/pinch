import { crawlSite } from "./crawler.js";
import { checkLinks, isDeadLink } from "./link-checker.js";
import type { CrawlOptions, SpiderProgress, SpiderReport } from "./types.js";
import { normalizeUrl } from "../scanner/fetcher.js";

type ProgressCallback = (progress: SpiderProgress) => void;

export async function runSpiderAndLinkCheck(
  inputUrl: string,
  options: Omit<CrawlOptions, "startUrl">,
  onProgress: ProgressCallback,
): Promise<SpiderReport> {
  const startUrl = normalizeUrl(inputUrl);

  onProgress({ phase: "crawling", message: "Starting site crawl…" });
  const pages = await crawlSite(startUrl, options, onProgress);

  const pageLinks = pages.flatMap((page) =>
    page.links.map((link) => ({ sourcePage: page.url, link })),
  );

  onProgress({
    phase: "checking",
    message: `Checking ${pageLinks.length} links…`,
    current: 0,
    total: pageLinks.length,
  });

  const links = await checkLinks(pageLinks, (current, total, url) => {
    onProgress({
      phase: "checking",
      message: `Checking link ${current}/${total}: ${truncate(url, 55)}`,
      current,
      total,
    });
  });

  const deadLinks = links.filter(isDeadLink);
  const okLinks = links.filter((l) => l.status === "ok");
  const skippedLinks = links.filter((l) => l.status === "skipped");
  const errorLinks = links.filter((l) => l.status === "error");

  const report: SpiderReport = {
    startUrl,
    scannedAt: new Date().toISOString(),
    options: { startUrl, ...options },
    pages,
    links,
    summary: {
      pagesCrawled: pages.length,
      linksFound: pageLinks.length,
      linksChecked: links.filter((l) => l.status !== "skipped").length,
      deadLinks: deadLinks.length,
      okLinks: okLinks.length,
      skippedLinks: skippedLinks.length,
      errorLinks: errorLinks.length,
    },
  };

  onProgress({ phase: "complete", message: "Crawl and link check complete" });
  return report;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}

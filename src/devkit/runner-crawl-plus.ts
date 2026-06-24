import { runSpiderAndLinkCheck } from "../spider/runner.js";
import type { SpiderProgress, SpiderReport } from "../spider/types.js";
import { analyzeMixedContent } from "./links/mixed-content.js";
import { analyzeRedirectChains } from "./links/redirects.js";
import { analyzeSitemap } from "./links/sitemap.js";
import type { CrawlPlusReport, DevProgress } from "./types.js";

type ProgressCallback = (progress: DevProgress) => void;

export async function runCrawlPlus(
  inputUrl: string,
  options: { maxPages: number; maxDepth: number; sameOrigin: boolean },
  onProgress: ProgressCallback,
): Promise<CrawlPlusReport> {
  onProgress({ phase: "crawl", message: "Starting site crawl…" });

  const spider = await runSpiderAndLinkCheck(inputUrl, options, (p: SpiderProgress) => {
    onProgress({
      phase: "crawl",
      message: p.message,
      current: p.current,
      total: p.total,
    });
  });

  onProgress({ phase: "redirects", message: "Analyzing redirect chains…" });
  const redirects = analyzeRedirectChains(spider.links);

  onProgress({ phase: "mixed", message: "Checking mixed content on HTTPS pages…" });
  const mixedContent = await analyzeMixedContent(spider.pages, (current, total) => {
    onProgress({
      phase: "mixed",
      message: `Mixed content check ${current}/${total}…`,
      current,
      total,
    });
  });

  onProgress({ phase: "sitemap", message: "Validating sitemap…" });
  const sitemap = await analyzeSitemap(spider.startUrl);

  onProgress({ phase: "complete", message: "Crawl complete" });

  return { spider, redirects, mixedContent, sitemap };
}

export type { SpiderReport };

import type { CrawledPage } from "../../spider/types.js";
import type { DevFinding } from "../types.js";
import { fetchHtml } from "../../scanner/fetcher.js";
import { finding, isHttps, resolveOnPage } from "../page-context.js";

export async function analyzeMixedContent(
  pages: CrawledPage[],
  onProgress?: (current: number, total: number) => void,
): Promise<DevFinding[]> {
  const findings: DevFinding[] = [];
  const httpsPages = pages.filter((p) => isHttps(p.url) && !p.fetchError);

  if (httpsPages.length === 0) {
    findings.push(finding("mixed-none", "mixed", "info", "No HTTPS pages crawled", "Mixed content checks require HTTPS pages."));
    return findings;
  }

  let mixedCount = 0;
  const sample: string[] = [];

  for (let i = 0; i < httpsPages.length; i++) {
    const page = httpsPages[i];
    onProgress?.(i + 1, httpsPages.length);

    try {
      const html = await fetchHtml(page.url);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const insecure = collectInsecureResources(doc, page.url);

      for (const resource of insecure) {
        mixedCount++;
        if (sample.length < 20) sample.push(`${page.url} → ${resource}`);
      }
    } catch {
      // Page fetch already failed during crawl
    }
  }

  if (mixedCount === 0) {
    findings.push(
      finding("mixed-ok", "mixed", "info", "No mixed content detected", `Checked ${httpsPages.length} HTTPS page(s).`),
    );
    return findings;
  }

  findings.push(
    finding(
      "mixed-found",
      "mixed",
      "error",
      `${mixedCount} insecure resource(s) on HTTPS pages`,
      "HTTP scripts, images, or styles on HTTPS pages are blocked or downgraded by browsers.",
      sample.join("\n"),
    ),
  );

  return findings;
}

function collectInsecureResources(doc: Document, pageUrl: string): string[] {
  const insecure: string[] = [];
  const selectors = [
    'script[src^="http:"]',
    'img[src^="http:"]',
    'link[rel="stylesheet"][href^="http:"]',
    'iframe[src^="http:"]',
    'video[src^="http:"]',
    'audio[src^="http:"]',
  ];

  for (const sel of selectors) {
    for (const el of doc.querySelectorAll(sel)) {
      const attr = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
      insecure.push(resolveOnPage(pageUrl, attr));
    }
  }

  return insecure;
}

import type { DevFinding } from "../types.js";
import { fetchText, finding, originOf } from "../page-context.js";

export async function analyzeRobots(url: string, html: string): Promise<DevFinding[]> {
  const findings: DevFinding[] = [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const origin = originOf(url);

  const metaRobots = doc.querySelector('meta[name="robots" i]')?.getAttribute("content")?.toLowerCase() ?? "";
  if (metaRobots.includes("noindex")) {
    findings.push(finding("robots-noindex", "robots", "warning", "Page has noindex", `meta robots: ${metaRobots}`));
  }
  if (metaRobots.includes("nofollow")) {
    findings.push(finding("robots-nofollow", "robots", "info", "Page has nofollow", "Links on this page won't be followed by crawlers."));
  }

  try {
    const robotsTxt = await fetchText(`${origin}/robots.txt`);
    findings.push(finding("robots-txt", "robots", "info", "robots.txt found", robotsTxt.slice(0, 200)));

    if (robotsTxt.toLowerCase().includes("disallow: /") && !robotsTxt.toLowerCase().includes("user-agent: *")) {
      findings.push(finding("robots-disallow-all", "robots", "warning", "robots.txt may block crawlers", "Check Disallow rules for User-agent: *"));
    }
  } catch {
    findings.push(finding("robots-no-txt", "robots", "info", "No robots.txt reachable", "Optional but recommended for crawl guidance."));
  }

  return findings;
}

import type { DevFinding } from "../types.js";
import { fetchText, finding, originOf } from "../page-context.js";

export async function analyzeSitemap(startUrl: string): Promise<DevFinding[]> {
  const findings: DevFinding[] = [];
  const origin = originOf(startUrl);

  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];

  let found = false;

  for (const url of candidates) {
    try {
      const text = await fetchText(url);
      found = true;
      const urlCount = (text.match(/<loc>/gi) ?? []).length;
      findings.push(
        finding("sitemap-found", "sitemap", "info", `Sitemap found (${urlCount} URLs)`, url),
      );

      if (urlCount === 0) {
        findings.push(finding("sitemap-empty", "sitemap", "warning", "Sitemap has no <loc> entries", "Verify sitemap format."));
      }

      if (!text.includes("<?xml") && !text.includes("<urlset")) {
        findings.push(finding("sitemap-format", "sitemap", "warning", "Unusual sitemap format", "Expected XML urlset or sitemap index."));
      }

      const badUrls = [...text.matchAll(/<loc>([^<]+)<\/loc>/gi)]
        .map((m) => m[1]?.trim() ?? "")
        .filter((u) => !u.startsWith("http"));

      if (badUrls.length > 0) {
        findings.push(
          finding("sitemap-relative", "sitemap", "warning", "Sitemap contains non-absolute URLs", badUrls.slice(0, 5).join("\n")),
        );
      }

      break;
    } catch {
      // try next candidate
    }
  }

  if (!found) {
    findings.push(
      finding("sitemap-missing", "sitemap", "warning", "No sitemap.xml found", `Tried ${candidates[0]} and common variants.`),
    );
  }

  return findings;
}

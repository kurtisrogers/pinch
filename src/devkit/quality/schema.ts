import type { DevFinding, PageContext } from "../types.js";
import { finding } from "../page-context.js";

export function analyzeSchema(ctx: PageContext): DevFinding[] {
  const { doc } = ctx;
  const findings: DevFinding[] = [];
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

  if (scripts.length === 0) {
    findings.push(finding("schema-none", "schema", "warning", "No JSON-LD found", "Add structured data for rich search results."));
    return findings;
  }

  scripts.forEach((script, i) => {
    try {
      const data = JSON.parse(script.textContent ?? "");
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const type = item["@type"] ?? "Unknown";
        findings.push(finding(`schema-${i}-${type}`, "schema", "info", `Schema: ${type}`, describeSchema(item, type)));

        if (type === "Article" || type === "NewsArticle") {
          if (!item.headline) findings.push(finding(`schema-headline-${i}`, "schema", "error", "Article missing headline", "Required for Article schema."));
          if (!item.image) findings.push(finding(`schema-image-${i}`, "schema", "warning", "Article missing image", "Recommended for Article rich results."));
        }
        if (type === "Product") {
          if (!item.name) findings.push(finding(`schema-name-${i}`, "schema", "error", "Product missing name", "Required field."));
          if (!item.offers) findings.push(finding(`schema-offers-${i}`, "schema", "warning", "Product missing offers", "Price/availability helps shopping results."));
        }
        if (type === "FAQPage" && !item.mainEntity) {
          findings.push(finding(`schema-faq-${i}`, "schema", "error", "FAQPage missing mainEntity", "FAQ schema needs Question/Answer entities."));
        }
      }
    } catch {
      findings.push(finding(`schema-parse-${i}`, "schema", "error", "Invalid JSON-LD", "Fix syntax in application/ld+json block."));
    }
  });

  return findings;
}

function describeSchema(item: Record<string, unknown>, type: string): string {
  const name = item.name ?? item.headline ?? item.title;
  return name ? `${type}: "${String(name).slice(0, 60)}"` : `${type} block present`;
}

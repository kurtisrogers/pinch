import type { DevFinding, PageContext } from "../types.js";
import { finding } from "../page-context.js";

export function analyzeCssHints(ctx: PageContext): DevFinding[] {
  const { doc } = ctx;
  const findings: DevFinding[] = [];

  const inlineStyles = doc.querySelectorAll("[style]");
  if (inlineStyles.length > 20) {
    findings.push(finding("css-inline-many", "css", "warning", `${inlineStyles.length} inline style attributes`, "Prefer classes — inline styles are hard to maintain and bloat HTML."));
  }

  const stylesheets = doc.querySelectorAll('link[rel="stylesheet"]');
  if (stylesheets.length > 8) {
    findings.push(finding("css-many-sheets", "css", "warning", `${stylesheets.length} stylesheets`, "Concatenate or code-split CSS to reduce requests."));
  }

  const importantCount = (doc.documentElement.innerHTML.match(/!important/g) ?? []).length;
  if (importantCount > 10) {
    findings.push(finding("css-important", "css", "info", `${importantCount} !important declarations`, "Heavy !important use suggests specificity problems."));
  }

  if (findings.length === 0) {
    findings.push(finding("css-ok", "css", "info", "No obvious CSS issues in HTML", "Full unused-CSS analysis needs stylesheet content."));
  }

  return findings;
}

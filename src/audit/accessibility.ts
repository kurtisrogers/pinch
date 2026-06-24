import axe from "axe-core";
import type { AxeResults, Result } from "axe-core";
import type { AuditIssue } from "./types.js";
import { prepareSrcdoc, waitForIframe } from "./document.js";

const IMPACT_TO_SEVERITY: Record<string, AuditIssue["severity"]> = {
  critical: "error",
  serious: "error",
  moderate: "warning",
  minor: "warning",
};

export async function scanAccessibility(html: string, pageUrl: string): Promise<AuditIssue[]> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;width:1280px;height:800px;left:-9999px;top:0;border:0;visibility:hidden";
  iframe.srcdoc = prepareSrcdoc(html, pageUrl);
  document.body.appendChild(iframe);

  try {
    await waitForIframe(iframe);

    // Run axe from the parent window against the iframe via fromFrames.
    // Injecting axe.source into srcdoc fails under CSP / inline-script restrictions.
    const results = await axe.run<AxeResults>(
      { fromFrames: [iframe] } as unknown as axe.ElementContext,
      { runOnly: ["wcag2a", "wcag2aa", "best-practice"] },
    );

    const issues: AuditIssue[] = results.violations.flatMap((violation: Result) =>
      violation.nodes.map((node, index: number) => ({
        id: `a11y-${violation.id}-${index}`,
        category: "accessibility" as const,
        severity: IMPACT_TO_SEVERITY[violation.impact ?? "moderate"] ?? "warning",
        title: violation.help,
        description: node.failureSummary ?? violation.description,
        selector: node.target.join(", "),
        wcag: violation.tags.filter((t: string) => t.startsWith("wcag")).join(", ") || undefined,
      })),
    );

    if (issues.length === 0) {
      issues.push({
        id: "a11y-clean",
        category: "accessibility",
        severity: "info",
        title: "No axe violations detected",
        description: `${results.passes.length} accessibility rules passed. Manual testing is still recommended for colour contrast and keyboard flows.`,
      });
    }

    return issues;
  } finally {
    iframe.remove();
  }
}

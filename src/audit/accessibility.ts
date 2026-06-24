import axe from "axe-core";
import type { AuditIssue } from "./types.js";
import { withLiveDocument } from "./document.js";

const IMPACT_TO_SEVERITY: Record<string, AuditIssue["severity"]> = {
  critical: "error",
  serious: "error",
  moderate: "warning",
  minor: "warning",
};

export async function scanAccessibility(html: string, pageUrl: string): Promise<AuditIssue[]> {
  return withLiveDocument(html, pageUrl, async (doc) => {
    const results = await axe.run(doc, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
    });

    const issues: AuditIssue[] = results.violations.flatMap((violation) =>
      violation.nodes.map((node, index) => ({
        id: `a11y-${violation.id}-${index}`,
        category: "accessibility" as const,
        severity: IMPACT_TO_SEVERITY[violation.impact ?? "moderate"] ?? "warning",
        title: violation.help,
        description: node.failureSummary ?? violation.description,
        selector: node.target.join(", "),
        wcag: violation.tags.filter((t) => t.startsWith("wcag")).join(", ") || undefined,
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
  });
}

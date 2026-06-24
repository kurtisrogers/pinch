import type { AuditCategory, AuditIssue, CategoryScore } from "./types.js";

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  ux: "UX",
  html: "HTML",
  accessibility: "Accessibility",
};

const SEVERITY_WEIGHT: Record<AuditIssue["severity"], number> = {
  error: 12,
  warning: 5,
  info: 1,
};

export function scoreCategory(category: AuditCategory, issues: AuditIssue[]): CategoryScore {
  const filtered = issues.filter((i) => i.category === category);
  const errors = filtered.filter((i) => i.severity === "error").length;
  const warnings = filtered.filter((i) => i.severity === "warning").length;
  const infos = filtered.filter((i) => i.severity === "info").length;

  const penalty = filtered.reduce((sum, i) => sum + SEVERITY_WEIGHT[i.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    category,
    label: CATEGORY_LABELS[category],
    score,
    errors,
    warnings,
    infos,
    issues: filtered.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
  };
}

export function overallScore(categories: CategoryScore[]): number {
  if (categories.length === 0) return 0;
  return Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);
}

function severityRank(severity: AuditIssue["severity"]): number {
  switch (severity) {
    case "error":
      return 0;
    case "warning":
      return 1;
    case "info":
      return 2;
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

export function scoreGrade(score: number): { label: string; class: string } {
  if (score >= 90) return { label: "Excellent", class: "grade-good" };
  if (score >= 70) return { label: "Needs work", class: "grade-warn" };
  return { label: "Poor", class: "grade-bad" };
}

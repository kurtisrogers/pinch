import type { AuditReport } from "../../audit/types.js";
import type { DevAuditReport, DevFinding, StoredBaseline } from "../types.js";

const BASELINE_KEY = "pinch-dev-audit-baseline";

export function saveBaseline(report: DevAuditReport): void {
  const stored: StoredBaseline = {
    url: report.url,
    savedAt: report.scannedAt,
    report,
  };
  localStorage.setItem(BASELINE_KEY, JSON.stringify(stored));
}

export function loadBaseline(): StoredBaseline | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredBaseline;
  } catch {
    return null;
  }
}

export function clearBaseline(): void {
  localStorage.removeItem(BASELINE_KEY);
}

export function diffAgainstBaseline(current: DevAuditReport): DevFinding[] {
  const baseline = loadBaseline();
  if (!baseline) {
    return [
      {
        id: "diff-no-baseline",
        category: "baseline",
        severity: "info",
        title: "No baseline saved",
        description: "Run Dev Audit and click Save baseline to compare future scans.",
      },
    ];
  }

  if (normalizeUrl(baseline.url) !== normalizeUrl(current.url)) {
    return [
      {
        id: "diff-url-mismatch",
        category: "baseline",
        severity: "warning",
        title: "Baseline URL differs",
        description: `Baseline: ${baseline.url} · Current: ${current.url}`,
      },
    ];
  }

  const changes: DevFinding[] = [];
  const baseCounts = countFindings(baseline.report);
  const currCounts = countFindings(current);

  for (const severity of ["error", "warning", "info"] as const) {
    const delta = currCounts[severity] - baseCounts[severity];
    if (delta !== 0) {
      changes.push({
        id: `diff-${severity}`,
        category: "baseline",
        severity: delta > 0 ? "warning" : "info",
        title: `${severity} count ${delta > 0 ? "increased" : "decreased"}`,
        description: `${baseCounts[severity]} → ${currCounts[severity]} (${delta > 0 ? "+" : ""}${delta}) since ${formatDate(baseline.savedAt)}`,
      });
    }
  }

  const baseIds = new Set(flatFindings(baseline.report).map((f) => f.id));
  const currFindings = flatFindings(current);

  for (const f of currFindings) {
    if (!baseIds.has(f.id) && f.severity !== "info") {
      changes.push({
        id: `diff-new-${f.id}`,
        category: "baseline",
        severity: "warning",
        title: `New: ${f.title}`,
        description: f.description,
        detail: f.detail,
      });
    }
  }

  if (changes.length === 0) {
    changes.push({
      id: "diff-unchanged",
      category: "baseline",
      severity: "info",
      title: "No significant changes",
      description: `Compared to baseline from ${formatDate(baseline.savedAt)}.`,
    });
  }

  return changes;
}

function flatFindings(report: DevAuditReport): DevFinding[] {
  return report.sections.flatMap((s) => s.findings);
}

function countFindings(report: DevAuditReport): Record<"error" | "warning" | "info", number> {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of flatFindings(report)) counts[f.severity]++;
  return counts;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    if (u.pathname.endsWith("/") && u.pathname.length > 1) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return url;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function exportDevAuditJson(report: DevAuditReport): void {
  downloadText(JSON.stringify(report, null, 2), `pinch-dev-audit-${slug(report.url)}.json`, "application/json");
}

export function exportDevAuditMarkdown(report: DevAuditReport, audit?: AuditReport): void {
  const lines: string[] = [
    `# Dev Audit — ${report.url}`,
    "",
    `Scanned: ${report.scannedAt}`,
    "",
  ];

  if (audit) {
    lines.push(`Overall score: **${audit.overallScore}** (${audit.totalIssues} issues)`, "");
  }

  if (report.ogPreview) {
    lines.push("## Social preview", "", `- Title: ${report.ogPreview.title}`, `- Description: ${report.ogPreview.description}`);
    if (report.ogPreview.image) lines.push(`- Image: ${report.ogPreview.image}`);
    lines.push("");
  }

  for (const section of report.sections) {
    const actionable = section.findings.filter((f) => f.severity !== "info");
    if (actionable.length === 0) continue;
    lines.push(`## ${section.icon} ${section.title}`, "");
    for (const f of actionable) {
      lines.push(`- **[${f.severity}]** ${f.title} — ${f.description}`);
      if (f.detail) lines.push(`  \`${f.detail.slice(0, 120)}\``);
    }
    lines.push("");
  }

  downloadText(lines.join("\n"), `pinch-dev-audit-${slug(report.url)}.md`, "text/markdown");
}

function slug(url: string): string {
  try {
    return new URL(url).hostname.replace(/\./g, "-");
  } catch {
    return "report";
  }
}

function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

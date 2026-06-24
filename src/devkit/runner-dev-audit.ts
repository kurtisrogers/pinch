import { runPageAudit } from "../audit/runner.js";
import type { AuditProgress, AuditReport } from "../audit/types.js";
import { analyzeCoreWebVitals } from "./performance/cwv.js";
import { analyzeFonts } from "./performance/fonts.js";
import { analyzeScripts } from "./performance/scripts.js";
import { buildOgPreview, ogPreviewFindings } from "./preview/og-card.js";
import { analyzeCookieConsent } from "./quality/cookie-consent.js";
import { analyzeCssHints } from "./quality/css-hints.js";
import { analyzeRobots } from "./quality/robots.js";
import { analyzeSchema } from "./quality/schema.js";
import { analyzeSecurityHeaders } from "./quality/security-headers.js";
import { loadPageContext } from "./page-context.js";
import type { DevAuditReport, DevFinding, DevProgress, DevReportSection } from "./types.js";

export interface FullDevAuditResult {
  devReport: DevAuditReport;
  auditReport: AuditReport;
}

type ProgressCallback = (progress: DevProgress) => void;

export async function runDevAudit(
  inputUrl: string,
  onProgress: ProgressCallback,
): Promise<FullDevAuditResult> {
  onProgress({ phase: "fetch", message: "Loading page context…" });
  const ctx = await loadPageContext(inputUrl);

  onProgress({ phase: "audit", message: "Running HTML, UX & accessibility audit…" });
  const auditReport = await runPageAudit(inputUrl, (p: AuditProgress) =>
    onProgress({ phase: "audit", message: p.message }),
  );

  onProgress({ phase: "performance", message: "Analyzing performance signals…" });
  const performanceFindings = [
    ...analyzeCoreWebVitals(ctx),
    ...analyzeFonts(ctx),
    ...analyzeScripts(ctx),
  ];

  onProgress({ phase: "quality", message: "Checking SEO, security & compliance…" });
  const qualityFindings = [
    ...analyzeSchema(ctx),
    ...analyzeSecurityHeaders(ctx),
    ...analyzeCookieConsent(ctx),
    ...analyzeCssHints(ctx),
    ...(await analyzeRobots(ctx.url, ctx.html)),
  ];

  onProgress({ phase: "preview", message: "Building social preview…" });
  const ogPreview = buildOgPreview(ctx);
  const previewFindings = ogPreviewFindings(ogPreview);

  const auditFindings = auditIssuesToDevFindings(auditReport);

  const sections: DevReportSection[] = [
    section("audit", "HTML, UX & A11y", "🌅", auditFindings),
    section("performance", "Performance", "⚡", performanceFindings),
    section("quality", "SEO & Security", "🔒", qualityFindings),
    section("preview", "Social preview", "📱", previewFindings),
  ];

  onProgress({ phase: "complete", message: "Dev audit complete" });

  const devReport: DevAuditReport = {
    url: ctx.url,
    scannedAt: new Date().toISOString(),
    sections,
    ogPreview,
  };

  return { devReport, auditReport };
}

function section(id: string, title: string, icon: string, findings: DevFinding[]): DevReportSection {
  return { id, title, icon, findings };
}

function auditIssuesToDevFindings(audit: AuditReport): DevFinding[] {
  return audit.categories.flatMap((cat) =>
    cat.issues.map((issue) => ({
      id: issue.id,
      category: issue.category,
      severity: issue.severity,
      title: issue.title,
      description: issue.description,
      detail: issue.selector ? `Selector: ${issue.selector}` : issue.wcag,
    })),
  );
}

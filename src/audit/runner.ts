import { fetchHtml, normalizeUrl } from "../scanner/fetcher.js";
import { scanAccessibility } from "./accessibility.js";
import { createAuditDocument } from "./document.js";
import { validateHtml } from "./html-validator.js";
import { overallScore, scoreCategory } from "./scoring.js";
import type { AuditProgress, AuditReport } from "./types.js";
import { scanUx } from "./ux-scanner.js";

type ProgressCallback = (progress: AuditProgress) => void;

export async function runPageAudit(
  inputUrl: string,
  onProgress: ProgressCallback,
): Promise<AuditReport> {
  const url = normalizeUrl(inputUrl);

  onProgress({ phase: "fetching", message: "Fetching page HTML…" });
  const html = await fetchHtml(url);
  const auditDoc = createAuditDocument(html, url);
  const pageTitle = auditDoc.doc.querySelector("title")?.textContent?.trim() ?? url;

  onProgress({ phase: "html", message: "Validating HTML…" });
  const htmlIssues = validateHtml(auditDoc);

  onProgress({ phase: "ux", message: "Running UX checks…" });
  const uxIssues = scanUx(auditDoc);

  onProgress({ phase: "accessibility", message: "Running accessibility scan (axe)…" });
  const a11yIssues = await scanAccessibility(html, url);

  const allIssues = [...htmlIssues, ...uxIssues, ...a11yIssues];
  const categories = [
    scoreCategory("html", allIssues),
    scoreCategory("ux", allIssues),
    scoreCategory("accessibility", allIssues),
  ];

  onProgress({ phase: "complete", message: "Audit complete" });

  return {
    url,
    pageTitle,
    scannedAt: new Date().toISOString(),
    categories,
    overallScore: overallScore(categories),
    totalIssues: allIssues.filter((i) => i.severity !== "info").length,
  };
}

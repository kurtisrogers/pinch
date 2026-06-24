import type { AuditReport } from "../audit/types.js";
import { scoreGrade } from "../audit/scoring.js";
import type { DevAuditReport, DevFinding, DevReportSection } from "../devkit/types.js";
import { escapeHtml, truncateUrl } from "./utils.js";

let latestDevReport: DevAuditReport | null = null;
let latestAuditReport: AuditReport | null = null;

export function getDevAuditReport(): DevAuditReport | null {
  return latestDevReport;
}

export function getAuditReport(): AuditReport | null {
  return latestAuditReport;
}

export function renderDevAuditResults(devReport: DevAuditReport, auditReport: AuditReport): void {
  latestDevReport = devReport;
  latestAuditReport = auditReport;

  const results = document.getElementById("results")!;
  results.classList.remove("hidden");

  const overall = scoreGrade(auditReport.overallScore);
  const totalActionable = countActionable(devReport);

  const categoryCards = auditReport.categories
    .map((cat) => {
      const grade = scoreGrade(cat.score);
      return `
        <article class="viewport-card ${grade.class}">
          <div class="viewport-header">
            <div>
              <h3>${escapeHtml(cat.label)}</h3>
              <span class="viewport-spec">${cat.errors} errors · ${cat.warnings} warnings</span>
            </div>
          </div>
          <div class="audit-score">${cat.score}</div>
          <div class="grade-badge">${grade.label}</div>
        </article>`;
    })
    .join("");

  const ogCard = devReport.ogPreview ? renderOgCard(devReport.ogPreview) : "";

  const sections = devReport.sections.map(renderDevSection).join("");

  results.innerHTML = `
    <section class="summary-header">
      <div>
        <h2>Dev audit for <a href="${escapeHtml(devReport.url)}" target="_blank" rel="noopener">${escapeHtml(truncateUrl(devReport.url, 50))}</a></h2>
        <p>${escapeHtml(auditReport.pageTitle)} · ${totalActionable} actionable findings</p>
      </div>
      <div class="headline-stat">
        <span class="headline-value ${auditReport.overallScore < 70 ? "bad-stat" : ""}">${auditReport.overallScore}</span>
        <span class="headline-label">quality score</span>
        <span class="headline-sub">${overall.label}</span>
      </div>
    </section>

    <div class="report-actions">
      <button type="button" class="pdf-btn" id="save-baseline-btn">Save baseline</button>
      <button type="button" class="pdf-btn secondary" id="export-json-btn">Export JSON</button>
      <button type="button" class="pdf-btn secondary" id="export-md-btn">Export Markdown</button>
    </div>

    <section class="viewport-grid audit-grid">${categoryCards}</section>

    ${ogCard}

    ${sections}
  `;
}

function renderOgCard(preview: NonNullable<DevAuditReport["ogPreview"]>): string {
  const imageBlock = preview.image
    ? `<img class="og-preview-img" src="${escapeHtml(preview.image)}" alt="" loading="lazy" />`
    : `<div class="og-preview-placeholder">No og:image</div>`;

  return `
    <section class="images-section og-preview-section">
      <h3>📱 Social share preview</h3>
      <div class="og-preview-card">
        ${imageBlock}
        <div class="og-preview-body">
          <p class="og-preview-site">${escapeHtml(preview.siteName ?? new URL(preview.url).hostname)}</p>
          <p class="og-preview-title">${escapeHtml(preview.title || "Untitled")}</p>
          <p class="og-preview-desc">${escapeHtml(preview.description || "No description")}</p>
        </div>
      </div>
    </section>`;
}

function renderDevSection(section: DevReportSection): string {
  const actionable = section.findings.filter((f) => f.severity !== "info");
  const infos = section.findings.filter((f) => f.severity === "info");

  const rows = actionable
    .map((f) => renderFindingRow(f))
    .join("");

  const infoBlock =
    infos.length > 0
      ? `<details class="audit-info-block"><summary>${infos.length} informational note${infos.length === 1 ? "" : "s"}</summary><ul class="rec-list">${infos.map((f) => `<li><strong>${escapeHtml(f.title)}</strong> — ${escapeHtml(f.description)}</li>`).join("")}</ul></details>`
      : "";

  const empty =
    actionable.length === 0
      ? `<p class="all-clear">No ${escapeHtml(section.title.toLowerCase())} issues found.</p>`
      : "";

  return `
    <section class="images-section">
      <h3>${section.icon} ${escapeHtml(section.title)}</h3>
      <p class="section-desc">${actionable.length} issue${actionable.length === 1 ? "" : "s"} to review.</p>
      ${empty}
      <div class="audit-list">${rows}</div>
      ${infoBlock}
    </section>`;
}

function renderFindingRow(f: DevFinding): string {
  return `
    <details class="audit-row severity-${f.severity}">
      <summary>
        <span class="severity-pill ${f.severity}">${f.severity}</span>
        <span class="audit-title">${escapeHtml(f.title)}</span>
        <span class="wcag-tag">${escapeHtml(f.category)}</span>
      </summary>
      <div class="audit-detail">
        <p>${escapeHtml(f.description)}</p>
        ${f.detail ? `<pre class="audit-detail-pre">${escapeHtml(f.detail)}</pre>` : ""}
      </div>
    </details>`;
}

function countActionable(report: DevAuditReport): number {
  return report.sections.flatMap((s) => s.findings).filter((f) => f.severity !== "info").length;
}

export function renderBaselineDiff(changes: DevFinding[]): void {
  const results = document.getElementById("results")!;
  results.classList.remove("hidden");

  const rows = changes
    .map((f) => renderFindingRow(f))
    .join("");

  results.innerHTML = `
    <section class="summary-header">
      <div>
        <h2>Baseline comparison</h2>
        <p>${changes.length} change${changes.length === 1 ? "" : "s"} since last saved baseline.</p>
      </div>
    </section>
    <div class="report-actions">
      <button type="button" class="pdf-btn secondary" id="clear-baseline-btn">Clear baseline</button>
    </div>
    <section class="images-section">
      <div class="audit-list">${rows}</div>
    </section>
  `;
}

export function renderHarResults(summary: import("../devkit/types.js").HarSummary): void {
  const results = document.getElementById("results")!;
  results.classList.remove("hidden");

  const domainRows = summary.domains
    .map(
      (d) => `
      <tr>
        <td class="mono">${escapeHtml(d.domain)}</td>
        <td>${d.count}</td>
        <td class="mono">${formatBytes(d.bytes)}</td>
      </tr>`,
    )
    .join("");

  const slowRows = summary.slowest
    .slice(0, 8)
    .map(
      (s) => `
      <tr>
        <td class="mono">${Math.round(s.durationMs)}ms</td>
        <td class="mono">${escapeHtml(truncateUrl(s.url, 70))}</td>
      </tr>`,
    )
    .join("");

  const findingRows = summary.findings.map((f) => renderFindingRow(f)).join("");

  results.innerHTML = `
    <section class="summary-header">
      <div>
        <h2>HAR analysis — ${escapeHtml(summary.fileName)}</h2>
        <p>${summary.entryCount} requests · ${formatBytes(summary.totalBytes)} transferred</p>
      </div>
    </section>

    <section class="images-section">
      <h3>Summary</h3>
      <div class="audit-list">${findingRows}</div>
    </section>

    <section class="images-section">
      <h3>Top domains</h3>
      <div class="table-wrap">
        <table class="link-table">
          <thead><tr><th>Domain</th><th>Requests</th><th>Bytes</th></tr></thead>
          <tbody>${domainRows || "<tr><td colspan=\"3\">No data</td></tr>"}</tbody>
        </table>
      </div>
    </section>

    <section class="images-section">
      <h3>Slowest requests</h3>
      <div class="table-wrap">
        <table class="link-table">
          <thead><tr><th>Duration</th><th>URL</th></tr></thead>
          <tbody>${slowRows || "<tr><td colspan=\"2\">No data</td></tr>"}</tbody>
        </table>
      </div>
    </section>
  `;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

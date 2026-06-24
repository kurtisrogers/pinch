import type { AuditReport } from "../audit/types.js";
import { scoreGrade } from "../audit/scoring.js";
import { escapeHtml, truncateUrl } from "./utils.js";

export function renderAuditResults(report: AuditReport): void {
  const results = document.getElementById("results")!;
  results.classList.remove("hidden");

  const overall = scoreGrade(report.overallScore);

  const categoryCards = report.categories
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

  const sections = report.categories
    .map((cat) => renderIssueSection(cat.label, cat.issues))
    .join("");

  results.innerHTML = `
    <section class="summary-header">
      <div>
        <h2>Audit for <a href="${escapeHtml(report.url)}" target="_blank" rel="noopener">${escapeHtml(truncateUrl(report.url, 50))}</a></h2>
        <p>${escapeHtml(report.pageTitle)} · ${report.totalIssues} actionable issues</p>
      </div>
      <div class="headline-stat">
        <span class="headline-value ${report.overallScore < 70 ? "bad-stat" : ""}">${report.overallScore}</span>
        <span class="headline-label">overall score</span>
        <span class="headline-sub">${overall.label}</span>
      </div>
    </section>

    <section class="viewport-grid audit-grid">${categoryCards}</section>

    ${sections}
  `;
}

function renderIssueSection(title: string, issues: AuditReport["categories"][0]["issues"]): string {
  const actionable = issues.filter((i) => i.severity !== "info");
  const infos = issues.filter((i) => i.severity === "info");

  const rows = actionable
    .map(
      (issue) => `
      <details class="audit-row severity-${issue.severity}">
        <summary>
          <span class="severity-pill ${issue.severity}">${issue.severity}</span>
          <span class="audit-title">${escapeHtml(issue.title)}</span>
          ${issue.wcag ? `<span class="wcag-tag">${escapeHtml(issue.wcag)}</span>` : ""}
        </summary>
        <div class="audit-detail">
          <p>${escapeHtml(issue.description)}</p>
          ${issue.selector ? `<p class="audit-selector">Selector: <code>${escapeHtml(issue.selector)}</code></p>` : ""}
        </div>
      </details>`,
    )
    .join("");

  const infoRows =
    infos.length > 0
      ? `<details class="audit-info-block"><summary>${infos.length} informational note${infos.length === 1 ? "" : "s"}</summary><ul class="rec-list">${infos.map((i) => `<li><strong>${escapeHtml(i.title)}</strong> — ${escapeHtml(i.description)}</li>`).join("")}</ul></details>`
      : "";

  const empty =
    actionable.length === 0
      ? `<p class="all-clear">No ${escapeHtml(title.toLowerCase())} issues found.</p>`
      : "";

  return `
    <section class="images-section">
      <h3>${escapeHtml(title)}</h3>
      <p class="section-desc">${actionable.length} issue${actionable.length === 1 ? "" : "s"} to review.</p>
      ${empty}
      <div class="audit-list">${rows}</div>
      ${infoRows}
    </section>`;
}

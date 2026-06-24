import type { CrawlPlusReport } from "../devkit/types.js";
import { renderSpiderResults } from "./render-results.js";
import { escapeHtml } from "./utils.js";

let latestCrawlReport: CrawlPlusReport | null = null;

export function getCrawlPlusReport(): CrawlPlusReport | null {
  return latestCrawlReport;
}

export function renderCrawlPlusResults(report: CrawlPlusReport): void {
  latestCrawlReport = report;
  renderSpiderResults(report.spider);

  const results = document.getElementById("results")!;
  const extra = renderExtraSections(report);
  results.insertAdjacentHTML("beforeend", extra);
}

function renderExtraSections(report: CrawlPlusReport): string {
  return `
    ${renderFindingSection("🔗 Redirect chains", report.redirects)}
    ${renderFindingSection("🔐 Mixed content", report.mixedContent)}
    ${renderFindingSection("🗺️ Sitemap", report.sitemap)}
  `;
}

function renderFindingSection(title: string, findings: CrawlPlusReport["redirects"]): string {
  const actionable = findings.filter((f) => f.severity !== "info");
  const infos = findings.filter((f) => f.severity === "info");

  const rows = [...actionable, ...infos]
    .map(
      (f) => `
      <details class="audit-row severity-${f.severity}">
        <summary>
          <span class="severity-pill ${f.severity}">${f.severity}</span>
          <span class="audit-title">${escapeHtml(f.title)}</span>
        </summary>
        <div class="audit-detail">
          <p>${escapeHtml(f.description)}</p>
          ${f.detail ? `<pre class="audit-detail-pre">${escapeHtml(f.detail)}</pre>` : ""}
        </div>
      </details>`,
    )
    .join("");

  return `
    <section class="images-section">
      <h3>${title}</h3>
      <div class="audit-list">${rows}</div>
    </section>`;
}

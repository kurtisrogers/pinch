import type { ScanSummary } from "../scanner/types.js";
import { formatBytes, formatPercent } from "../scanner/utils.js";
import { VIEWPORTS } from "../scanner/viewports.js";
import type { SpiderReport } from "../spider/types.js";
import { isDeadLink } from "../spider/link-checker.js";
import { escapeHtml, truncateUrl } from "./utils.js";

export function renderImageResults(summary: ScanSummary): void {
  const results = document.getElementById("results")!;
  results.classList.remove("hidden");

  const viewportCards = VIEWPORTS.map((vp) => {
    const data = summary.byViewport[vp.key];
    const savings = data.wastedBytes;
    const grade = wasteGrade(data.wastePercent);

    return `
      <article class="viewport-card ${grade.class}">
        <div class="viewport-header">
          <span class="viewport-icon">${vp.icon}</span>
          <div>
            <h3>${vp.label}</h3>
            <span class="viewport-spec">${vp.width}px @ ${vp.devicePixelRatio}× DPR</span>
          </div>
        </div>
        <div class="viewport-stats">
          <div class="stat">
            <span class="stat-label">Current</span>
            <span class="stat-value">${formatBytes(data.totalBytes)}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Optimal</span>
            <span class="stat-value optimal">${formatBytes(data.optimalBytes)}</span>
          </div>
          <div class="stat highlight">
            <span class="stat-label">Potential savings</span>
            <span class="stat-value savings">${formatBytes(savings)}</span>
            <span class="stat-sub">${formatPercent(data.wastePercent)} waste</span>
          </div>
        </div>
        <div class="grade-badge">${grade.label}</div>
        <p class="impact-note">
          ~${summary.pageLoadImpactMs[vp.key]}ms extra load on slow mobile networks
        </p>
      </article>
    `;
  }).join("");

  const imageRows = summary.images
    .map((img) => {
      const worst = img.viewports.reduce((a, b) =>
        a.wastePercent > b.wastePercent ? a : b,
      );
      const srcDisplay = truncateUrl(img.parsed.src, 60);

      const viewportPills = img.viewports
        .map((v) => {
          const cls = v.wastePercent > 30 ? "bad" : v.wastePercent > 10 ? "warn" : "good";
          return `<span class="pill ${cls}">${v.viewport}: ${formatPercent(v.wastePercent)}</span>`;
        })
        .join("");

      const recs =
        img.recommendations.length > 0
          ? `<ul class="rec-list">${img.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
          : "";

      return `
        <details class="image-row">
          <summary>
            <span class="image-waste ${worst.wastePercent > 30 ? "high" : ""}">${formatPercent(worst.wastePercent)} avg waste</span>
            <span class="image-src" title="${escapeHtml(img.parsed.src)}">${escapeHtml(srcDisplay)}</span>
            <span class="image-meta">${formatBytes(img.metadata.byteSize)} · ${img.metadata.naturalWidth}×${img.metadata.naturalHeight} · ${img.metadata.format}</span>
          </summary>
          <div class="image-detail">
            ${img.parsed.alt ? `<p class="image-alt">alt: "${escapeHtml(img.parsed.alt)}"</p>` : ""}
            <div class="pill-row">${viewportPills}</div>
            ${recs}
          </div>
        </details>
      `;
    })
    .join("");

  const totalSavings = VIEWPORTS.reduce(
    (sum, vp) => sum + summary.byViewport[vp.key].wastedBytes,
    0,
  );
  const avgWaste =
    VIEWPORTS.reduce(
      (sum, vp) => sum + summary.byViewport[vp.key].wastePercent,
      0,
    ) / VIEWPORTS.length;

  results.innerHTML = `
    <section class="summary-header">
      <div>
        <h2>Results for <a href="${escapeHtml(summary.url)}" target="_blank" rel="noopener">${escapeHtml(truncateUrl(summary.url, 50))}</a></h2>
        <p>${summary.imageCount} images analyzed · ${formatBytes(summary.totalBytes)} total image weight</p>
      </div>
      <div class="headline-stat">
        <span class="headline-value">${formatBytes(totalSavings / VIEWPORTS.length)}</span>
        <span class="headline-label">avg savings per viewport</span>
        <span class="headline-sub">${formatPercent(avgWaste)} average waste</span>
      </div>
    </section>

    <section class="viewport-grid">${viewportCards}</section>

    <section class="images-section">
      <h3>Per-image breakdown</h3>
      <p class="section-desc">Sorted by average waste across viewports. Expand for recommendations.</p>
      <div class="image-list">${imageRows}</div>
    </section>
  `;
}

export function renderSpiderResults(report: SpiderReport): void {
  const results = document.getElementById("results")!;
  results.classList.remove("hidden");

  const deadLinks = report.links.filter(isDeadLink);
  const deadContent = deadLinks.filter((l) => l.zone === "content");

  const pageRows = report.pages
    .map(
      (page) => `
      <li>
        <span class="crawl-depth">d${page.depth}</span>
        <a href="${escapeHtml(page.url)}" target="_blank" rel="noopener">${escapeHtml(truncateUrl(page.url, 70))}</a>
        ${page.title ? `<span class="page-title">${escapeHtml(page.title)}</span>` : ""}
        ${page.fetchError ? `<span class="page-error">${escapeHtml(page.fetchError)}</span>` : ""}
      </li>`,
    )
    .join("");

  const deadRows = deadLinks
    .map(
      (link) => `
      <tr class="dead-row">
        <td><span class="zone-pill zone-${link.zone}">${link.zone}</span></td>
        <td class="mono">${escapeHtml(truncateUrl(link.sourcePage, 45))}</td>
        <td class="mono"><a href="${escapeHtml(link.absoluteUrl)}" target="_blank" rel="noopener">${escapeHtml(truncateUrl(link.absoluteUrl, 45))}</a></td>
        <td>${escapeHtml(link.anchorText || "—")}</td>
        <td><span class="status-dead">${escapeHtml(link.message ?? `HTTP ${link.httpStatus ?? "?"}`)}</span></td>
      </tr>`,
    )
    .join("");

  const deadTable =
    deadLinks.length > 0
      ? `
      <div class="table-wrap">
        <table class="link-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Source page</th>
              <th>Dead URL</th>
              <th>Anchor text</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${deadRows}</tbody>
        </table>
      </div>`
      : `<p class="all-clear">No dead links found in this crawl.</p>`;

  results.innerHTML = `
    <section class="summary-header">
      <div>
        <h2>Crawl report for <a href="${escapeHtml(report.startUrl)}" target="_blank" rel="noopener">${escapeHtml(truncateUrl(report.startUrl, 50))}</a></h2>
        <p>${report.summary.pagesCrawled} pages crawled · ${report.summary.linksFound} links found · ${report.summary.linksChecked} checked</p>
      </div>
      <div class="headline-stat">
        <span class="headline-value ${deadLinks.length > 0 ? "bad-stat" : ""}">${deadLinks.length}</span>
        <span class="headline-label">dead links</span>
        <span class="headline-sub">${deadContent.length} in content areas</span>
      </div>
    </section>

    <div class="report-actions">
      <button type="button" class="pdf-btn" id="download-pdf-btn">Download PDF report</button>
    </div>

    <section class="spider-stats">
      <div class="stat-card"><span class="stat-label">OK</span><span class="stat-value">${report.summary.okLinks}</span></div>
      <div class="stat-card"><span class="stat-label">Dead</span><span class="stat-value bad-stat">${report.summary.deadLinks}</span></div>
      <div class="stat-card"><span class="stat-label">Skipped</span><span class="stat-value">${report.summary.skippedLinks}</span></div>
      <div class="stat-card"><span class="stat-label">Errors</span><span class="stat-value">${report.summary.errorLinks}</span></div>
    </section>

    <section class="images-section">
      <h3>Dead links</h3>
      <p class="section-desc">Broken anchor targets (HTTP 4xx/5xx). Content-area links are highlighted in the PDF.</p>
      ${deadTable}
    </section>

    <section class="images-section">
      <h3>Crawled pages</h3>
      <ul class="crawl-list">${pageRows}</ul>
    </section>
  `;
}

function wasteGrade(percent: number): { label: string; class: string } {
  if (percent <= 10) return { label: "Well optimized", class: "grade-good" };
  if (percent <= 30) return { label: "Room to improve", class: "grade-warn" };
  return { label: "Significant waste", class: "grade-bad" };
}

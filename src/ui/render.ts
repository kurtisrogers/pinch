import type { ScanProgress, ScanSummary } from "../scanner/types.js";
import { formatBytes, formatPercent } from "../scanner/utils.js";
import { VIEWPORTS } from "../scanner/viewports.js";

export function renderApp(container: HTMLElement): void {
  container.innerHTML = `
    <div class="page">
      <header class="hero">
        <div class="hero-badge">Bandwidth audit tool</div>
        <h1>Pinch</h1>
        <p class="hero-sub">
          Scan any webpage and see how much image data you're over-serving on
          mobile, tablet, and desktop — and what responsive fixes would save.
        </p>
      </header>

      <form class="scan-form" id="scan-form">
        <label class="sr-only" for="url-input">Website URL</label>
        <div class="input-row">
          <input
            id="url-input"
            type="url"
            name="url"
            placeholder="https://example.com"
            required
            autocomplete="url"
            spellcheck="false"
          />
          <button type="submit" id="scan-button">Scan page</button>
        </div>
        <p class="form-hint">
          Analyzes &lt;img&gt; and &lt;picture&gt; elements. Estimates assume typical
          device pixel ratios (2× mobile/tablet, 1.5× desktop).
        </p>
      </form>

      <div id="status" class="status hidden" aria-live="polite"></div>
      <div id="results" class="results hidden"></div>

      <footer class="footer">
        <p>
          Built to highlight responsive image wins —
          <a href="https://developer.mozilla.org/en-US/docs/Web/HTML/Responsive_images" target="_blank" rel="noopener">MDN responsive images guide</a>
        </p>
      </footer>
    </div>
  `;
}

export function bindScanForm(onSubmit: (url: string) => void): void {
  const form = document.getElementById("scan-form") as HTMLFormElement;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("url-input") as HTMLInputElement;
    onSubmit(input.value);
  });
}

export function setLoading(loading: boolean): void {
  const button = document.getElementById("scan-button") as HTMLButtonElement;
  const input = document.getElementById("url-input") as HTMLInputElement;
  button.disabled = loading;
  input.disabled = loading;
  button.textContent = loading ? "Scanning…" : "Scan page";
}

export function showProgress(progress: ScanProgress): void {
  const status = document.getElementById("status")!;
  status.classList.remove("hidden", "error");

  if (progress.phase === "error") {
    status.classList.add("error");
    status.innerHTML = `<p>${escapeHtml(progress.message)}</p>`;
    return;
  }

  const bar =
    progress.total && progress.current
      ? `<div class="progress-bar"><div class="progress-fill" style="width:${(progress.current / progress.total) * 100}%"></div></div>`
      : `<div class="progress-bar indeterminate"><div class="progress-fill"></div></div>`;

  status.innerHTML = `<p>${escapeHtml(progress.message)}</p>${bar}`;
}

export function hideProgress(): void {
  document.getElementById("status")!.classList.add("hidden");
}

export function showError(message: string): void {
  showProgress({ phase: "error", message });
}

export function renderResults(summary: ScanSummary): void {
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

function wasteGrade(percent: number): { label: string; class: string } {
  if (percent <= 10) return { label: "Well optimized", class: "grade-good" };
  if (percent <= 30) return { label: "Room to improve", class: "grade-warn" };
  return { label: "Significant waste", class: "grade-bad" };
}

function truncateUrl(url: string, max: number): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 1) + "…";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function clearResults(): void {
  document.getElementById("results")!.classList.add("hidden");
  document.getElementById("results")!.innerHTML = "";
}

import type { OptimizeResult } from "../optimizer/types.js";
import { formatBytes, formatPercent } from "../scanner/utils.js";
import { escapeHtml } from "./utils.js";

let latestResult: OptimizeResult | null = null;

export function setOptimizeResult(result: OptimizeResult | null): void {
  latestResult = result;
}

export function getOptimizeResult(): OptimizeResult | null {
  return latestResult;
}

export function renderOptimizeResults(result: OptimizeResult): void {
  setOptimizeResult(result);
  const results = document.getElementById("results")!;
  results.classList.remove("hidden");

  const variantRows = result.variants
    .map(
      (v) => `
      <tr>
        <td><span class="zone-pill zone-content">${escapeHtml(v.label)}</span></td>
        <td class="mono">${v.width}×${v.height}</td>
        <td class="mono">${formatBytes(v.byteSize)}</td>
        <td>
          <button type="button" class="dl-btn" data-download-variant="${escapeHtml(v.filename)}">
            Download
          </button>
        </td>
      </tr>`,
    )
    .join("");

  results.innerHTML = `
    <section class="summary-header">
      <div>
        <h2>Crushed: ${escapeHtml(result.fileName)}</h2>
        <p>${result.originalWidth}×${result.originalHeight} · was ${formatBytes(result.originalBytes)}</p>
      </div>
      <div class="headline-stat">
        <span class="headline-value">${formatPercent(result.savedPercent)}</span>
        <span class="headline-label">saved</span>
        <span class="headline-sub">${formatBytes(result.savedBytes)} lighter</span>
      </div>
    </section>

    <div class="report-actions">
      <button type="button" class="pdf-btn" id="download-all-btn">Download all (ZIP)</button>
      <button type="button" class="pdf-btn secondary" id="copy-srcset-btn">Copy srcset HTML</button>
    </div>

    <section class="images-section">
      <h3>Variants</h3>
      <div class="table-wrap">
        <table class="link-table">
          <thead>
            <tr><th>Breakpoint</th><th>Size</th><th>Weight</th><th></th></tr>
          </thead>
          <tbody>${variantRows}</tbody>
        </table>
      </div>
    </section>

    <section class="images-section">
      <h3>srcset snippet</h3>
      <pre class="srcset-snippet">${escapeHtml(result.srcsetSnippet)}</pre>
    </section>
  `;
}

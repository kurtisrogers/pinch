import { scanPage } from "./scanner/analyzer.js";
import type { OptimizeOptions } from "./optimizer/types.js";
import { downloadLinkReportPdf } from "./spider/pdf-report.js";
import { runSpiderAndLinkCheck } from "./spider/runner.js";
import {
  bindApp,
  clearResults,
  renderApp,
  renderImageResults,
  renderSpiderResults,
  setLoading,
  showError,
  showProgress,
} from "./ui/render.js";
import {
  getOptimizeResult,
} from "./ui/render-optimize.js";
import "./styles.css";

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app element");

renderApp(app);

const bindings = bindApp({
  onImageScan: handleImageScan,
  onOptimize: handleOptimize,
  onSpiderScan: handleSpiderScan,
  onAuditScan: handleAuditScan,
  onDownloadPdf: handleDownloadPdf,
  onDownloadOptimizeZip: handleDownloadOptimizeZip,
  onDownloadVariant: handleDownloadVariant,
  onCopySrcset: handleCopySrcset,
});

async function handleImageScan(url: string): Promise<void> {
  clearResults();
  setLoading(true, "images");

  try {
    const summary = await scanPage(url, (progress) => showProgress(progress));
    renderImageResults(summary);
  } catch (err) {
    showError(err instanceof Error ? err.message : "An unexpected error occurred");
  } finally {
    setLoading(false, bindings.getMode());
  }
}

async function handleOptimize(file: File, options: OptimizeOptions): Promise<void> {
  clearResults();
  setLoading(true, "optimize");

  try {
    const { optimizeImageFile } = await import("./optimizer/runner.js");
    const { renderOptimizeResults } = await import("./ui/render-optimize.js");
    const result = await optimizeImageFile(file, options, (progress) => showProgress(progress));
    renderOptimizeResults(result);
  } catch (err) {
    showError(err instanceof Error ? err.message : "An unexpected error occurred");
  } finally {
    setLoading(false, bindings.getMode());
  }
}

async function handleSpiderScan(
  url: string,
  options: { maxPages: number; maxDepth: number; sameOrigin: boolean },
): Promise<void> {
  clearResults();
  setLoading(true, "spider");

  try {
    const report = await runSpiderAndLinkCheck(url, options, (progress) =>
      showProgress(progress),
    );
    bindings.setSpiderReport(report);
    renderSpiderResults(report);
  } catch (err) {
    showError(err instanceof Error ? err.message : "An unexpected error occurred");
  } finally {
    setLoading(false, bindings.getMode());
  }
}

async function handleAuditScan(url: string): Promise<void> {
  clearResults();
  setLoading(true, "audit");

  try {
    const { runPageAudit } = await import("./audit/runner.js");
    const { renderAuditResults } = await import("./ui/render-audit.js");
    const report = await runPageAudit(url, (progress) => showProgress(progress));
    renderAuditResults(report);
  } catch (err) {
    showError(err instanceof Error ? err.message : "An unexpected error occurred");
  } finally {
    setLoading(false, bindings.getMode());
  }
}

function handleDownloadPdf(): void {
  const report = bindings.getSpiderReport();
  if (!report) {
    showError("No spider report available. Run a crawl first.");
    return;
  }
  downloadLinkReportPdf(report);
}

async function handleDownloadOptimizeZip(): Promise<void> {
  const result = getOptimizeResult();
  if (!result) {
    showError("No optimization results to download.");
    return;
  }
  const format = (document.getElementById("opt-format") as HTMLSelectElement)?.value ?? "webp";
  const { downloadAllAsZip } = await import("./optimizer/runner.js");
  await downloadAllAsZip(result, format);
}

function handleDownloadVariant(filename: string): void {
  const result = getOptimizeResult();
  const variant = result?.variants.find((v) => v.filename === filename);
  if (!variant) return;
  import("./optimizer/runner.js").then(({ downloadVariant }) => downloadVariant(variant));
}

async function handleCopySrcset(): Promise<void> {
  const result = getOptimizeResult();
  if (!result) return;
  try {
    await navigator.clipboard.writeText(result.srcsetSnippet);
  } catch {
    showError("Could not copy to clipboard.");
  }
}

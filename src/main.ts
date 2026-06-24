import { scanPage } from "./scanner/analyzer.js";
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
import "./styles.css";

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app element");

renderApp(app);

const bindings = bindApp({
  onImageScan: handleImageScan,
  onSpiderScan: handleSpiderScan,
  onAuditScan: handleAuditScan,
  onDownloadPdf: handleDownloadPdf,
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

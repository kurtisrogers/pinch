import { scanPage } from "./scanner/analyzer.js";
import type { OptimizeOptions } from "./optimizer/types.js";
import { downloadLinkReportPdf } from "./spider/pdf-report.js";
import {
  bindApp,
  clearResults,
  renderApp,
  renderImageResults,
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
  onCrawlScan: handleCrawlScan,
  onDevAuditScan: handleDevAuditScan,
  onHarAnalyze: handleHarAnalyze,
  onBaselineDiff: handleBaselineDiff,
  onDownloadPdf: handleDownloadPdf,
  onDownloadOptimizeZip: handleDownloadOptimizeZip,
  onDownloadVariant: handleDownloadVariant,
  onCopySrcset: handleCopySrcset,
  onSaveBaseline: handleSaveBaseline,
  onExportJson: handleExportJson,
  onExportMarkdown: handleExportMarkdown,
  onClearBaseline: handleClearBaseline,
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

async function handleCrawlScan(
  url: string,
  options: { maxPages: number; maxDepth: number; sameOrigin: boolean },
): Promise<void> {
  clearResults();
  setLoading(true, "crawl");

  try {
    const { runCrawlPlus } = await import("./devkit/runner-crawl-plus.js");
    const { renderCrawlPlusResults } = await import("./ui/render-crawl-plus.js");
    const report = await runCrawlPlus(url, options, (progress) => showProgress(progress));
    bindings.setSpiderReport(report.spider);
    renderCrawlPlusResults(report);
  } catch (err) {
    showError(err instanceof Error ? err.message : "An unexpected error occurred");
  } finally {
    setLoading(false, bindings.getMode());
  }
}

async function handleDevAuditScan(url: string): Promise<void> {
  clearResults();
  setLoading(true, "devaudit");

  try {
    const { runDevAudit } = await import("./devkit/runner-dev-audit.js");
    const { renderDevAuditResults } = await import("./ui/render-devkit.js");
    const { devReport, auditReport } = await runDevAudit(url, (progress) => showProgress(progress));
    renderDevAuditResults(devReport, auditReport);
  } catch (err) {
    showError(err instanceof Error ? err.message : "An unexpected error occurred");
  } finally {
    setLoading(false, bindings.getMode());
  }
}

async function handleHarAnalyze(file: File): Promise<void> {
  clearResults();
  setLoading(true, "tools");

  try {
    const text = await file.text();
    const { parseHarFile } = await import("./devkit/tools/har.js");
    const { renderHarResults } = await import("./ui/render-devkit.js");
    const summary = parseHarFile(file.name, text);
    renderHarResults(summary);
  } catch (err) {
    showError(err instanceof Error ? err.message : "Could not parse HAR file");
  } finally {
    setLoading(false, bindings.getMode());
  }
}

async function handleBaselineDiff(): Promise<void> {
  clearResults();
  setLoading(true, "tools");

  try {
    const { loadBaseline, diffAgainstBaseline } = await import("./devkit/tools/baseline.js");
    const { renderBaselineDiff } = await import("./ui/render-devkit.js");
    const baseline = loadBaseline();
    if (!baseline) {
      showError("No baseline saved yet. Run Dev Audit and click Save baseline.");
      return;
    }
    const changes = diffAgainstBaseline(baseline.report);
    renderBaselineDiff(changes);
  } catch (err) {
    showError(err instanceof Error ? err.message : "Baseline diff failed");
  } finally {
    setLoading(false, bindings.getMode());
  }
}

function handleDownloadPdf(): void {
  const report = bindings.getSpiderReport();
  if (!report) {
    showError("No crawl report available. Run a crawl first.");
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
    await navigator.clipboard.writeText(result.pictureSnippet || result.srcsetSnippet);
  } catch {
    showError("Could not copy to clipboard.");
  }
}

function handleSaveBaseline(): void {
  import("./ui/render-devkit.js").then(({ getDevAuditReport }) => {
    const report = getDevAuditReport();
    if (!report) {
      showError("Run a Dev Audit first.");
      return;
    }
    import("./devkit/tools/baseline.js").then(({ saveBaseline }) => {
      saveBaseline(report);
      showProgress({ phase: "complete", message: "Baseline saved to browser storage." });
    });
  });
}

function handleExportJson(): void {
  import("./ui/render-devkit.js").then(({ getDevAuditReport }) => {
    const report = getDevAuditReport();
    if (!report) {
      showError("Run a Dev Audit first.");
      return;
    }
    import("./devkit/tools/baseline.js").then(({ exportDevAuditJson }) => exportDevAuditJson(report));
  });
}

function handleExportMarkdown(): void {
  import("./ui/render-devkit.js").then(({ getDevAuditReport, getAuditReport }) => {
    const report = getDevAuditReport();
    if (!report) {
      showError("Run a Dev Audit first.");
      return;
    }
    const audit = getAuditReport() ?? undefined;
    import("./devkit/tools/baseline.js").then(({ exportDevAuditMarkdown }) =>
      exportDevAuditMarkdown(report, audit),
    );
  });
}

function handleClearBaseline(): void {
  import("./devkit/tools/baseline.js").then(({ clearBaseline }) => {
    clearBaseline();
    showProgress({ phase: "complete", message: "Baseline cleared." });
  });
}

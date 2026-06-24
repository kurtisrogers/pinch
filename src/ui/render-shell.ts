import type { ScanProgress } from "../scanner/types.js";
import type { AuditProgress } from "../audit/types.js";
import type { OptimizeProgress } from "../optimizer/types.js";
import type { SpiderProgress, SpiderReport } from "../spider/types.js";
import { cocktailLoaderHtml } from "./cocktail-loader.js";
import { escapeHtml } from "./utils.js";
import { formatBytes } from "../scanner/utils.js";

export type AppMode = "optimize" | "images" | "devaudit" | "crawl" | "tools";

type Progress = ScanProgress | SpiderProgress | AuditProgress | OptimizeProgress | import("../devkit/types.js").DevProgress;

export interface ModeConfig {
  icon: string;
  label: string;
  button: string;
  loading: string;
  hint: string;
  panel: "url" | "optimize" | "crawl" | "tools";
}

export const MODES: AppMode[] = ["optimize", "images", "devaudit", "crawl", "tools"];

export const MODE_CONFIG: Record<AppMode, ModeConfig> = {
  optimize: {
    icon: "🍹",
    label: "Crush",
    button: "Crush it",
    loading: "Shaking…",
    hint: "Drop an image to compress like TinyPNG. Export PNG, JPEG, WebP, or GIF — responsive sets, favicon/OG packs, and picture snippets.",
    panel: "optimize",
  },
  images: {
    icon: "🌴",
    label: "Scan",
    button: "Scan page",
    loading: "Scanning…",
    hint: "See how much image bandwidth a page over-serves on mobile, tablet, and desktop.",
    panel: "url",
  },
  devaudit: {
    icon: "🌅",
    label: "Dev Audit",
    button: "Run dev audit",
    loading: "Auditing…",
    hint: "Full developer audit: HTML/UX/a11y, Core Web Vitals hints, schema, security headers, fonts, scripts, OG preview — export JSON or save a baseline.",
    panel: "url",
  },
  crawl: {
    icon: "🕷️",
    label: "Crawl",
    button: "Crawl & check",
    loading: "Crawling…",
    hint: "Site spider with dead links, redirect chains, mixed content checks, and sitemap validation. Download a PDF report.",
    panel: "crawl",
  },
  tools: {
    icon: "🛠️",
    label: "Tools",
    button: "Analyze HAR",
    loading: "Analyzing…",
    hint: "Import a Chrome HAR file, compare against a saved Dev Audit baseline, or run baseline diff after a dev audit.",
    panel: "tools",
  },
};

export function renderApp(container: HTMLElement): void {
  const navChips = MODES.map(
    (mode, i) => {
      const cfg = MODE_CONFIG[mode];
      return `
        <button
          type="button"
          class="nav-chip${i === 0 ? " active" : ""}"
          data-mode="${mode}"
          role="tab"
          aria-selected="${i === 0}"
        >
          <span class="chip-icon">${cfg.icon}</span>
          <span class="chip-label">${cfg.label}</span>
        </button>`;
    },
  ).join("");

  container.innerHTML = `
    <div class="page">
      <div class="skyline" aria-hidden="true"></div>
      <header class="hero">
        <div class="hero-badge">Miami, 1989 · browser edition</div>
        <h1>Pinch</h1>
        <p class="hero-sub">
          Crush images, scan pages, crawl sites, run dev audits, and analyze HAR files —
          neon-soaked site tools that run in your browser.
        </p>
      </header>

      <nav class="nav-rail" role="tablist" aria-label="Tools">${navChips}</nav>

      <form class="scan-form" id="scan-form">
        <div id="url-panel" class="panel hidden">
          <label class="sr-only" for="url-input">Website URL</label>
          <div class="input-row">
            <input id="url-input" type="url" name="url" placeholder="https://example.com" autocomplete="url" spellcheck="false" />
            <button type="submit" id="scan-button">${MODE_CONFIG.images.button}</button>
          </div>
        </div>

        <div id="optimize-panel" class="panel">
          <div class="dropzone" id="dropzone">
            <input type="file" id="file-input" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
            <span class="dropzone-icon">🍸</span>
            <p class="dropzone-title">Drop your image here</p>
            <p class="dropzone-sub">or <button type="button" class="link-btn" id="browse-btn">browse files</button></p>
            <p class="dropzone-meta" id="file-name">PNG · JPEG · WebP · GIF</p>
          </div>

          <div class="options-grid optimize-grid">
            <label>
              Format
              <select id="opt-format">
                <option value="webp">WebP</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
                <option value="gif">GIF</option>
              </select>
            </label>
            <label>
              Quality
              <input type="range" id="opt-quality" min="40" max="100" value="82" />
              <span class="range-val" id="quality-val">82</span>
            </label>
            <label class="checkbox-label span-2">
              <input type="checkbox" id="opt-responsive" checked />
              Export responsive set (mobile / tablet / desktop)
            </label>
            <label class="checkbox-label span-2">
              <input type="checkbox" id="opt-asset-pack" />
              Generate favicon + OG asset pack (16–512px + 1200×630)
            </label>
            <label>
              Mobile (px)
              <input type="number" id="width-mobile" min="100" max="4000" value="780" />
            </label>
            <label>
              Tablet (px)
              <input type="number" id="width-tablet" min="100" max="4000" value="1536" />
            </label>
            <label>
              Desktop (px)
              <input type="number" id="width-desktop" min="100" max="4000" value="1920" />
            </label>
          </div>
          <button type="button" class="submit-full" id="optimize-button" disabled>Crush it</button>
        </div>

        <div id="crawl-options" class="crawl-options hidden panel-inner">
          <div class="options-grid">
            <label>Max pages <input type="number" id="max-pages" min="1" max="100" value="25" /></label>
            <label>Max depth <input type="number" id="max-depth" min="0" max="5" value="2" /></label>
            <label class="checkbox-label">
              <input type="checkbox" id="same-origin" checked /> Same domain only
            </label>
          </div>
        </div>

        <div id="tools-panel" class="panel hidden">
          <div class="tools-grid">
            <div class="tool-block">
              <h3>HAR analyzer</h3>
              <p class="tool-desc">Export from Chrome DevTools → Network → Save all as HAR.</p>
              <input type="file" id="har-input" accept=".har,application/json" hidden />
              <button type="button" class="submit-full" id="har-browse-btn">Choose HAR file</button>
              <p class="dropzone-meta" id="har-file-name">No file selected</p>
            </div>
            <div class="tool-block">
              <h3>Baseline diff</h3>
              <p class="tool-desc">Compare your last saved Dev Audit baseline to spot regressions.</p>
              <button type="button" class="submit-full secondary-btn" id="baseline-diff-btn">Show baseline diff</button>
            </div>
          </div>
        </div>

        <p class="form-hint" id="form-hint">${MODE_CONFIG.optimize.hint}</p>
      </form>

      <div id="status" class="status hidden" aria-live="polite"></div>
      <div id="results" class="results hidden"></div>

      <footer class="footer">
        <p>Welcome to the vibe · images stay in your browser · no upload server</p>
      </footer>
    </div>
  `;
}

export interface AppBindings {
  getSpiderReport: () => SpiderReport | null;
  setSpiderReport: (report: SpiderReport | null) => void;
  getMode: () => AppMode;
  getSelectedFile: () => File | null;
  getSelectedHarFile: () => File | null;
}

export function bindApp(handlers: {
  onImageScan: (url: string) => void;
  onOptimize: (file: File, options: import("../optimizer/types.js").OptimizeOptions) => void;
  onCrawlScan: (url: string, options: { maxPages: number; maxDepth: number; sameOrigin: boolean }) => void;
  onDevAuditScan: (url: string) => void;
  onHarAnalyze: (file: File) => void;
  onBaselineDiff: () => void;
  onDownloadPdf: () => void;
  onDownloadOptimizeZip: () => void;
  onDownloadVariant: (filename: string) => void;
  onCopySrcset: () => void;
  onSaveBaseline: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onClearBaseline: () => void;
}): AppBindings {
  let latestSpiderReport: SpiderReport | null = null;
  let mode: AppMode = "optimize";
  let selectedFile: File | null = null;
  let selectedHarFile: File | null = null;

  const form = document.getElementById("scan-form") as HTMLFormElement;
  const tabs = document.querySelectorAll<HTMLButtonElement>(".nav-chip");
  const urlPanel = document.getElementById("url-panel")!;
  const optimizePanel = document.getElementById("optimize-panel")!;
  const crawlOptions = document.getElementById("crawl-options")!;
  const toolsPanel = document.getElementById("tools-panel")!;
  const formHint = document.getElementById("form-hint")!;
  const scanButton = document.getElementById("scan-button") as HTMLButtonElement;
  const optimizeButton = document.getElementById("optimize-button") as HTMLButtonElement;
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  const harInput = document.getElementById("har-input") as HTMLInputElement;
  const harFileNameEl = document.getElementById("har-file-name")!;
  const dropzone = document.getElementById("dropzone")!;
  const fileNameEl = document.getElementById("file-name")!;
  const qualitySlider = document.getElementById("opt-quality") as HTMLInputElement;
  const qualityVal = document.getElementById("quality-val")!;

  function applyMode(next: AppMode): void {
    mode = next;
    const config = MODE_CONFIG[mode];
    urlPanel.classList.toggle("hidden", config.panel !== "url" && config.panel !== "crawl");
    optimizePanel.classList.toggle("hidden", config.panel !== "optimize");
    crawlOptions.classList.toggle("hidden", config.panel !== "crawl");
    toolsPanel.classList.toggle("hidden", config.panel !== "tools");
    scanButton.classList.toggle("hidden", config.panel === "optimize" || config.panel === "tools");
    scanButton.textContent = config.button;
    formHint.textContent = config.hint;
    urlPanel.querySelector("#url-input")?.toggleAttribute("required", config.panel === "url" || config.panel === "crawl");
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const next = tab.dataset.mode as AppMode;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", String(active));
      });
      applyMode(next);
    });
  });

  applyMode("optimize");

  qualitySlider.addEventListener("input", () => {
    qualityVal.textContent = qualitySlider.value;
  });

  document.getElementById("browse-btn")!.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) setFile(file);
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith("image/")) setFile(file);
  });

  function setFile(file: File): void {
    selectedFile = file;
    fileNameEl.textContent = `${file.name} · ${formatBytes(file.size)}`;
    optimizeButton.disabled = false;
    dropzone.classList.add("has-file");
  }

  optimizeButton.addEventListener("click", () => {
    if (!selectedFile) return;
    handlers.onOptimize(selectedFile, readOptimizeOptions());
  });

  document.getElementById("har-browse-btn")!.addEventListener("click", () => harInput.click());

  harInput.addEventListener("change", () => {
    const file = harInput.files?.[0];
    if (file) {
      selectedHarFile = file;
      harFileNameEl.textContent = file.name;
      handlers.onHarAnalyze(file);
    }
  });

  document.getElementById("baseline-diff-btn")!.addEventListener("click", () => {
    handlers.onBaselineDiff();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (mode === "optimize") return;

    if (mode === "tools") return;

    const input = document.getElementById("url-input") as HTMLInputElement;
    switch (mode) {
      case "images":
        handlers.onImageScan(input.value);
        break;
      case "crawl":
        handlers.onCrawlScan(input.value, {
          maxPages: parseInt((document.getElementById("max-pages") as HTMLInputElement).value, 10) || 25,
          maxDepth: parseInt((document.getElementById("max-depth") as HTMLInputElement).value, 10) || 2,
          sameOrigin: (document.getElementById("same-origin") as HTMLInputElement).checked,
        });
        break;
      case "devaudit":
        handlers.onDevAuditScan(input.value);
        break;
      default: {
        const _exhaustive: never = mode;
        return _exhaustive;
      }
    }
  });

  document.getElementById("results")!.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.id === "download-pdf-btn") handlers.onDownloadPdf();
    if (target.id === "download-all-btn") handlers.onDownloadOptimizeZip();
    if (target.id === "copy-srcset-btn") handlers.onCopySrcset();
    if (target.id === "save-baseline-btn") handlers.onSaveBaseline();
    if (target.id === "export-json-btn") handlers.onExportJson();
    if (target.id === "export-md-btn") handlers.onExportMarkdown();
    if (target.id === "clear-baseline-btn") handlers.onClearBaseline();
    const variant = target.getAttribute("data-download-variant");
    if (variant) handlers.onDownloadVariant(variant);
  });

  return {
    getSpiderReport: () => latestSpiderReport,
    setSpiderReport: (report) => {
      latestSpiderReport = report;
    },
    getMode: () => mode,
    getSelectedFile: () => selectedFile,
    getSelectedHarFile: () => selectedHarFile,
  };
}

function readOptimizeOptions(): import("../optimizer/types.js").OptimizeOptions {
  return {
    format: (document.getElementById("opt-format") as HTMLSelectElement).value as import("../optimizer/types.js").ExportFormat,
    quality: parseInt((document.getElementById("opt-quality") as HTMLInputElement).value, 10),
    responsive: (document.getElementById("opt-responsive") as HTMLInputElement).checked,
    assetPack: (document.getElementById("opt-asset-pack") as HTMLInputElement).checked,
    widths: {
      mobile: parseInt((document.getElementById("width-mobile") as HTMLInputElement).value, 10) || 780,
      tablet: parseInt((document.getElementById("width-tablet") as HTMLInputElement).value, 10) || 1536,
      desktop: parseInt((document.getElementById("width-desktop") as HTMLInputElement).value, 10) || 1920,
    },
  };
}

export function setLoading(loading: boolean, mode: AppMode = "optimize"): void {
  const config = MODE_CONFIG[mode];
  const scanButton = document.getElementById("scan-button") as HTMLButtonElement;
  const optimizeButton = document.getElementById("optimize-button") as HTMLButtonElement;
  const urlInput = document.getElementById("url-input") as HTMLInputElement;
  const dropzone = document.getElementById("dropzone")!;

  scanButton.disabled = loading;
  urlInput.disabled = loading;

  if (mode === "optimize") {
    optimizeButton.textContent = loading ? config.loading : config.button;
    optimizeButton.disabled = loading || !dropzone.classList.contains("has-file");
  } else {
    scanButton.textContent = loading ? config.loading : config.button;
  }

  if (loading) {
    showCocktailProgress("Mixing your results…");
  }
}

export function showProgress(progress: Progress): void {
  const status = document.getElementById("status")!;
  status.classList.remove("hidden", "error");

  if (progress.phase === "error") {
    status.classList.add("error");
    status.innerHTML = `<p>${escapeHtml(progress.message)}</p>`;
    return;
  }

  const pct =
    "total" in progress && progress.total && progress.current
      ? Math.round((progress.current / progress.total) * 100)
      : undefined;

  status.innerHTML = `
    ${cocktailLoaderHtml(pct)}
    <p class="cocktail-message">${escapeHtml(progress.message)}</p>
  `;
}

function showCocktailProgress(message: string): void {
  const status = document.getElementById("status")!;
  status.classList.remove("hidden", "error");
  status.innerHTML = `
    ${cocktailLoaderHtml()}
    <p class="cocktail-message">${escapeHtml(message)}</p>
  `;
}

export function showError(message: string): void {
  showProgress({ phase: "error", message });
}

export function clearResults(): void {
  document.getElementById("results")!.classList.add("hidden");
  document.getElementById("results")!.innerHTML = "";
}

// Re-export result renderers
export { renderImageResults, renderSpiderResults } from "./render-results.js";

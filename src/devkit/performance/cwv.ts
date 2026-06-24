import type { DevFinding, PageContext } from "../types.js";
import { finding } from "../page-context.js";

export function analyzeCoreWebVitals(ctx: PageContext): DevFinding[] {
  const { doc, url } = ctx;
  const findings: DevFinding[] = [];

  const imgs = doc.querySelectorAll("img");
  const firstImg = doc.querySelector("img[src], img[data-src]");
  if (firstImg && !firstImg.getAttribute("loading")) {
    findings.push(finding("cwv-lcp-lazy", "performance", "warning", "LCP image may not be prioritized", "Hero/first image lacks loading attribute — ensure LCP image is not lazy-loaded and uses fetchpriority=\"high\" if needed."));
  }

  if (imgs.length > 0) {
    const withoutDims = [...imgs].filter((img) => !img.getAttribute("width") && !img.getAttribute("height")).length;
    if (withoutDims > 0) {
      findings.push(finding("cwv-cls-dims", "performance", "warning", `${withoutDims} images without width/height`, "Missing dimensions cause layout shift (CLS). Add width and height attributes."));
    }
  }

  const blockingScripts = [...doc.querySelectorAll("script[src]")].filter(
    (s) => {
      const script = s as HTMLScriptElement;
      return !script.async && !script.defer && script.getAttribute("type") !== "module";
    },
  );
  if (blockingScripts.length > 2) {
    findings.push(finding("cwv-inp-scripts", "performance", "warning", `${blockingScripts.length} render-blocking scripts`, "Blocking scripts delay interactivity (INP). Use defer/async or move to end of body."));
  }

  const preconnect = doc.querySelectorAll('link[rel="preconnect"]').length;
  const fonts = doc.querySelectorAll('link[href*="fonts"]').length;
  if (fonts > 0 && preconnect === 0) {
    findings.push(finding("cwv-preconnect", "performance", "info", "No preconnect for fonts", "Add <link rel=\"preconnect\"> to font origins to improve LCP."));
  }

  if (!doc.querySelector('link[rel="preload"][as="image"]') && imgs.length > 3) {
    findings.push(finding("cwv-preload-lcp", "performance", "info", "Consider preloading LCP image", "Identify the largest above-fold image and preload it."));
  }

  if (findings.length === 0) {
    findings.push(finding("cwv-ok", "performance", "info", "No obvious CWV red flags", `Heuristic pass for ${url} — run Lighthouse for lab metrics.`));
  }

  return findings;
}

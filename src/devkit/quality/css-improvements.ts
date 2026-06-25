import type { DevFinding, PageContext } from "../types.js";
import { fetchText, finding, resolveOnPage } from "../page-context.js";

const MAX_STYLESHEETS = 5;
const LARGE_CSS_BYTES = 120_000;

export async function analyzeCssImprovements(ctx: PageContext): Promise<DevFinding[]> {
  const { doc, url } = ctx;
  const findings: DevFinding[] = [];

  findings.push(...analyzeHtmlCssSmells(doc));

  const sheetUrls = [...doc.querySelectorAll('link[rel="stylesheet"][href]')]
    .map((link) => resolveOnPage(url, link.getAttribute("href") ?? ""))
    .slice(0, MAX_STYLESHEETS);

  if (sheetUrls.length === 0) {
    findings.push(
      finding(
        "css-no-external",
        "css-improvements",
        "info",
        "No linked stylesheets on this page",
        "CSS improvement scan is limited to inline HTML signals.",
      ),
    );
    return findings;
  }

  let fetched = 0;
  for (const sheetUrl of sheetUrls) {
    try {
      const css = await fetchText(sheetUrl);
      fetched++;
      analyzeStylesheet(css, sheetUrl, findings);
    } catch {
      findings.push(
        finding(
          `css-fetch-${hashUrl(sheetUrl)}`,
          "css-improvements",
          "info",
          "Could not fetch stylesheet",
          `Proxy may block ${sheetUrl}. Some CSS checks skipped.`,
        ),
      );
    }
  }

  if (fetched > 0 && findings.filter((f) => f.category === "css-improvements" && f.severity !== "info").length === 0) {
    findings.push(
      finding(
        "css-sheets-ok",
        "css-improvements",
        "info",
        `Reviewed ${fetched} stylesheet(s)`,
        "No major maintainability red flags in fetched CSS.",
      ),
    );
  }

  return findings;
}

function analyzeHtmlCssSmells(doc: Document): DevFinding[] {
  const findings: DevFinding[] = [];

  const styledWithoutClass = doc.querySelectorAll("[style]:not([class])").length;
  if (styledWithoutClass > 5) {
    findings.push(
      finding(
        "css-inline-no-class",
        "css-improvements",
        "warning",
        `${styledWithoutClass} inline-styled elements without classes`,
        "Move repeated inline styles into reusable classes or CSS variables.",
      ),
    );
  }

  const hardcodedColors = (doc.documentElement.innerHTML.match(/(?:color|background)\s*:\s*#[0-9a-f]{3,8}/gi) ?? []).length;
  if (hardcodedColors > 10) {
    findings.push(
      finding(
        "css-hardcoded-colors",
        "css-improvements",
        "info",
        `${hardcodedColors} inline hex colors in HTML`,
        "Extract a palette with CSS custom properties (--color-primary, etc.).",
      ),
    );
  }

  const styleBlocks = doc.querySelectorAll("style");
  if (styleBlocks.length > 3) {
    findings.push(
      finding(
        "css-many-style-tags",
        "css-improvements",
        "warning",
        `${styleBlocks.length} inline <style> blocks`,
        "Consolidate into external stylesheets for caching and maintainability.",
      ),
    );
  }

  return findings;
}

function analyzeStylesheet(css: string, sheetUrl: string, findings: DevFinding[]): void {
  const label = truncateUrl(sheetUrl);
  const bytes = new TextEncoder().encode(css).length;

  if (bytes > LARGE_CSS_BYTES) {
    findings.push(
      finding(
        `css-large-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "warning",
        `Large stylesheet (${formatBytes(bytes)})`,
        `${label} — split critical CSS, remove unused rules, or code-split by route.`,
      ),
    );
  }

  const importantCount = (css.match(/!important/g) ?? []).length;
  if (importantCount > 15) {
    findings.push(
      finding(
        `css-important-sheet-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "warning",
        `${importantCount} !important in ${label}`,
        "High !important usage indicates specificity wars — refactor selectors or layers.",
      ),
    );
  }

  const idSelectors = (css.match(/#[a-zA-Z][\w-]*/g) ?? []).length;
  if (idSelectors > 8) {
    findings.push(
      finding(
        `css-id-selectors-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "info",
        `${idSelectors} ID selectors in ${label}`,
        "Prefer classes for styling — IDs are hard to reuse and override.",
      ),
    );
  }

  const imports = (css.match(/@import/g) ?? []).length;
  if (imports > 0) {
    findings.push(
      finding(
        `css-import-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "warning",
        `${imports} @import in ${label}`,
        "@import blocks rendering. Use <link> tags or bundle into one file.",
      ),
    );
  }

  const mediaQueries = (css.match(/@media/g) ?? []).length;
  if (mediaQueries > 25) {
    findings.push(
      finding(
        `css-media-many-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "info",
        `${mediaQueries} @media blocks in ${label}`,
        "Consider mobile-first with fewer breakpoints, or container queries where appropriate.",
      ),
    );
  }

  const hexColors = new Set(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []);
  const cssVars = (css.match(/--[\w-]+/g) ?? []).length;
  if (hexColors.size > 20 && cssVars < 5) {
    findings.push(
      finding(
        `css-tokenize-colors-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "warning",
        `${hexColors.size} unique hex colors, few CSS variables`,
        `${label} — introduce design tokens (--color-*, --space-*) for consistency.`,
      ),
    );
  }

  const zIndexes = [...(css.match(/z-index\s*:\s*(-?\d+)/g) ?? [])].map((m) => parseInt(m.split(":")[1] ?? "0", 10));
  const highZ = zIndexes.filter((z) => z > 100);
  if (highZ.length > 3) {
    findings.push(
      finding(
        `css-zindex-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "warning",
        "Z-index stacking may be unmanageable",
        `${highZ.length} rules with z-index > 100 in ${label}. Document a layering scale (dropdown: 100, modal: 200).`,
      ),
    );
  }

  if (!css.includes(":focus-visible") && css.includes(":hover") && !css.includes("@layer")) {
    findings.push(
      finding(
        `css-focus-visible-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "info",
        "No :focus-visible rules detected",
        `${label} has :hover styles but no focus-visible — keyboard users may lack visible focus.`,
      ),
    );
  }

  if (css.includes("@keyframes") && !css.includes("prefers-reduced-motion")) {
    findings.push(
      finding(
        `css-motion-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "info",
        "Animations without prefers-reduced-motion",
        `Wrap animations in @media (prefers-reduced-motion: no-preference) in ${label}.`,
      ),
    );
  }

  const deepSelectors = (css.match(/[\w.#\[\]:"'-]+\s+[\w.#\[\]:"'-]+\s+[\w.#\[\]:"'-]+\s+[\w.#\[\]:"'-]+\s*\{/g) ?? []).length;
  if (deepSelectors > 10) {
    findings.push(
      finding(
        `css-deep-nesting-${hashUrl(sheetUrl)}`,
        "css-improvements",
        "info",
        `${deepSelectors} deeply nested selectors`,
        "Flatten selectors (max 3 levels) to reduce specificity and duplication.",
      ),
    );
  }
}

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split("/").pop() ?? url;
  } catch {
    return url;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

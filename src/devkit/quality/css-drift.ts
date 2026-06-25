import type { CrawledPage } from "../../spider/types.js";
import type { DevFinding } from "../types.js";
import { finding } from "../page-context.js";

interface PageSnapshot {
  url: string;
  header: string | null;
  footer: string | null;
  nav: string | null;
  primaryButton: string | null;
  cardPattern: string | null;
}

const INTERACTIVE_SELECTOR =
  'button, [role="button"], a[class*="btn"], a[class*="button"], input[type="submit"], input[type="button"]';

const CARD_SELECTOR =
  '[class*="card"], [class*="tile"], [class*="panel"], article[class], .card, .tile, .panel';

const MIN_PAGES_FOR_DRIFT = 3;

export function analyzeComponentDrift(
  pages: CrawledPage[],
  onProgress?: (current: number, total: number) => void,
): DevFinding[] {
  const okPages = pages.filter((p) => p.html && !p.fetchError);
  if (okPages.length < 2) {
    return [
      finding(
        "drift-insufficient",
        "css-drift",
        "info",
        "Not enough pages for drift analysis",
        "Need at least 2 successfully crawled pages with HTML.",
      ),
    ];
  }

  const snapshots: PageSnapshot[] = [];

  for (let i = 0; i < okPages.length; i++) {
    onProgress?.(i + 1, okPages.length);
    const page = okPages[i];
    const doc = new DOMParser().parseFromString(page.html!, "text/html");
    snapshots.push({
      url: page.url,
      header: regionSignature(doc, "header", ['header', '[role="banner"]', "#header", ".header", ".site-header", ".page-header"]),
      footer: regionSignature(doc, "footer", ['footer', '[role="contentinfo"]', "#footer", ".footer", ".site-footer"]),
      nav: regionSignature(doc, "nav", ["nav", '[role="navigation"]', ".nav", ".navbar", ".main-nav", ".site-nav"]),
      primaryButton: primaryButtonSignature(doc),
      cardPattern: cardSignature(doc),
    });
  }

  const findings: DevFinding[] = [];

  findings.push(...driftForRegion("Header", snapshots, (s) => s.header));
  findings.push(...driftForRegion("Footer", snapshots, (s) => s.footer));
  findings.push(...driftForRegion("Main navigation", snapshots, (s) => s.nav));
  findings.push(...driftForRegion("Primary button style", snapshots, (s) => s.primaryButton));
  findings.push(...driftForRegion("Card / container", snapshots, (s) => s.cardPattern));
  findings.push(...analyzeCrossPageButtonSprawl(okPages));
  findings.push(...analyzeSharedClassDrift(okPages));

  if (findings.length === 0) {
    findings.push(
      finding(
        "drift-consistent",
        "css-drift",
        "info",
        "Component patterns look consistent sitewide",
        `Compared ${okPages.length} pages — no major header, nav, button, or card drift detected.`,
      ),
    );
  }

  return findings;
}

function driftForRegion(
  label: string,
  snapshots: PageSnapshot[],
  pick: (s: PageSnapshot) => string | null,
): DevFinding[] {
  const withRegion = snapshots.filter((s) => pick(s));
  if (withRegion.length < MIN_PAGES_FOR_DRIFT) return [];

  const bySignature = groupBy(withRegion, (s) => pick(s)!);
  if (bySignature.size <= 1) return [];

  const detail = [...bySignature.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([sig, items]) => `${items.length} page(s): ${sig}\n  ${formatPageList(items.map((i) => i.url))}`)
    .join("\n\n");

  return [
    finding(
      `drift-${label.toLowerCase().replace(/\s+/g, "-")}`,
      "css-drift",
      "warning",
      `${label} drift — ${bySignature.size} different patterns across ${withRegion.length} pages`,
      `Standardise ${label.toLowerCase()} markup/classes so the same site chrome looks and behaves the same everywhere.`,
      detail,
    ),
  ];
}

function analyzeCrossPageButtonSprawl(pages: CrawledPage[]): DevFinding[] {
  const classToPages = new Map<string, Set<string>>();

  for (const page of pages) {
    if (!page.html) continue;
    const doc = new DOMParser().parseFromString(page.html, "text/html");
    const seenOnPage = new Set<string>();

    for (const el of doc.querySelectorAll(INTERACTIVE_SELECTOR)) {
      const cls = normalizeClasses(el.getAttribute("class") ?? "");
      if (!cls || cls.split(" ").length < 2) continue;
      seenOnPage.add(cls);
    }

    for (const cls of seenOnPage) {
      const entry = classToPages.get(cls) ?? new Set<string>();
      entry.add(page.url);
      classToPages.set(cls, entry);
    }
  }

  const multiPageStyles = [...classToPages.entries()]
    .filter(([, urls]) => urls.size >= 2)
    .sort((a, b) => b[1].size - a[1].size);

  if (multiPageStyles.length <= 3) return [];

  const detail = multiPageStyles
    .slice(0, 8)
    .map(([cls, urls]) => `${urls.size} pages · "${truncate(cls, 65)}"\n  ${formatPageList([...urls])}`)
    .join("\n\n");

  return [
    finding(
      "drift-button-sprawl",
      "css-drift",
      "warning",
      `${multiPageStyles.length} distinct button/link class patterns sitewide`,
      "Many slightly different interactive class stacks across pages — consolidate into shared button variants (primary, secondary, ghost).",
      detail,
    ),
  ];
}

function analyzeSharedClassDrift(pages: CrawledPage[]): DevFinding[] {
  const prefixGroups = new Map<string, Map<string, Set<string>>>();

  for (const page of pages) {
    if (!page.html) continue;
    const doc = new DOMParser().parseFromString(page.html, "text/html");

    for (const el of doc.querySelectorAll("[class]")) {
      for (const token of tokenize(el.getAttribute("class") ?? "")) {
        const prefix = componentPrefix(token);
        if (!prefix) continue;

        const variants = prefixGroups.get(prefix) ?? new Map<string, Set<string>>();
        const pagesForToken = variants.get(token) ?? new Set<string>();
        pagesForToken.add(page.url);
        variants.set(token, pagesForToken);
        prefixGroups.set(prefix, variants);
      }
    }
  }

  const findings: DevFinding[] = [];

  for (const [prefix, variants] of prefixGroups) {
    if (variants.size < 2) continue;

    const spreadVariants = [...variants.entries()].filter(([, urls]) => urls.size >= 2);
    if (spreadVariants.length < 2) continue;

    const detail = spreadVariants
      .slice(0, 6)
      .map(([token, urls]) => `.${token} on ${urls.size} pages`)
      .join("\n");

    findings.push(
      finding(
        `drift-prefix-${prefix}`,
        "css-drift",
        "info",
        `Mixed \`${prefix}-*\` naming across the site`,
        `${spreadVariants.length} variants in use (e.g. ${spreadVariants.map(([t]) => `.${t}`).slice(0, 3).join(", ")}). Consider one BEM block or token set.`,
        detail,
      ),
    );
  }

  return findings.slice(0, 4);
}

function regionSignature(doc: Document, _kind: string, selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) return elementSignature(el);
  }
  return null;
}

function primaryButtonSignature(doc: Document): string | null {
  const counts = new Map<string, number>();

  for (const el of doc.querySelectorAll(INTERACTIVE_SELECTOR)) {
    const cls = normalizeClasses(el.getAttribute("class") ?? "");
    if (!cls) continue;
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }

  if (counts.size === 0) return null;

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function cardSignature(doc: Document): string | null {
  const counts = new Map<string, number>();

  for (const el of doc.querySelectorAll(CARD_SELECTOR)) {
    const sig = elementSignature(el);
    counts.set(sig, (counts.get(sig) ?? 0) + 1);
  }

  if (counts.size === 0) return null;

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function elementSignature(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes = tokenize(el.getAttribute("class") ?? "")
    .slice(0, 5)
    .join(".");
  const childShape = [...el.children]
    .slice(0, 3)
    .map((c) => c.tagName.toLowerCase())
    .join("+");
  return `<${tag}${id}${classes ? `.${classes}` : ""}>${childShape ? `[${childShape}]` : ""}`;
}

function componentPrefix(token: string): string | null {
  const lower = token.toLowerCase();
  for (const prefix of ["btn", "button", "card", "tile", "panel", "nav", "header", "footer", "hero", "cta"]) {
    if (lower === prefix || lower.startsWith(`${prefix}-`) || lower.startsWith(`${prefix}_`)) {
      return prefix;
    }
  }
  return null;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function formatPageList(urls: string[]): string {
  return urls
    .slice(0, 4)
    .map((u) => truncateUrl(u))
    .join(", ") + (urls.length > 4 ? ` (+${urls.length - 4} more)` : "");
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.length > 1 ? u.pathname : u.hostname;
  } catch {
    return url;
  }
}

function normalizeClasses(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function tokenize(raw: string): string[] {
  return normalizeClasses(raw).split(" ").filter(Boolean);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}

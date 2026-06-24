import { resolveUrl } from "../scanner/utils.js";

const SKIP_EXTENSIONS = new Set([
  ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".ico",
  ".mp4", ".mp3", ".wav", ".avi", ".mov", ".webm",
  ".css", ".js", ".json", ".xml", ".rss", ".atom",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
]);

export function canonicalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  if (parsed.pathname.endsWith("/") && parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }
  return parsed.href;
}

export function isSameOrigin(a: string, b: string): boolean {
  const ua = new URL(a);
  const ub = new URL(b);
  return ua.origin === ub.origin;
}

export function isCrawlableLink(absoluteUrl: string, startOrigin: string, sameOrigin: boolean): boolean {
  let parsed: URL;
  try {
    parsed = new URL(absoluteUrl);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (sameOrigin && parsed.origin !== startOrigin) return false;

  const path = parsed.pathname.toLowerCase();
  for (const ext of SKIP_EXTENSIONS) {
    if (path.endsWith(ext)) return false;
  }

  return true;
}

export function isCheckableLink(href: string, absoluteUrl: string): boolean {
  if (!href || href.startsWith("#")) return false;
  if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return false;

  try {
    const parsed = new URL(absoluteUrl);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function detectLinkZone(element: Element): import("./types.js").LinkZone {
  let current: Element | null = element;
  while (current) {
    const tag = current.tagName.toLowerCase();
    if (tag === "nav") return "navigation";
    if (tag === "footer") return "footer";
    if (tag === "main" || tag === "article" || tag === "section") {
      return "content";
    }
    const role = current.getAttribute("role");
    if (role === "navigation") return "navigation";
    if (role === "contentinfo") return "footer";
    if (role === "main") return "content";
    current = current.parentElement;
  }
  return "other";
}

export function extractLinks(html: string, pageUrl: string): import("./types.js").ParsedLink[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const seen = new Set<string>();
  const links: import("./types.js").ParsedLink[] = [];

  doc.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href")?.trim() ?? "";
    if (!href) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = resolveUrl(pageUrl, href);
    } catch {
      return;
    }

    const key = `${pageUrl}|${absoluteUrl}|${anchor.textContent?.trim() ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);

    links.push({
      href,
      absoluteUrl,
      anchorText: (anchor.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
      zone: detectLinkZone(anchor),
    });
  });

  return links;
}

export function extractPageTitle(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.querySelector("title")?.textContent ?? "").trim();
}

export function extractInternalLinks(
  links: import("./types.js").ParsedLink[],
  startOrigin: string,
  sameOrigin: boolean,
): string[] {
  const internal: string[] = [];
  for (const link of links) {
    if (!isCrawlableLink(link.absoluteUrl, startOrigin, sameOrigin)) continue;
    if (sameOrigin && !isSameOrigin(link.absoluteUrl, startOrigin)) continue;
    internal.push(canonicalizeUrl(link.absoluteUrl));
  }
  return internal;
}

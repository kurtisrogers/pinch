import type { AuditDocument } from "./types.js";

export function createAuditDocument(html: string, pageUrl: string): AuditDocument {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return { doc, html, url: pageUrl };
}

export function getMetaContent(doc: Document, name: string): string | null {
  const byName = doc.querySelector(`meta[name="${name}" i]`);
  if (byName) return byName.getAttribute("content")?.trim() ?? null;

  const byProp = doc.querySelector(`meta[property="${name}" i]`);
  return byProp?.getAttribute("content")?.trim() ?? null;
}

export function getVisibleText(doc: Document): string {
  const body = doc.body;
  if (!body) return "";
  return (body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function cssPath(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const siblings = [...parent.children].filter((c) => c.tagName === el.tagName);
  if (siblings.length === 1) return `${cssPath(parent)} > ${tag}`;
  const index = siblings.indexOf(el) + 1;
  return `${cssPath(parent)} > ${tag}:nth-of-type(${index})`;
}

export async function withLiveDocument<T>(
  html: string,
  pageUrl: string,
  fn: (doc: Document) => Promise<T>,
): Promise<T> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;width:1280px;height:800px;left:-9999px;top:0;border:0;visibility:hidden";

  iframe.srcdoc = prepareSrcdoc(html, pageUrl);
  document.body.appendChild(iframe);

  try {
    await waitForIframe(iframe);
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Could not access scanned document");
    return await fn(doc);
  } finally {
    iframe.remove();
  }
}

export function prepareSrcdoc(html: string, pageUrl: string): string {
  const baseHref = new URL(pageUrl).href;
  return html.includes("<head")
    ? html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`)
    : `<!doctype html><html><head><base href="${baseHref}"></head><body>${html}</body></html>`;
}

export function waitForIframe(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Document load timed out")), 12000);
    iframe.onload = () => {
      clearTimeout(timer);
      requestAnimationFrame(() => resolve());
    };
  });
}

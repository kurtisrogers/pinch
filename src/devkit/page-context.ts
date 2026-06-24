import { fetchHtml, getBaseUrl, normalizeUrl } from "../scanner/fetcher.js";
import type { PageContext } from "./types.js";

const PROXY = (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`;

export async function loadPageContext(inputUrl: string): Promise<PageContext> {
  const url = normalizeUrl(inputUrl);
  const html = await fetchHtml(url);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headers = await fetchHeaders(url);
  return { url, html, headers, doc };
}

async function fetchHeaders(url: string): Promise<Record<string, string>> {
  try {
    const response = await fetch(PROXY(url), { method: "GET" });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return headers;
  } catch {
    return {};
  }
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(PROXY(url));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export function resolveOnPage(base: string, path: string): string {
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
}

export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function originOf(url: string): string {
  return getBaseUrl(url);
}

export function finding(
  id: string,
  category: string,
  severity: import("./types.js").DevSeverity,
  title: string,
  description: string,
  detail?: string,
): import("./types.js").DevFinding {
  return { id, category, severity, title, description, detail };
}

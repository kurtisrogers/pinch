/**
 * CORS proxy helpers for GitHub Pages.
 *
 * allorigins /raw blocks browser requests from github.io origins.
 * HTML is fetched via corsproxy.io; image bytes via images.weserv.nl;
 * intrinsic dimensions are read from direct <img> loads (no CORS needed).
 */

const HTML_PROXIES: Array<(url: string) => string> = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
];

const IMAGE_BYTE_PROXIES: Array<(url: string) => string> = [
  (url) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

export async function fetchHtml(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  let lastError: Error | null = null;

  for (const buildProxyUrl of HTML_PROXIES) {
    try {
      const proxyUrl = buildProxyUrl(normalized);
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`Proxy returned ${response.status}`);
      }

      const html = await parseHtmlResponse(response, proxyUrl);
      if (html.length >= 50) {
        return html;
      }
      throw new Error("Received empty or invalid page content");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Failed to fetch page — all proxies blocked or unavailable");
}

async function parseHtmlResponse(
  response: Response,
  proxyUrl: string,
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("json") || proxyUrl.includes("allorigins.win/get")) {
    const json = (await response.json()) as { contents?: string; status?: { http_code?: number } };
    if (json.status?.http_code && json.status.http_code >= 400) {
      throw new Error(`Target page returned ${json.status.http_code}`);
    }
    return json.contents ?? "";
  }

  return response.text();
}

export async function fetchImageBytes(url: string): Promise<number> {
  for (const buildProxyUrl of IMAGE_BYTE_PROXIES) {
    try {
      const proxyUrl = buildProxyUrl(url);
      const response = await fetch(proxyUrl);
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html") || contentType.includes("json")) {
        continue;
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 0) {
        return buffer.byteLength;
      }
    } catch {
      // try next proxy
    }
  }

  return 0;
}

export function loadImageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

export async function loadImageMetadata(
  url: string,
): Promise<{ width: number; height: number; byteSize: number }> {
  const [dimensions, byteSize] = await Promise.all([
    loadImageDimensions(url),
    fetchImageBytes(url),
  ]);

  return {
    width: dimensions.width,
    height: dimensions.height,
    byteSize,
  };
}

export function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) throw new Error("Please enter a URL");
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  new URL(url);
  return url;
}

export function getBaseUrl(pageUrl: string): string {
  const parsed = new URL(pageUrl);
  return `${parsed.protocol}//${parsed.host}`;
}

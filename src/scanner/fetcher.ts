const CORS_PROXY = "https://api.allorigins.win/raw?url=";

export async function fetchViaProxy(url: string): Promise<Response> {
  const proxyUrl = CORS_PROXY + encodeURIComponent(url);
  const response = await fetch(proxyUrl, {
    headers: { Accept: "text/html,application/xhtml+xml,*/*" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status})`);
  }

  return response;
}

export async function fetchHtml(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  const response = await fetchViaProxy(normalized);
  const html = await response.text();

  if (!html || html.length < 50) {
    throw new Error("Received empty or invalid page content");
  }

  return html;
}

export async function fetchByteSize(url: string): Promise<number> {
  try {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const head = await fetch(proxyUrl, { method: "HEAD" });
    const contentLength = head.headers.get("content-length");
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
  } catch {
    // fall through to GET estimate
  }

  try {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    const buffer = await response.arrayBuffer();
    return buffer.byteLength;
  } catch {
    return 0;
  }
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
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

export async function loadImageViaProxy(
  url: string,
): Promise<{ width: number; height: number; byteSize: number }> {
  const proxyUrl = CORS_PROXY + encodeURIComponent(url);

  try {
    const response = await fetch(proxyUrl);
    const buffer = await response.arrayBuffer();
    const byteSize = buffer.byteLength;
    const blob = new Blob([buffer]);
    const objectUrl = URL.createObjectURL(blob);

    try {
      const dims = await loadImageDimensions(objectUrl);
      return { ...dims, byteSize };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    const byteSize = await fetchByteSize(url);
    const dims = await loadImageDimensions(proxyUrl).catch(() => ({
      width: 0,
      height: 0,
    }));
    return { width: dims.width, height: dims.height, byteSize };
  }
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

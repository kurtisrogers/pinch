import type { CheckedLink, LinkStatus, ParsedLink } from "./types.js";
import { isCheckableLink } from "./parser.js";

const LINK_PROXIES: Array<(url: string) => string> = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
];

const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 15000;

export async function checkLinks(
  pageLinks: Array<{ sourcePage: string; link: ParsedLink }>,
  onProgress: (current: number, total: number, url: string) => void,
): Promise<CheckedLink[]> {
  const unique = dedupeLinks(pageLinks);
  const results: CheckedLink[] = [];
  let completed = 0;

  const queue = [...unique];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      onProgress(completed + 1, unique.length, item.link.absoluteUrl);

      const checked = await checkSingleLink(item.sourcePage, item.link);
      results.push(checked);
      completed++;
      await delay(150);
    }
  });

  await Promise.all(workers);
  return results.sort((a, b) => {
    if (a.status === "dead" && b.status !== "dead") return -1;
    if (b.status === "dead" && a.status !== "dead") return 1;
    return a.sourcePage.localeCompare(b.sourcePage);
  });
}

async function checkSingleLink(
  sourcePage: string,
  link: ParsedLink,
): Promise<CheckedLink> {
  const base: CheckedLink = {
    sourcePage,
    href: link.href,
    absoluteUrl: link.absoluteUrl,
    anchorText: link.anchorText,
    zone: link.zone,
    status: "skipped",
  };

  if (!isCheckableLink(link.href, link.absoluteUrl)) {
    return { ...base, message: "Non-HTTP or in-page anchor" };
  }

  try {
    const result = await fetchLinkStatus(link.absoluteUrl);
    return {
      ...base,
      status: result.status,
      httpStatus: result.httpStatus,
      message: result.message,
    };
  } catch (err) {
    return {
      ...base,
      status: "error",
      message: err instanceof Error ? err.message : "Check failed",
    };
  }
}

async function fetchLinkStatus(
  url: string,
): Promise<{ status: LinkStatus; httpStatus?: number; message?: string }> {
  let lastError: Error | null = null;

  for (const buildProxy of LINK_PROXIES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const proxyUrl = buildProxy(url);

      const response = await fetch(proxyUrl, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (proxyUrl.includes("allorigins.win/get")) {
        const json = (await response.json()) as {
          status?: { http_code?: number; url?: string };
          contents?: string;
        };
        const code = json.status?.http_code ?? response.status;
        return classifyStatus(code);
      }

      return classifyStatus(response.status);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("All proxies failed");
}

function classifyStatus(httpStatus: number): {
  status: LinkStatus;
  httpStatus: number;
  message?: string;
} {
  if (httpStatus >= 200 && httpStatus < 300) {
    return { status: "ok", httpStatus };
  }
  if (httpStatus >= 300 && httpStatus < 400) {
    return { status: "redirect", httpStatus, message: `Redirects (${httpStatus})` };
  }
  if (httpStatus >= 400) {
    return {
      status: "dead",
      httpStatus,
      message: httpStatus === 404 ? "Not found" : `HTTP ${httpStatus}`,
    };
  }
  return { status: "error", httpStatus, message: `Unexpected status ${httpStatus}` };
}

function dedupeLinks(
  items: Array<{ sourcePage: string; link: ParsedLink }>,
): Array<{ sourcePage: string; link: ParsedLink }> {
  const seen = new Set<string>();
  const unique: Array<{ sourcePage: string; link: ParsedLink }> = [];

  for (const item of items) {
    const key = `${item.sourcePage}|${item.link.absoluteUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isDeadLink(link: CheckedLink): boolean {
  return link.status === "dead";
}

export function isContentLink(link: CheckedLink): boolean {
  return link.zone === "content";
}

import type { DevFinding, HarSummary } from "../types.js";
import { finding } from "../page-context.js";

interface HarEntry {
  request?: { url?: string; method?: string };
  response?: { status?: number; content?: { size?: number; mimeType?: string } };
  time?: number;
  timings?: { wait?: number; receive?: number };
}

interface HarLog {
  log?: { entries?: HarEntry[] };
}

export function parseHarFile(fileName: string, text: string): HarSummary {
  let parsed: HarLog;
  try {
    parsed = JSON.parse(text) as HarLog;
  } catch {
    return emptySummary(fileName, [
      finding("har-parse", "har", "error", "Invalid HAR JSON", "Export a HAR file from Chrome DevTools Network tab."),
    ]);
  }

  const entries = parsed.log?.entries ?? [];
  if (entries.length === 0) {
    return emptySummary(fileName, [
      finding("har-empty", "har", "warning", "HAR has no entries", "Record network activity before exporting."),
    ]);
  }

  const domains = new Map<string, { count: number; bytes: number }>();
  let totalBytes = 0;
  const slowest: Array<{ url: string; durationMs: number }> = [];

  for (const entry of entries) {
    const url = entry.request?.url ?? "";
    const bytes = entry.response?.content?.size ?? 0;
    totalBytes += Math.max(0, bytes);

    let domain = "unknown";
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = "invalid";
    }

    const d = domains.get(domain) ?? { count: 0, bytes: 0 };
    d.count++;
    d.bytes += Math.max(0, bytes);
    domains.set(domain, d);

    const durationMs = entry.time ?? (entry.timings?.wait ?? 0) + (entry.timings?.receive ?? 0);
    slowest.push({ url, durationMs });
  }

  slowest.sort((a, b) => b.durationMs - a.durationMs);

  const domainList = [...domains.entries()]
    .map(([domain, data]) => ({ domain, ...data }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 12);

  const findings: DevFinding[] = [
    finding("har-entries", "har", "info", `${entries.length} network requests`, `${formatBytes(totalBytes)} transferred.`),
  ];

  const failed = entries.filter((e) => (e.response?.status ?? 0) >= 400);
  if (failed.length > 0) {
    findings.push(
      finding(
        "har-failed",
        "har",
        "warning",
        `${failed.length} failed request(s)`,
        failed
          .slice(0, 8)
          .map((e) => `${e.response?.status} ${e.request?.url ?? ""}`)
          .join("\n"),
      ),
    );
  }

  const thirdParty = domainList.filter((d) => d.domain !== domainList[0]?.domain);
  if (thirdParty.length > 3) {
    findings.push(
      finding(
        "har-third-party",
        "har",
        "info",
        `${thirdParty.length} third-party domains`,
        thirdParty.map((d) => `${d.domain}: ${d.count} req`).join("\n"),
      ),
    );
  }

  const slow = slowest.filter((s) => s.durationMs > 1000).slice(0, 5);
  if (slow.length > 0) {
    findings.push(
      finding(
        "har-slow",
        "har",
        "warning",
        `${slow.length} request(s) over 1s`,
        slow.map((s) => `${Math.round(s.durationMs)}ms ${s.url}`).join("\n"),
      ),
    );
  }

  return {
    fileName,
    entryCount: entries.length,
    totalBytes,
    domains: domainList,
    slowest: slowest.slice(0, 10),
    findings,
  };
}

function emptySummary(fileName: string, findings: DevFinding[]): HarSummary {
  return { fileName, entryCount: 0, totalBytes: 0, domains: [], slowest: [], findings };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

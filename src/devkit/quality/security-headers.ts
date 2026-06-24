import type { DevFinding, PageContext } from "../types.js";
import { finding } from "../page-context.js";

const SECURITY_HEADERS = [
  { key: "content-security-policy", severity: "warning" as const, title: "Missing Content-Security-Policy", desc: "CSP reduces XSS risk." },
  { key: "strict-transport-security", severity: "warning" as const, title: "Missing Strict-Transport-Security", desc: "HSTS enforces HTTPS." },
  { key: "x-frame-options", severity: "info" as const, title: "Missing X-Frame-Options", desc: "Prevents clickjacking (or use CSP frame-ancestors)." },
  { key: "x-content-type-options", severity: "info" as const, title: "Missing X-Content-Type-Options", desc: "Use nosniff to prevent MIME sniffing." },
  { key: "referrer-policy", severity: "info" as const, title: "Missing Referrer-Policy", desc: "Controls referrer information leakage." },
];

export function analyzeSecurityHeaders(ctx: PageContext): DevFinding[] {
  const { headers } = ctx;
  const findings: DevFinding[] = [];

  if (Object.keys(headers).length === 0) {
    findings.push(finding("sec-no-headers", "security", "info", "Headers unavailable via proxy", "Security header check requires response headers — proxy may not expose them."));
    return findings;
  }

  for (const h of SECURITY_HEADERS) {
    if (!headers[h.key]) {
      findings.push(finding(`sec-${h.key}`, "security", h.severity, h.title, h.desc));
    } else {
      findings.push(finding(`sec-${h.key}-ok`, "security", "info", `${h.key} present`, headers[h.key].slice(0, 120)));
    }
  }

  return findings;
}

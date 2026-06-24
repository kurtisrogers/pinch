import type { DevFinding, PageContext } from "../types.js";
import { finding } from "../page-context.js";

const CMP_PATTERNS = [
  "cookiebot", "onetrust", "cookie-consent", "gdpr", "cookieyes",
  "termly", "osano", "quantcast", "didomi", "trustarc", "cookie-law",
];

export function analyzeCookieConsent(ctx: PageContext): DevFinding[] {
  const { doc, html } = ctx;
  const findings: DevFinding[] = [];
  const lower = html.toLowerCase();

  const detected = CMP_PATTERNS.filter((p) => lower.includes(p));
  if (detected.length > 0) {
    findings.push(finding("cookie-cmp", "cookies", "info", `Consent platform detected: ${detected[0]}`, "Verify analytics/ads load only after consent."));
  } else {
    findings.push(finding("cookie-no-cmp", "cookies", "info", "No known CMP detected", "If you serve EU/UK users, ensure consent before non-essential cookies."));
  }

  const preConsentScripts = [...doc.querySelectorAll("script[src]")].filter((s) => {
    const src = (s.getAttribute("src") ?? "").toLowerCase();
    return src.includes("analytics") || src.includes("gtag") || src.includes("facebook") || src.includes("hotjar");
  });

  if (preConsentScripts.length > 0 && detected.length === 0) {
    findings.push(finding("cookie-tracking", "cookies", "warning", "Tracking scripts in HTML", `${preConsentScripts.length} analytics/ad script(s) may run before consent.`, preConsentScripts.map((s) => s.getAttribute("src")).join("\n")));
  }

  return findings;
}

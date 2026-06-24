import type { DevFinding, PageContext } from "../types.js";
import { finding } from "../page-context.js";

const KNOWN_THIRD_PARTY: Record<string, string> = {
  "google-analytics.com": "Google Analytics",
  "googletagmanager.com": "Google Tag Manager",
  "facebook.net": "Facebook SDK",
  "hotjar.com": "Hotjar",
  "intercom.io": "Intercom",
  "clarity.ms": "Microsoft Clarity",
  "segment.com": "Segment",
  "stripe.com": "Stripe",
  "recaptcha.net": "reCAPTCHA",
  "cloudflare.com": "Cloudflare",
  "jsdelivr.net": "jsDelivr CDN",
  "unpkg.com": "unpkg",
};

export function analyzeScripts(ctx: PageContext): DevFinding[] {
  const { doc, url } = ctx;
  const findings: DevFinding[] = [];
  const pageOrigin = new URL(url).hostname;

  const scripts = [...doc.querySelectorAll("script[src]")];
  const byDomain = new Map<string, { count: number; urls: string[] }>();

  for (const script of scripts) {
    const src = script.getAttribute("src") ?? "";
    let domain = "inline/unknown";
    try {
      domain = new URL(src, url).hostname || pageOrigin;
    } catch {
      domain = "invalid";
    }
    const entry = byDomain.get(domain) ?? { count: 0, urls: [] };
    entry.count++;
    entry.urls.push(src);
    byDomain.set(domain, entry);
  }

  findings.push(finding("scripts-count", "scripts", "info", `${scripts.length} external scripts`, `From ${byDomain.size} domain(s).`));

  for (const [domain, data] of byDomain) {
    if (domain === pageOrigin || domain === "inline/unknown") continue;
    const label = KNOWN_THIRD_PARTY[domain.replace(/^www\./, "")] ?? domain;
    findings.push(finding(`scripts-${domain}`, "scripts", "info", `Third-party: ${label}`, `${data.count} script(s). Review necessity and load timing.`, data.urls.slice(0, 3).join("\n")));
  }

  const asyncCount = scripts.filter((s) => {
    const script = s as HTMLScriptElement;
    return script.async || script.defer;
  }).length;
  if (scripts.length > 5 && asyncCount < scripts.length / 2) {
    findings.push(finding("scripts-blocking", "scripts", "warning", "Many synchronous third-party scripts", "Use async/defer or load after consent/interaction."));
  }

  return findings;
}

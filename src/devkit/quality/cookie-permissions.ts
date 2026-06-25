import type { DevFinding, PageContext } from "../types.js";
import { finding } from "../page-context.js";
import { probeHttpCookies } from "./cookie-probe-client.js";

const CMP_MARKERS = [
  "cookiebot",
  "onetrust",
  "cookie-consent",
  "cookieconsent",
  "gdpr",
  "cookieyes",
  "termly",
  "osano",
  "quantcast",
  "didomi",
  "trustarc",
  "cookie-law",
  "iubenda",
  "consentmanager",
  "usercentrics",
  "tcf",
  "ccpa",
];

const TRACKING_SCRIPT_PATTERNS = [
  "google-analytics.com",
  "googletagmanager.com",
  "gtag/js",
  "facebook.net",
  "connect.facebook",
  "hotjar.com",
  "clarity.ms",
  "doubleclick.net",
  "analytics.tiktok",
  "snap.licdn.com",
  "segment.com",
  "mixpanel.com",
  "plausible.io",
  "matomo",
  "piwik",
];

const NON_ESSENTIAL_COOKIE_NAMES = [
  /^_ga/i,
  /^_gid/i,
  /^_gat/i,
  /^_fbp/i,
  /^_fbc/i,
  /^_gcl_/i,
  /^__utm/i,
  /^_hj/i,
  /^IDE$/i,
  /^DSID$/i,
  /^NID$/i,
  /^test_cookie$/i,
  /^__cf_bm$/i,
];

const ESSENTIAL_COOKIE_NAMES = [
  /^session/i,
  /^sess/i,
  /^csrf/i,
  /^xsrf/i,
  /^PHPSESSID$/i,
  /^connect\.sid$/i,
  /^OptanonConsent$/i,
  /^CookieConsent$/i,
  /^euconsent/i,
  /^cookieconsent_status$/i,
  /^__cmpconsent/i,
  /^cc_cookie$/i,
  /^__Secure-/i,
  /^__Host-/i,
];

const CONSENT_UI_SELECTORS = [
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
  '[aria-label*="cookie" i]',
  '[data-testid*="cookie" i]',
  "#onetrust-banner-sdk",
  "#CybotCookiebotDialog",
  ".cc-window",
  ".cookie-notice",
  ".gdpr-banner",
];

const ACCEPT_PATTERNS =
  /\b(accept all|allow all|agree|accept cookies|i accept|got it|ok|allow cookies|yes, i agree|enable all)\b/i;
const REJECT_PATTERNS =
  /\b(reject all|decline all|deny|only necessary|essential only|reject cookies|necessary only|use necessary)\b/i;

export async function analyzeCookiePermissions(ctx: PageContext): Promise<DevFinding[]> {
  const findings: DevFinding[] = [];

  findings.push(...analyzeStaticPreConsent(ctx));
  findings.push(...await probeHttpCookies(ctx.url));

  if (findings.some((f) => f.severity === "error")) {
    return findings;
  }

  if (findings.length === 0) {
    findings.push(
      finding(
        "cookie-ok-heuristic",
        "cookies",
        "info",
        "No obvious pre-consent cookie violations",
        "Static and HTTP checks passed — confirm in DevTools that no tracking cookies appear before accepting.",
      ),
    );
  }

  return findings;
}

function analyzeStaticPreConsent(ctx: PageContext): DevFinding[] {
  const { doc, html } = ctx;
  const findings: DevFinding[] = [];
  const lower = html.toLowerCase();

  const cmpDetected = CMP_MARKERS.some((m) => lower.includes(m));
  const consentUi = detectConsentUi(doc);
  const hasConsentControl = cmpDetected || consentUi.found;

  if (hasConsentControl) {
    findings.push(
      finding(
        "cookie-cmp-ui",
        "cookies",
        "info",
        "Cookie consent UI detected",
        consentUi.found
          ? `Banner/control found${consentUi.acceptLabels.length ? ` with accept action (“${consentUi.acceptLabels[0]}”)` : ""}.`
          : `CMP script/markers found (${CMP_MARKERS.find((m) => lower.includes(m))}).`,
      ),
    );
  } else {
    findings.push(
      finding(
        "cookie-no-cmp",
        "cookies",
        "warning",
        "No cookie consent control detected",
        "If you serve EU/UK/EEA users, a consent banner with accept/reject is required before non-essential cookies.",
      ),
    );
  }

  const trackingBeforeCmp = findTrackingBeforeCmp(html, cmpDetected);
  if (trackingBeforeCmp.length > 0) {
    findings.push(
      finding(
        "cookie-scripts-before-cmp",
        "cookies",
        "error",
        "Tracking may load before consent control",
        "Analytics/ad scripts appear in HTML before the consent platform — likely sets cookies before user choice (GDPR/ePrivacy risk).",
        trackingBeforeCmp.join("\n"),
      ),
    );
  }

  const inlineWrites = findInlineCookieWrites(html);
  if (inlineWrites.length > 0) {
    const nonEssential = inlineWrites.filter((w) => isNonEssentialCookieName(w.name));
    if (nonEssential.length > 0) {
      findings.push(
        finding(
          "cookie-inline-write",
          "cookies",
          "error",
          "Non-essential cookies set in inline script before interaction",
          "Inline JavaScript writes tracking cookies/storage on page load — before any consent click.",
          nonEssential.map((w) => `${w.name}: ${truncate(w.snippet, 80)}`).join("\n"),
        ),
      );
    }
  }

  const syncTrackingScripts = [...doc.querySelectorAll("script[src]")].filter((s) => {
    const script = s as HTMLScriptElement;
    const src = (script.getAttribute("src") ?? "").toLowerCase();
    const isTracking = TRACKING_SCRIPT_PATTERNS.some((p) => src.includes(p));
    const isBlocking = !script.async && !script.defer && script.getAttribute("type") !== "module";
    return isTracking && isBlocking;
  });

  if (syncTrackingScripts.length > 0) {
    findings.push(
      finding(
        "cookie-sync-tracking",
        "cookies",
        "error",
        `${syncTrackingScripts.length} blocking tracking script(s) in HTML`,
        "Synchronous analytics/ad scripts run immediately on parse — typically before consent interaction.",
        syncTrackingScripts.map((s) => s.getAttribute("src") ?? "").join("\n"),
      ),
    );
  }

  const preConsentPixels = [...doc.querySelectorAll('img[src*="facebook.com/tr"], img[src*="google-analytics"], iframe[src*="doubleclick"]')];
  if (preConsentPixels.length > 0 && !hasConsentControl) {
    findings.push(
      finding(
        "cookie-tracking-pixels",
        "cookies",
        "warning",
        "Tracking pixels in HTML without visible consent UI",
        "Hidden pixels/iframes may set third-party cookies before consent.",
      ),
    );
  }

  if (consentUi.found && consentUi.rejectLabels.length === 0 && consentUi.acceptLabels.length > 0) {
    findings.push(
      finding(
        "cookie-no-reject",
        "cookies",
        "warning",
        "Accept action found but no clear reject/necessary-only option",
        "GDPR expects a freely given choice — ensure “Reject all” or “Necessary only” is as prominent as accept.",
      ),
    );
  }

  return findings;
}

function detectConsentUi(doc: Document): {
  found: boolean;
  acceptLabels: string[];
  rejectLabels: string[];
} {
  const acceptLabels: string[] = [];
  const rejectLabels: string[] = [];
  let found = false;

  for (const sel of CONSENT_UI_SELECTORS) {
    if (doc.querySelector(sel)) {
      found = true;
      break;
    }
  }

  for (const el of doc.querySelectorAll("button, a, [role='button'], input[type='button']")) {
    const text = (el.textContent ?? "").trim();
    if (!text || text.length > 60) continue;

    if (ACCEPT_PATTERNS.test(text)) acceptLabels.push(text);
    if (REJECT_PATTERNS.test(text)) rejectLabels.push(text);
  }

  if (acceptLabels.length > 0 || rejectLabels.length > 0) found = true;

  return { found, acceptLabels: [...new Set(acceptLabels)], rejectLabels: [...new Set(rejectLabels)] };
}

function findTrackingBeforeCmp(html: string, cmpDetected: boolean): string[] {
  if (!cmpDetected) return [];

  const lower = html.toLowerCase();
  const cmpIndex = Math.min(
    ...CMP_MARKERS.map((m) => lower.indexOf(m)).filter((i) => i >= 0),
  );

  if (!Number.isFinite(cmpIndex)) return [];

  const headChunk = lower.slice(0, cmpIndex);
  const hits: string[] = [];

  for (const pattern of TRACKING_SCRIPT_PATTERNS) {
    if (headChunk.includes(pattern)) {
      hits.push(pattern);
    }
  }

  return hits;
}

function findInlineCookieWrites(html: string): Array<{ name: string; snippet: string }> {
  const writes: Array<{ name: string; snippet: string }> = [];

  const cookieRegex = /document\.cookie\s*=\s*["'`]([^"'`;=]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = cookieRegex.exec(html)) !== null) {
    writes.push({ name: match[1].split("=")[0]?.trim() ?? "unknown", snippet: match[0] });
  }

  const storageRegex = /(?:localStorage|sessionStorage)\.setItem\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  while ((match = storageRegex.exec(html)) !== null) {
    const key = match[1];
    if (/ga|fb|utm|track|analytics|hj/i.test(key)) {
      writes.push({ name: key, snippet: match[0] });
    }
  }

  return writes;
}

export function isNonEssentialCookieName(name: string): boolean {
  if (ESSENTIAL_COOKIE_NAMES.some((re) => re.test(name))) return false;
  return NON_ESSENTIAL_COOKIE_NAMES.some((re) => re.test(name));
}

export function isEssentialCookieName(name: string): boolean {
  return ESSENTIAL_COOKIE_NAMES.some((re) => re.test(name));
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}

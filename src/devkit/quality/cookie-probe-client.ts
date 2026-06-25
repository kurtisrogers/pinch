import { functionsBaseUrl, isBillingEnabled } from "../../billing/config.js";
import type { DevFinding } from "../types.js";
import { finding } from "../page-context.js";

export function isSupabaseConfigured(): boolean {
  return isBillingEnabled();
}

interface CookieProbeResult {
  cookies: Array<{ name: string; essential: boolean }>;
  nonEssentialOnFirstLoad: string[];
  error?: string;
}

export async function probeHttpCookies(url: string): Promise<DevFinding[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const response = await fetch(`${functionsBaseUrl()}/cookie-probe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ url }),
    });

    const payload = (await response.json()) as CookieProbeResult & { error?: string };

    if (!response.ok) {
      return [
        finding(
          "cookie-probe-failed",
          "cookies",
          "info",
          "HTTP cookie probe unavailable",
          payload.error ?? `Probe returned ${response.status}`,
        ),
      ];
    }

    const findings: DevFinding[] = [];

    if (payload.nonEssentialOnFirstLoad.length > 0) {
      findings.push(
        finding(
          "cookie-http-pre-consent",
          "cookies",
          "error",
          "Non-essential cookies set on first HTTP response",
          "The server sends Set-Cookie for tracking/ad cookies before any consent interaction — likely breach of GDPR/ePrivacy consent rules.",
          payload.nonEssentialOnFirstLoad.join("\n"),
        ),
      );
    }

    if (payload.cookies.length > 0 && payload.nonEssentialOnFirstLoad.length === 0) {
      const names = payload.cookies.map((c) => c.name).join(", ");
      findings.push(
        finding(
          "cookie-http-first-party",
          "cookies",
          "info",
          `First load Set-Cookie: ${payload.cookies.length} cookie(s)`,
          `Only essential/consent-storage cookies detected on initial response: ${names}`,
        ),
      );
    }

    if (payload.cookies.length === 0) {
      findings.push(
        finding(
          "cookie-http-none",
          "cookies",
          "info",
          "No Set-Cookie on initial HTTP response",
          "Server did not set cookies on first fetch — good baseline (JS may still set cookies after load).",
        ),
      );
    }

    return findings;
  } catch (err) {
    return [
      finding(
        "cookie-probe-error",
        "cookies",
        "info",
        "HTTP cookie probe failed",
        err instanceof Error ? err.message : "Network error",
      ),
    ];
  }
}

import { jsonResponse, optionsResponse } from "../_shared/cors.ts";

const NON_ESSENTIAL = [
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
];

const ESSENTIAL = [
  /^session/i,
  /^csrf/i,
  /^PHPSESSID$/i,
  /^OptanonConsent$/i,
  /^CookieConsent$/i,
  /^euconsent/i,
  /^cookieconsent_status$/i,
  /^__Secure-/i,
  /^__Host-/i,
];

function classifyCookie(name: string): boolean {
  if (ESSENTIAL.some((re) => re.test(name))) return true;
  if (NON_ESSENTIAL.some((re) => re.test(name))) return false;
  return true;
}

function parseCookieNames(setCookieHeaders: string[]): string[] {
  const names: string[] = [];
  for (const header of setCookieHeaders) {
    const name = header.split("=")[0]?.trim();
    if (name) names.push(name);
  }
  return names;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = await req.json() as { url?: string };
    const url = body.url?.trim();

    if (!url || !/^https?:\/\//i.test(url)) {
      return jsonResponse({ error: "invalid_url" }, 400);
    }

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "PinchCookieProbe/1.0 (compliance audit; +https://kurtisrogers.github.io/pinch/)",
        Accept: "text/html",
      },
    });

    const setCookieHeaders =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie")].filter((h): h is string => Boolean(h));

    const names = parseCookieNames(setCookieHeaders);
    const cookies = names.map((name) => ({
      name,
      essential: classifyCookie(name),
    }));

    const nonEssentialOnFirstLoad = cookies.filter((c) => !c.essential).map((c) => c.name);

    return jsonResponse({ cookies, nonEssentialOnFirstLoad });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "probe_failed" }, 500);
  }
});

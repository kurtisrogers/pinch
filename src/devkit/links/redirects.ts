import type { CheckedLink } from "../../spider/types.js";
import type { DevFinding } from "../types.js";
import { finding } from "../page-context.js";

export function analyzeRedirectChains(links: CheckedLink[]): DevFinding[] {
  const findings: DevFinding[] = [];
  const redirects = links.filter((l) => l.status === "redirect");

  if (redirects.length === 0) {
    findings.push(
      finding("redirect-none", "redirects", "info", "No redirect links in crawl", "Checked links returned direct 2xx responses."),
    );
    return findings;
  }

  findings.push(
    finding(
      "redirect-count",
      "redirects",
      "info",
      `${redirects.length} redirecting link(s)`,
      "Review redirect chains for unnecessary hops.",
    ),
  );

  for (const link of redirects.slice(0, 15)) {
    findings.push(
      finding(
        `redirect-${hashUrl(link.absoluteUrl)}`,
        "redirects",
        "warning",
        `Redirect: ${link.httpStatus ?? 3}xx`,
        `${link.absoluteUrl} from ${link.sourcePage}`,
        link.message,
      ),
    );
  }

  if (redirects.length > 15) {
    findings.push(
      finding("redirect-more", "redirects", "info", `${redirects.length - 15} more redirects`, "Expand crawl or export report for full list."),
    );
  }

  return findings;
}

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

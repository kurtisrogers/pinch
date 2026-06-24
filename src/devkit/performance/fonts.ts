import type { DevFinding, PageContext } from "../types.js";
import { finding } from "../page-context.js";

export function analyzeFonts(ctx: PageContext): DevFinding[] {
  const { doc } = ctx;
  const findings: DevFinding[] = [];

  const fontLinks = [...doc.querySelectorAll('link[rel="stylesheet"][href*="font"], link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]')];
  const fontFaces = [...doc.querySelectorAll("style")].some((s) => s.textContent?.includes("@font-face"));

  if (fontLinks.length === 0 && !fontFaces) {
    findings.push(finding("fonts-none", "fonts", "info", "No webfonts detected", "Page uses system fonts or fonts loaded via CSS not visible in HTML."));
    return findings;
  }

  if (fontLinks.length > 3) {
    findings.push(finding("fonts-many", "fonts", "warning", `${fontLinks.length} font stylesheets`, "Multiple font requests slow first paint. Consider consolidating or self-hosting."));
  }

  for (const link of fontLinks) {
    const href = link.getAttribute("href") ?? "";
    if (href.includes("fonts.googleapis.com") && !href.includes("display=")) {
      findings.push(finding("fonts-display", "fonts", "warning", "Google Fonts without display=", "Add &display=swap (or swap in CSS) to avoid invisible text during load.", href));
    }
  }

  const styles = doc.querySelectorAll("style, link[rel=stylesheet]");
  let faceCount = 0;
  styles.forEach((el) => {
    const text = el.textContent ?? el.getAttribute("href") ?? "";
    faceCount += (text.match(/@font-face/g) ?? []).length;
  });
  if (faceCount > 6) {
    findings.push(finding("fonts-faces", "fonts", "warning", `${faceCount}+ @font-face rules`, "Many font variants increase download size."));
  }

  return findings;
}

import type { OgPreview, PageContext } from "../types.js";
import { getMetaContent } from "../../audit/document.js";

export function buildOgPreview(ctx: PageContext): OgPreview {
  const { doc, url } = ctx;
  return {
    title: getMetaContent(doc, "og:title") ?? doc.querySelector("title")?.textContent?.trim() ?? "",
    description: getMetaContent(doc, "og:description") ?? getMetaContent(doc, "description") ?? "",
    image: getMetaContent(doc, "og:image") ?? undefined,
    url: getMetaContent(doc, "og:url") ?? url,
    siteName: getMetaContent(doc, "og:site_name") ?? undefined,
  };
}

export function ogPreviewFindings(preview: OgPreview): import("../types.js").DevFinding[] {
  const findings: import("../types.js").DevFinding[] = [];
  if (!preview.title) findings.push({ id: "og-title", category: "preview", severity: "warning", title: "Missing share title", description: "Add og:title or <title>." });
  if (!preview.description) findings.push({ id: "og-desc", category: "preview", severity: "warning", title: "Missing share description", description: "Add og:description or meta description." });
  if (!preview.image) findings.push({ id: "og-image", category: "preview", severity: "warning", title: "Missing og:image", description: "Social shares look bare without an image." });
  return findings;
}

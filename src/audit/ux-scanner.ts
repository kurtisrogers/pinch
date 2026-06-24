import type { AuditDocument, AuditIssue } from "./types.js";
import { getMetaContent, getVisibleText } from "./document.js";

const GENERIC_LINK_TEXT = /^(click here|here|read more|learn more|more|link|this|go|continue|submit)$/i;

export function scanUx({ doc, url: _url }: AuditDocument): AuditIssue[] {
  const issues: AuditIssue[] = [];

  checkTitle(doc, issues);
  checkMetaDescription(doc, issues);
  checkViewport(doc, issues);
  checkFavicon(doc, issues);
  checkOpenGraph(doc, issues);
  checkContentDepth(doc, issues);
  checkGenericLinks(doc, issues);
  checkForms(doc, issues);
  checkMediaAutoplay(doc, issues);
  checkRobots(doc, issues);
  checkScriptWeight(doc, issues);
  checkSkipLink(doc, issues);
  checkLanguageDirection(doc, issues);

  return issues;
}

function checkTitle(doc: Document, issues: AuditIssue[]): void {
  const title = doc.querySelector("title")?.textContent?.trim() ?? "";
  if (!title) return;

  if (title.length < 15) {
    issues.push(ux("ux-title-short", "warning", "Title may be too short", `Title is ${title.length} characters — aim for 30–60 for clarity in search results.`));
  } else if (title.length > 70) {
    issues.push(ux("ux-title-long", "warning", "Title may be too long", `Title is ${title.length} characters — search engines truncate around 60.`));
  } else {
    issues.push(ux("ux-title-ok", "info", "Title length looks good", `${title.length} characters.`));
  }
}

function checkMetaDescription(doc: Document, issues: AuditIssue[]): void {
  const desc = getMetaContent(doc, "description");
  if (!desc) {
    issues.push(ux("ux-no-description", "warning", "Missing meta description", "Add a meta description to improve search snippets and set user expectations."));
    return;
  }
  if (desc.length < 70) {
    issues.push(ux("ux-desc-short", "warning", "Meta description is short", `${desc.length} chars — aim for 120–160.`));
  } else if (desc.length > 170) {
    issues.push(ux("ux-desc-long", "warning", "Meta description is long", `${desc.length} chars — it may be truncated in search results.`));
  }
}

function checkViewport(doc: Document, issues: AuditIssue[]): void {
  const viewport = getMetaContent(doc, "viewport")?.toLowerCase() ?? "";
  if (!viewport) {
    issues.push(ux("ux-no-viewport", "error", "Missing viewport meta tag", "Add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` for mobile layouts."));
    return;
  }
  if (!viewport.includes("width=device-width")) {
    issues.push(ux("ux-viewport-fixed", "warning", "Viewport not set to device-width", "Use width=device-width for responsive mobile UX."));
  }
  if (viewport.includes("user-scalable=no") || viewport.includes("maximum-scale=1")) {
    issues.push(ux("ux-viewport-zoom", "warning", "Zoom disabled in viewport", "Avoid preventing pinch-zoom — it hurts low-vision users."));
  }
}

function checkFavicon(doc: Document, issues: AuditIssue[]): void {
  const icon = doc.querySelector('link[rel*="icon"]');
  if (!icon) {
    issues.push(ux("ux-no-favicon", "info", "No favicon detected", "Add a favicon for browser tabs and bookmarks."));
  }
}

function checkOpenGraph(doc: Document, issues: AuditIssue[]): void {
  const ogTitle = getMetaContent(doc, "og:title");
  const ogDesc = getMetaContent(doc, "og:description");
  const ogImage = getMetaContent(doc, "og:image");

  if (!ogTitle || !ogDesc) {
    issues.push(ux("ux-og-incomplete", "info", "Incomplete Open Graph tags", "Add og:title and og:description for richer social sharing previews."));
  }
  if (!ogImage) {
    issues.push(ux("ux-og-image", "info", "No og:image", "Social shares look better with an og:image."));
  }
}

function checkContentDepth(doc: Document, issues: AuditIssue[]): void {
  const text = getVisibleText(doc);
  const words = text.split(/\s+/).filter(Boolean).length;

  if (words < 50) {
    issues.push(ux("ux-thin-content", "warning", "Very little visible text", `Only ~${words} words detected — thin pages can hurt SEO and user trust.`));
  } else if (words > 3000) {
    issues.push(ux("ux-long-content", "info", "Long page content", `${words} words — consider breaking into sections with a table of contents.`));
  }
}

function checkGenericLinks(doc: Document, issues: AuditIssue[]): void {
  doc.querySelectorAll("a[href]").forEach((anchor) => {
    const text = (anchor.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text && GENERIC_LINK_TEXT.test(text)) {
      issues.push(ux("ux-generic-link", "warning", `Generic link text: \"${text}\"`, "Use descriptive link text so users know where they'll go.", cssPath(anchor)));
    }
  });
}

function checkForms(doc: Document, issues: AuditIssue[]): void {
  doc.querySelectorAll("input, select, textarea").forEach((field) => {
    const type = (field as HTMLInputElement).type?.toLowerCase();
    if (type === "hidden" || type === "submit" || type === "button") return;

    const id = field.getAttribute("id");
    const labelledBy = field.getAttribute("aria-labelledby");
    const label = id ? doc.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    const ariaLabel = field.getAttribute("aria-label");
    const placeholder = field.getAttribute("placeholder");

    if (!label && !ariaLabel && !labelledBy) {
      issues.push(ux("ux-unlabeled-field", "warning", "Form field without label", placeholder ? "Placeholder alone isn't a label — add a <label> or aria-label." : "Add a visible label for every form field.", cssPath(field)));
    }
  });
}

function checkMediaAutoplay(doc: Document, issues: AuditIssue[]): void {
  doc.querySelectorAll("video[autoplay], audio[autoplay]").forEach((el) => {
    issues.push(ux("ux-autoplay", "warning", "Autoplaying media", "Autoplay can surprise users and consume data — default to user-initiated playback.", cssPath(el)));
  });
}

function checkRobots(doc: Document, issues: AuditIssue[]): void {
  const robots = getMetaContent(doc, "robots")?.toLowerCase() ?? "";
  if (robots.includes("noindex")) {
    issues.push(ux("ux-noindex", "info", "Page set to noindex", "This page won't appear in search results."));
  }
}

function checkScriptWeight(doc: Document, issues: AuditIssue[]): void {
  const scripts = doc.querySelectorAll("script[src]").length;
  if (scripts > 20) {
    issues.push(ux("ux-many-scripts", "warning", `${scripts} external scripts`, "Heavy script counts slow first load — audit what's essential."));
  }
}

function checkSkipLink(doc: Document, issues: AuditIssue[]): void {
  const skip = doc.querySelector('a[href^="#"], [class*="skip" i], [id*="skip" i]');
  const hasMain = doc.querySelector("main, [role='main']");
  if (hasMain && !skip) {
    issues.push(ux("ux-no-skip", "info", "No skip navigation link", "A skip-to-content link helps keyboard users bypass repetitive nav."));
  }
}

function checkLanguageDirection(doc: Document, issues: AuditIssue[]): void {
  const lang = doc.documentElement.getAttribute("lang");
  const dir = doc.documentElement.getAttribute("dir");
  if (lang && !dir && /^(ar|he|fa|ur|yi)/i.test(lang)) {
    issues.push(ux("ux-rtl-dir", "info", "RTL language without dir attribute", "Consider dir=\"rtl\" on <html> for right-to-left languages."));
  }
}

function cssPath(el: Element): string {
  if (el.id) return `#${el.id}`;
  return el.tagName.toLowerCase();
}

function ux(
  id: string,
  severity: AuditIssue["severity"],
  title: string,
  description: string,
  selector?: string,
): AuditIssue {
  return { id, category: "ux", severity, title, description, selector };
}

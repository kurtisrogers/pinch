import type { AuditDocument, AuditIssue } from "./types.js";
import { cssPath, getMetaContent } from "./document.js";

const DEPRECATED_TAGS = ["center", "font", "marquee", "blink", "big", "strike", "tt", "basefont"];
const OBSOLETE_ATTRS = ["align", "bgcolor", "border", "cellpadding", "cellspacing", "width", "height"];

export function validateHtml({ doc, html, url: _url }: AuditDocument): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (!/<!doctype html/i.test(html)) {
    issues.push(issue("html-doctype", "error", "Missing HTML5 doctype", "Add `<!doctype html>` as the first line of the document."));
  }

  const htmlEl = doc.documentElement;
  if (!htmlEl.getAttribute("lang")?.trim()) {
    issues.push(issue("html-lang", "error", "Missing lang on <html>", "Set a language code, e.g. `<html lang=\"en\">`, for assistive tech and search engines."));
  }

  if (!doc.querySelector("title")?.textContent?.trim()) {
    issues.push(issue("html-title", "error", "Missing <title>", "Every page needs a descriptive `<title>` element in `<head>`."));
  }

  const charset = doc.querySelector("meta[charset]") ?? doc.querySelector('meta[http-equiv="Content-Type" i]');
  if (!charset) {
    issues.push(issue("html-charset", "warning", "Missing charset declaration", "Add `<meta charset=\"utf-8\">` in `<head>`."));
  }

  checkDuplicateIds(doc, issues);
  checkDeprecatedElements(doc, issues);
  checkObsoleteAttributes(doc, issues);
  checkHeadingStructure(doc, issues);
  checkInteractiveNesting(doc, issues);
  checkTables(doc, issues);
  checkLinksAndMedia(doc, issues);
  checkLandmarks(doc, issues);
  checkParserErrors(doc, issues);

  const canonical = doc.querySelector('link[rel="canonical"]');
  if (!canonical?.getAttribute("href")?.trim()) {
    issues.push(issue("html-canonical", "info", "No canonical URL", "Consider adding `<link rel=\"canonical\">` to reduce duplicate-content issues."));
  }

  if (doc.querySelectorAll("style").length === 0 && doc.querySelectorAll('link[rel="stylesheet"]').length === 0) {
    issues.push(issue("html-no-styles", "info", "No stylesheets detected", "Page has no linked or embedded CSS in the fetched HTML."));
  }

  return issues;
}

function checkDuplicateIds(doc: Document, issues: AuditIssue[]): void {
  const seen = new Map<string, Element>();
  doc.querySelectorAll("[id]").forEach((el) => {
    const id = el.getAttribute("id")?.trim();
    if (!id) {
      issues.push(issue("html-empty-id", "warning", "Empty id attribute", "Remove empty id attributes or assign unique values.", cssPath(el)));
      return;
    }
    if (seen.has(id)) {
      issues.push(issue("html-duplicate-id", "error", `Duplicate id \"${id}\"`, "IDs must be unique in a document.", cssPath(el)));
    } else {
      seen.set(id, el);
    }
  });
}

function checkDeprecatedElements(doc: Document, issues: AuditIssue[]): void {
  for (const tag of DEPRECATED_TAGS) {
    doc.querySelectorAll(tag).forEach((el) => {
      issues.push(issue("html-deprecated", "warning", `Deprecated <${tag}> element`, `Replace <${tag}> with semantic HTML and CSS.`, cssPath(el)));
    });
  }
}

function checkObsoleteAttributes(doc: Document, issues: AuditIssue[]): void {
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of OBSOLETE_ATTRS) {
      if (el.hasAttribute(attr) && ["table", "td", "th", "tr", "img", "hr", "div", "p"].includes(el.tagName.toLowerCase())) {
        issues.push(issue("html-obsolete-attr", "warning", `Obsolete ${attr} attribute on <${el.tagName.toLowerCase()}>`, "Use CSS instead of presentational HTML attributes.", cssPath(el)));
      }
    }
  });
}

function checkHeadingStructure(doc: Document, issues: AuditIssue[]): void {
  const headings = [...doc.querySelectorAll("h1, h2, h3, h4, h5, h6")];
  const h1s = headings.filter((h) => h.tagName === "H1");

  if (h1s.length === 0) {
    issues.push(issue("html-no-h1", "warning", "No h1 heading", "Pages should have exactly one primary h1 heading."));
  } else if (h1s.length > 1) {
    issues.push(issue("html-multiple-h1", "warning", `${h1s.length} h1 headings`, "Use a single h1 for the main page topic."));
  }

  let lastLevel = 0;
  for (const heading of headings) {
    const level = parseInt(heading.tagName[1], 10);
    if (lastLevel > 0 && level > lastLevel + 1) {
      issues.push(issue("html-heading-skip", "warning", `Heading level skips h${lastLevel} → h${level}`, "Don't skip heading levels — it confuses screen reader outlines.", cssPath(heading)));
    }
    lastLevel = level;
  }
}

function checkInteractiveNesting(doc: Document, issues: AuditIssue[]): void {
  doc.querySelectorAll("a").forEach((anchor) => {
    if (anchor.querySelector("a, button, input, select, textarea")) {
      issues.push(issue("html-interactive-nesting", "error", "Interactive element nested inside link", "Links must not contain other interactive controls.", cssPath(anchor)));
    }
    const href = anchor.getAttribute("href")?.trim() ?? "";
    if (href === "" || href === "#") {
      issues.push(issue("html-empty-href", "warning", "Empty or placeholder href", "Use a real URL or a <button> for actions.", cssPath(anchor)));
    }
  });

  doc.querySelectorAll("button").forEach((btn) => {
    if (!btn.textContent?.trim() && !btn.getAttribute("aria-label") && !btn.querySelector("[aria-label], img[alt]")) {
      issues.push(issue("html-empty-button", "warning", "Button with no accessible name", "Add visible text or aria-label to buttons.", cssPath(btn)));
    }
  });
}

function checkTables(doc: Document, issues: AuditIssue[]): void {
  doc.querySelectorAll("table").forEach((table) => {
    const hasTh = table.querySelector("th");
    const hasRole = table.getAttribute("role") === "presentation";
    if (!hasTh && !hasRole) {
      issues.push(issue("html-table-headers", "warning", "Data table without <th>", "Use header cells or role=\"presentation\" for layout tables.", cssPath(table)));
    }
  });
}

function checkLinksAndMedia(doc: Document, issues: AuditIssue[]): void {
  doc.querySelectorAll("img").forEach((img) => {
    if (!img.hasAttribute("alt")) {
      issues.push(issue("html-img-alt", "error", "Image missing alt attribute", "All images must have an alt attribute (use alt=\"\" for decorative images).", cssPath(img)));
    }
  });

  doc.querySelectorAll("iframe").forEach((frame) => {
    if (!frame.getAttribute("title")?.trim()) {
      issues.push(issue("html-iframe-title", "error", "iframe missing title", "Iframes need a descriptive title attribute.", cssPath(frame)));
    }
  });

  doc.querySelectorAll('a[href^="javascript:" i]').forEach((a) => {
    issues.push(issue("html-js-link", "warning", "javascript: link", "Use buttons for JS actions instead of javascript: URLs.", cssPath(a)));
  });
}

function checkLandmarks(doc: Document, issues: AuditIssue[]): void {
  const mains = doc.querySelectorAll("main, [role='main']");
  if (mains.length === 0) {
    issues.push(issue("html-no-main", "warning", "No main landmark", "Add a <main> element to identify primary content."));
  } else if (mains.length > 1) {
    issues.push(issue("html-multiple-main", "warning", "Multiple main landmarks", "Only one <main> element should be visible at a time."));
  }
}

function checkParserErrors(doc: Document, issues: AuditIssue[]): void {
  doc.querySelectorAll("parsererror").forEach((el) => {
    issues.push(issue("html-parse-error", "error", "HTML parse error", (el.textContent ?? "Malformed markup").slice(0, 200)));
  });
}

function issue(
  id: string,
  severity: AuditIssue["severity"],
  title: string,
  description: string,
  selector?: string,
): AuditIssue {
  return { id, category: "html", severity, title, description, selector };
}

export function getHtmlMetaSummary(doc: Document): Record<string, string | null> {
  return {
    title: doc.querySelector("title")?.textContent?.trim() ?? null,
    description: getMetaContent(doc, "description"),
    viewport: getMetaContent(doc, "viewport"),
    robots: getMetaContent(doc, "robots"),
  };
}

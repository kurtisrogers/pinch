import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CheckedLink, SpiderReport } from "./types.js";
import { isContentLink, isDeadLink } from "./link-checker.js";

export function downloadLinkReportPdf(report: SpiderReport): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const deadLinks = report.links.filter(isDeadLink);
  const deadContentLinks = deadLinks.filter(isContentLink);
  const margin = 14;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Pinch — Dead Link Report", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Site: ${report.startUrl}`, margin, y);
  y += 5;
  doc.text(`Generated: ${formatDate(report.scannedAt)}`, margin, y);
  y += 5;
  doc.text(
    `Crawl: ${report.summary.pagesCrawled} pages · depth ≤ ${report.options.maxDepth} · max ${report.options.maxPages} pages`,
    margin,
    y,
  );
  y += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Summary", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summaryLines = [
    `Total links found: ${report.summary.linksFound}`,
    `Links checked: ${report.summary.linksChecked}`,
    `Dead links (4xx/5xx): ${report.summary.deadLinks}`,
    `Dead links in content areas: ${deadContentLinks.length}`,
    `OK: ${report.summary.okLinks} · Skipped: ${report.summary.skippedLinks} · Errors: ${report.summary.errorLinks}`,
  ];
  for (const line of summaryLines) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 4;

  if (deadLinks.length === 0) {
    doc.setTextColor(34, 139, 87);
    doc.setFont("helvetica", "bold");
    doc.text("No dead links found during this crawl.", margin, y);
    savePdf(doc, report.startUrl);
    return;
  }

  doc.setTextColor(200, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Dead links", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Source page", "Link URL", "Anchor text", "Zone", "Status"]],
    body: deadLinks.map((link) => [
      truncate(link.sourcePage, 55),
      truncate(link.absoluteUrl, 55),
      truncate(link.anchorText || "(empty)", 40),
      link.zone,
      link.message ?? `HTTP ${link.httpStatus ?? "?"}`,
    ]),
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [200, 40, 40], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 45 },
      2: { cellWidth: 35 },
      3: { cellWidth: 22 },
      4: { cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;

  if (deadContentLinks.length > 0 && finalY < 250) {
    let sectionY = finalY + 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Content-area dead links (priority fixes)", margin, sectionY);
    sectionY += 4;

    autoTable(doc, {
      startY: sectionY,
      head: [["Page", "Dead URL", "Link text"]],
      body: deadContentLinks.map((link: CheckedLink) => [
        truncate(link.sourcePage, 60),
        truncate(link.absoluteUrl, 70),
        truncate(link.anchorText || "(empty)", 50),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [240, 93, 94] },
      margin: { left: margin, right: margin },
    });
  }

  addPageNumbers(doc);
  savePdf(doc, report.startUrl);
}

function savePdf(doc: jsPDF, startUrl: string): void {
  const hostname = safeHostname(startUrl);
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`pinch-dead-links-${hostname}-${date}.pdf`);
}

function addPageNumbers(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Page ${i} of ${pageCount} · Pinch Link Report`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/\./g, "-");
  } catch {
    return "site";
  }
}

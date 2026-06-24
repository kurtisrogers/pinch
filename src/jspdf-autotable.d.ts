declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  interface AutoTableOptions {
    startY?: number;
    head?: string[][];
    body?: string[][];
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    columnStyles?: Record<number, Record<string, unknown>>;
    margin?: { left?: number; right?: number };
  }

  export default function autoTable(doc: jsPDF, options: AutoTableOptions): void;
}

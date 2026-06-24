export type AuditCategory = "ux" | "html" | "accessibility";

export type IssueSeverity = "error" | "warning" | "info";

export interface AuditIssue {
  id: string;
  category: AuditCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  selector?: string;
  wcag?: string;
}

export interface CategoryScore {
  category: AuditCategory;
  label: string;
  score: number;
  errors: number;
  warnings: number;
  infos: number;
  issues: AuditIssue[];
}

export interface AuditProgress {
  phase: "fetching" | "html" | "ux" | "accessibility" | "complete" | "error";
  message: string;
}

export interface AuditReport {
  url: string;
  pageTitle: string;
  scannedAt: string;
  categories: CategoryScore[];
  overallScore: number;
  totalIssues: number;
}

export interface AuditDocument {
  doc: Document;
  html: string;
  url: string;
}

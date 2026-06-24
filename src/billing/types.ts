export type Plan = "free" | "pro" | "team";

export type BillableTool = "scan" | "devaudit" | "crawl";

export const TOOL_COSTS: Record<BillableTool, number> = {
  scan: 1,
  devaudit: 2,
  crawl: 4,
};

export const PLAN_ALLOWANCES: Record<Plan, number> = {
  free: 10,
  pro: 200,
  team: 1000,
};

export interface CreditStatus {
  credits_remaining: number;
  plan: Plan;
  period_end: string;
  monthly_allowance: number;
}

export interface ConsumeResult {
  allowed: boolean;
  credits_remaining: number;
  plan: Plan;
  period_end: string;
  required?: number;
  cost?: number;
  error?: string;
}

export class BillingError extends Error {
  code: "not_configured" | "sign_in_required" | "insufficient_credits" | "network";
  status?: CreditStatus;
  required?: number;

  constructor(
    message: string,
    code: "not_configured" | "sign_in_required" | "insufficient_credits" | "network",
    status?: CreditStatus,
    required?: number,
  ) {
    super(message);
    this.name = "BillingError";
    this.code = code;
    this.status = status;
    this.required = required;
  }
}

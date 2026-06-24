import { getSession } from "./auth.js";
import { consumeCredits, fetchCreditStatus } from "./credits.js";
import { isBillingEnabled } from "./config.js";
import { BillingError, TOOL_COSTS, type BillableTool, type CreditStatus } from "./types.js";

export async function requireCredits(tool: BillableTool): Promise<CreditStatus | null> {
  if (!isBillingEnabled()) {
    return null;
  }

  const session = await getSession();
  if (!session) {
    throw new BillingError(
      "Sign in to run URL-based scans. Crush and local Tools stay free.",
      "sign_in_required",
    );
  }

  const result = await consumeCredits(tool);
  if (!result.allowed) {
    throw new BillingError(
      `Not enough credits. This ${tool} run needs ${result.required ?? TOOL_COSTS[tool]} credits; you have ${result.credits_remaining}. Credits refresh monthly.`,
      "insufficient_credits",
      {
        credits_remaining: result.credits_remaining,
        plan: result.plan,
        period_end: result.period_end,
        monthly_allowance: 0,
      },
      result.required,
    );
  }

  const full = await fetchCreditStatus();
  return full;
}

export async function refreshCredits(): Promise<CreditStatus | null> {
  if (!isBillingEnabled()) return null;
  const session = await getSession();
  if (!session) return null;
  return fetchCreditStatus();
}

export function billingErrorMessage(err: BillingError): string {
  switch (err.code) {
    case "sign_in_required":
      return err.message;
    case "insufficient_credits":
      return err.message;
    default:
      return err.message;
  }
}

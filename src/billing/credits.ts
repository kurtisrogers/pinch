import { accessToken } from "./auth.js";
import { functionsBaseUrl, isBillingEnabled } from "./config.js";
import type { BillableTool, ConsumeResult, CreditStatus } from "./types.js";
import { TOOL_COSTS } from "./types.js";

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  if (!token) {
    throw new Error("Not signed in");
  }

  return fetch(`${functionsBaseUrl()}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function fetchCreditStatus(): Promise<CreditStatus | null> {
  if (!isBillingEnabled()) return null;

  const response = await authFetch("get-credits");
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Could not load credits (${response.status})`);
  }
  return (await response.json()) as CreditStatus;
}

export async function consumeCredits(tool: BillableTool): Promise<ConsumeResult> {
  const response = await authFetch("consume-credits", {
    method: "POST",
    body: JSON.stringify({ tool }),
  });

  const payload = (await response.json()) as ConsumeResult;

  if (response.status === 402) {
    return payload;
  }

  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? `Credit check failed (${response.status})`);
  }

  return payload;
}

export function toolCostLabel(tool: BillableTool): string {
  const cost = TOOL_COSTS[tool];
  return `${cost} credit${cost === 1 ? "" : "s"}`;
}

export function formatPeriodEnd(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

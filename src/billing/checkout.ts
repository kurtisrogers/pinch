import { authFetch } from "./api.js";

export type CheckoutPlan = "pro" | "team";

interface CheckoutResponse {
  url: string;
}

function checkoutRedirectUrls(): { success_url: string; cancel_url: string } {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/+$/, "") + "/";
  return {
    success_url: `${base}?checkout=success`,
    cancel_url: `${base}?checkout=cancel`,
  };
}

export async function startCheckout(plan: CheckoutPlan = "pro"): Promise<void> {
  const { success_url, cancel_url } = checkoutRedirectUrls();

  const response = await authFetch("create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ plan, success_url, cancel_url }),
  });

  const payload = (await response.json()) as CheckoutResponse & { error?: string };

  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? `Checkout failed (${response.status})`);
  }

  window.location.href = payload.url;
}

export function readCheckoutReturn(): "success" | "cancel" | null {
  const value = new URLSearchParams(window.location.search).get("checkout");
  if (value === "success" || value === "cancel") return value;
  return null;
}

export function clearCheckoutReturnParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("checkout")) return;
  url.searchParams.delete("checkout");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

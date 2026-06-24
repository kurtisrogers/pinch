import type { Session } from "@supabase/supabase-js";
import { currentUserEmail, onAuthStateChange, signInWithEmail, signOut } from "../billing/auth.js";
import { isBillingEnabled, stripeProCheckoutUrl } from "../billing/config.js";
import { formatPeriodEnd, toolCostLabel } from "../billing/credits.js";
import { refreshCredits } from "../billing/gate.js";
import type { BillableTool, CreditStatus } from "../billing/types.js";
import { TOOL_COSTS } from "../billing/types.js";
import type { AppMode } from "./render-shell.js";
import { escapeHtml } from "./utils.js";

let latestStatus: CreditStatus | null = null;
let latestSession: Session | null = null;

export function toolCostHintForMode(mode: AppMode): string {
  if (!isBillingEnabled()) return "";
  if (!(mode in TOOL_COSTS)) return "";
  return ` · Costs ${toolCostLabel(mode as BillableTool)}`;
}

export function billingBarHtml(): string {
  if (!isBillingEnabled()) return "";

  return `
    <aside class="billing-bar" id="billing-bar">
      <div class="billing-meta">
        <span class="billing-plan" id="billing-plan">Free tier</span>
        <span class="billing-credits" id="billing-credits">Sign in for 10 free credits/month</span>
        <span class="billing-email" id="billing-email"></span>
      </div>
      <div class="billing-actions">
        <button type="button" class="billing-btn" id="billing-signin-btn">Sign in</button>
        <button type="button" class="billing-btn hidden" id="billing-signout-btn">Sign out</button>
        <button type="button" class="billing-btn upgrade" id="upgrade-btn">Upgrade to Pro</button>
      </div>
    </aside>

    <dialog class="auth-dialog" id="auth-dialog">
      <form method="dialog" id="auth-form" class="auth-form">
        <h2>Sign in to Pinch</h2>
        <p class="auth-sub">Magic link only — no password. Free tier includes 10 credits each month.</p>
        <label>
          Email
          <input type="email" id="auth-email" required autocomplete="email" placeholder="you@example.com" />
        </label>
        <p class="auth-message" id="auth-message"></p>
        <div class="auth-actions">
          <button type="submit" class="pdf-btn">Send magic link</button>
          <button type="button" class="pdf-btn secondary" id="auth-close-btn">Close</button>
        </div>
      </form>
    </dialog>
  `;
}

export function initBillingBar(): void {
  const bar = document.getElementById("billing-bar");
  if (!bar) return;

  if (!isBillingEnabled()) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  bindBillingEvents();
  wireAuthDialogClose();

  const unsubscribe = onAuthStateChange((session) => {
    latestSession = session;
    void syncBillingUi();
  });

  void getInitialSession().then(() => syncBillingUi());

  if (unsubscribe) {
    window.addEventListener("beforeunload", unsubscribe, { once: true });
  }
}

async function getInitialSession(): Promise<void> {
  const { getSession } = await import("../billing/auth.js");
  latestSession = await getSession();
}

function bindBillingEvents(): void {
  document.getElementById("billing-signin-btn")?.addEventListener("click", () => {
    openSignInDialog();
  });

  document.getElementById("billing-signout-btn")?.addEventListener("click", () => {
    void signOut().then(() => syncBillingUi());
  });

  document.getElementById("auth-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    void handleMagicLink();
  });

  document.getElementById("upgrade-btn")?.addEventListener("click", () => {
    const url = stripeProCheckoutUrl();
    if (url) window.open(url, "_blank", "noopener");
  });
}

function wireAuthDialogClose(): void {
  document.getElementById("auth-close-btn")?.addEventListener("click", () => {
    (document.getElementById("auth-dialog") as HTMLDialogElement | null)?.close();
  });
}

async function handleMagicLink(): Promise<void> {
  const emailInput = document.getElementById("auth-email") as HTMLInputElement;
  const message = document.getElementById("auth-message")!;
  try {
    await signInWithEmail(emailInput.value.trim());
    message.textContent = "Check your email for a magic link.";
    message.classList.remove("error");
  } catch (err) {
    message.textContent = err instanceof Error ? err.message : "Sign-in failed";
    message.classList.add("error");
  }
}

export async function syncBillingUi(): Promise<void> {
  if (!isBillingEnabled()) return;

  if (!latestSession) {
    const { getSession } = await import("../billing/auth.js");
    latestSession = await getSession();
  }

  latestStatus = latestSession ? await refreshCredits() : null;
  renderBillingBar();
}

function renderBillingBar(): void {
  const creditsEl = document.getElementById("billing-credits");
  const planEl = document.getElementById("billing-plan");
  const emailEl = document.getElementById("billing-email");
  const signInBtn = document.getElementById("billing-signin-btn");
  const signOutBtn = document.getElementById("billing-signout-btn");
  const upgradeBtn = document.getElementById("upgrade-btn");

  if (!creditsEl || !planEl) return;

  if (!latestSession) {
    creditsEl.textContent = "Sign in for 10 free credits/month";
    planEl.textContent = "Free tier";
    if (emailEl) emailEl.textContent = "";
    signInBtn?.classList.remove("hidden");
    signOutBtn?.classList.add("hidden");
    upgradeBtn?.classList.add("hidden");
    return;
  }

  signInBtn?.classList.add("hidden");
  signOutBtn?.classList.remove("hidden");

  const email = currentUserEmail(latestSession);
  if (emailEl) emailEl.textContent = email ?? "";

  if (!latestStatus) {
    creditsEl.textContent = "Loading credits…";
    return;
  }

  creditsEl.textContent = `${latestStatus.credits_remaining} credits left · resets ${formatPeriodEnd(latestStatus.period_end)}`;
  planEl.textContent = `${latestStatus.plan} plan · ${latestStatus.monthly_allowance}/month`;

  if (latestStatus.plan === "free") {
    upgradeBtn?.classList.remove("hidden");
  } else {
    upgradeBtn?.classList.add("hidden");
  }
}

export function openSignInDialog(): void {
  (document.getElementById("auth-dialog") as HTMLDialogElement | null)?.showModal();
}

export function applyCreditsAfterRun(status: CreditStatus | null): void {
  if (status) {
    latestStatus = status;
    renderBillingBar();
  } else {
    void syncBillingUi();
  }
}

export function renderBillingError(message: string, code?: string): void {
  if (code === "sign_in_required") {
    openSignInDialog();
  }
  const status = document.getElementById("status");
  if (status) {
    status.classList.remove("hidden");
    status.classList.add("error");
    status.innerHTML = `<p>${escapeHtml(message)}</p>`;
  }
}

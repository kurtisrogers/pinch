import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

type CheckoutPlan = "pro" | "team";

function priceIdForPlan(plan: CheckoutPlan): string {
  if (plan === "team") {
    const teamPrice = Deno.env.get("STRIPE_TEAM_PRICE_ID");
    if (!teamPrice) throw new Error("STRIPE_TEAM_PRICE_ID is not configured");
    return teamPrice;
  }

  const proPrice = Deno.env.get("STRIPE_PRO_PRICE_ID");
  if (!proPrice) throw new Error("STRIPE_PRO_PRICE_ID is not configured");
  return proPrice;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const userSupabase = userClient(authHeader);
    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const body = await req.json() as {
      plan?: CheckoutPlan;
      success_url?: string;
      cancel_url?: string;
    };

    const plan = body.plan ?? "pro";
    if (plan !== "pro" && plan !== "team") {
      return jsonResponse({ error: "invalid_plan", valid: ["pro", "team"] }, 400);
    }

    if (!body.success_url || !body.cancel_url) {
      return jsonResponse({ error: "missing_redirect_urls" }, 400);
    }

    const admin = adminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    const priceId = priceIdForPlan(plan);
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.success_url,
      cancel_url: body.cancel_url,
      client_reference_id: userData.user.id,
      metadata: {
        supabase_user_id: userData.user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userData.user.id,
          plan,
        },
      },
    };

    if (profile?.stripe_customer_id) {
      sessionParams.customer = profile.stripe_customer_id;
    } else if (userData.user.email) {
      sessionParams.customer_email = userData.user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return jsonResponse({ error: "checkout_url_missing" }, 500);
    }

    return jsonResponse({ url: session.url, session_id: session.id });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "checkout_failed" }, 500);
  }
});

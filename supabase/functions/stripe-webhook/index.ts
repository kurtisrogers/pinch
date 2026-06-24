import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { jsonResponse } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

type PlanName = "free" | "pro" | "team";

function planFromPriceId(priceId: string | undefined): PlanName {
  const pro = Deno.env.get("STRIPE_PRO_PRICE_ID");
  const team = Deno.env.get("STRIPE_TEAM_PRICE_ID");
  if (priceId && team && priceId === team) return "team";
  if (priceId && pro && priceId === pro) return "pro";
  return "pro";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const signature = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !secret) {
    return jsonResponse({ error: "missing_webhook_config" }, 500);
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "invalid_signature" }, 400);
  }

  const admin = adminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
        const plan = (session.metadata?.plan as PlanName | undefined) ?? "pro";

        if (userId) {
          await admin.rpc("set_plan_from_stripe", {
            p_user_id: userId,
            p_plan: plan,
            p_stripe_customer_id: customerId ?? null,
            p_stripe_subscription_id: subscriptionId ?? null,
          });
        } else if (customerId) {
          await admin.rpc("set_plan_by_stripe_customer", {
            p_stripe_customer_id: customerId,
            p_plan: plan,
            p_stripe_subscription_id: subscriptionId ?? null,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = sub.items.data[0]?.price.id;
        const plan = planFromPriceId(priceId);
        const active = sub.status === "active" || sub.status === "trialing";
        const userId = sub.metadata?.supabase_user_id;

        if (userId) {
          await admin.rpc("set_plan_from_stripe", {
            p_user_id: userId,
            p_plan: active ? plan : "free",
            p_stripe_customer_id: customerId,
            p_stripe_subscription_id: sub.id,
          });
        } else {
          await admin.rpc("set_plan_by_stripe_customer", {
            p_stripe_customer_id: customerId,
            p_plan: active ? plan : "free",
            p_stripe_subscription_id: sub.id,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await admin.rpc("set_plan_by_stripe_customer", {
          p_stripe_customer_id: customerId,
          p_plan: "free",
          p_stripe_subscription_id: null,
        });
        break;
      }

      default:
        break;
    }

    return jsonResponse({ received: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "webhook_failed" }, 500);
  }
});

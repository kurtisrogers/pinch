import { isBillableTool, toolCost } from "../_shared/credits.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";

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

    const body = await req.json() as { tool?: string };
    const tool = body.tool ?? "";
    if (!isBillableTool(tool)) {
      return jsonResponse({ error: "invalid_tool", valid: ["scan", "devaudit", "crawl"] }, 400);
    }

    const cost = toolCost(tool);
    const admin = adminClient();
    const { data, error } = await admin.rpc("consume_credits", {
      p_user_id: userData.user.id,
      p_tool: tool,
      p_cost: cost,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    const result = data as {
      allowed: boolean;
      credits_remaining: number;
      plan: string;
      period_end: string;
      required?: number;
      cost?: number;
      error?: string;
    };

    if (!result.allowed) {
      return jsonResponse(result, 402);
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "unknown_error" }, 500);
  }
});

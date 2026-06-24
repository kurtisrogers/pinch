import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const userSupabase = userClient(authHeader);
    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const admin = adminClient();
    const { data, error } = await admin.rpc("get_credit_status", {
      p_user_id: userData.user.id,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "unknown_error" }, 500);
  }
});

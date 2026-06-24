# Billing MVP setup

Pinch can run **without billing** (current open-source behaviour). When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set at build time, URL-based tools require sign-in and consume monthly credits.

## Credit model

| Tool | Cost | Notes |
|------|------|-------|
| Scan | 1 credit | Image efficiency |
| Dev Audit | 2 credits | Full developer audit |
| Crawl | 4 credits | Spider + redirects + mixed content + sitemap |
| Crush | Free | Local file processing |
| Tools (HAR, baseline) | Free | Local / browser storage |

| Plan | Credits / month |
|------|-----------------|
| Free | 10 |
| Pro | 200 |
| Team | 1000 |

Credits reset on the 1st of each UTC month (lazy reset on first request after `period_end`).

---

## 1. Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note **Project URL** and **anon public key**
3. Install CLI: `npm i -g supabase`

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 2. Run database migration

```bash
supabase db push
# or apply manually in SQL Editor:
# supabase/migrations/20250624120000_billing.sql
```

This creates:

- `profiles` — plan, credits, billing period, Stripe IDs
- `usage_logs` — audit trail per tool run
- RPCs: `consume_credits`, `get_credit_status`, `set_plan_from_stripe`

New auth users automatically get a `free` profile with 10 credits via trigger.

## 3. Deploy Edge Functions

Set secrets (Dashboard → Project Settings → Edge Functions, or CLI):

```bash
supabase secrets set \
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  SUPABASE_ANON_KEY=your-anon-key \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRO_PRICE_ID=price_... \
  STRIPE_TEAM_PRICE_ID=price_...
```

Deploy:

```bash
supabase functions deploy consume-credits --no-verify-jwt
supabase functions deploy get-credits --no-verify-jwt
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

> JWT is verified inside each function via `auth.getUser()`. Disable gateway JWT verification so the anon key reaches the function; user token is validated in code.

### API routes

| Function | Method | Auth | Body |
|----------|--------|------|------|
| `/functions/v1/get-credits` | GET | Bearer JWT | — |
| `/functions/v1/consume-credits` | POST | Bearer JWT | `{ "tool": "scan" \| "devaudit" \| "crawl" }` |
| `/functions/v1/create-checkout-session` | POST | Bearer JWT | `{ "plan": "pro" \| "team", "success_url": "...", "cancel_url": "..." }` |
| `/functions/v1/stripe-webhook` | POST | Stripe signature | Stripe event payload |

`consume-credits` returns **402** when insufficient credits:

```json
{
  "allowed": false,
  "credits_remaining": 0,
  "required": 4,
  "error": "insufficient_credits"
}
```

## 4. Configure Auth (magic link)

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://kurtisrogers.github.io/pinch/`
- **Redirect URLs:** add your GitHub Pages URL and `http://localhost:5173/pinch/` for dev

Enable Email provider (magic link). Disable password if you only want OTP.

## 5. Stripe setup

1. Create **Pro** (and optional **Team**) product + recurring prices in Stripe
2. Note the **Price IDs** (`price_...`) for `STRIPE_PRO_PRICE_ID` and `STRIPE_TEAM_PRICE_ID` secrets
3. Add webhook endpoint: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

### Automatic checkout (recommended)

The **Upgrade to Pro** button calls `create-checkout-session`, which:

- Requires the user to be signed in (JWT)
- Creates a Stripe Checkout session with `client_reference_id` = Supabase user UUID
- Sets `metadata.supabase_user_id` and `metadata.plan` on the session and subscription
- Reuses an existing `stripe_customer_id` from `profiles` when present
- Redirects back to Pinch with `?checkout=success` or `?checkout=cancel`

No manual user linking is needed — the webhook reads the UUID from the session.

Example response from `create-checkout-session`:

```json
{ "url": "https://checkout.stripe.com/c/pay/cs_test_...", "session_id": "cs_test_..." }
```

### Payment Link fallback (optional)

If the Edge Function is unavailable, set `VITE_STRIPE_PRO_CHECKOUT_URL` to a static Stripe Payment Link. This path cannot attach the Supabase user UUID automatically, so prefer the API flow above.

## 6. GitHub Pages build secrets

Repo → Settings → Secrets → Actions:

| Secret | Purpose |
|--------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe in client) |
| `VITE_STRIPE_PRO_CHECKOUT_URL` | Optional Payment Link fallback if checkout API fails |

The deploy workflow passes these into `npm run build`. **Never** commit service role or Stripe secret keys to the repo.

## 7. Local development

```bash
cp .env.example .env
# fill in Supabase keys
npm run dev
```

With empty `.env`, billing UI is hidden and tools work without auth.

---

## Architecture

```
GitHub Pages (Vite UI)
    │ magic link sign-in
    ▼
Supabase Auth
    │ JWT
    ▼
Edge Functions (consume-credits, get-credits, create-checkout-session)
    │ service role
    ▼
Postgres (profiles, usage_logs, RPC ledger)
    ▲
Stripe Checkout ← create-checkout-session (embeds user UUID)
    ▲
Stripe webhook → set_plan_from_stripe
```

Scans still run **in the browser** after credits are deducted server-side. This MVP prevents casual abuse and enables paid tiers; moving fetch/crawl to a server-side worker is the next step for stronger enforcement.

---

## Upgrading users manually (testing)

```sql
select public.set_plan_from_stripe(
  'USER_UUID'::uuid,
  'pro'::public.plan_t,
  'cus_test',
  'sub_test'
);
```

## Checking usage

```sql
select * from usage_logs
where user_id = 'USER_UUID'
order by created_at desc
limit 20;
```

# AGENTS.md

## Cursor Cloud specific instructions

**Product:** `pinch` — a single, client-side site-audit toolkit (Vite 6 + TypeScript, vanilla DOM). All core tools (Crush image optimizer, Image Scanner, Dev Audit, Crawl, HAR/baseline Tools) run entirely in the browser. There is no traditional backend for the core product.

**Run / build / type-check** (commands are in `package.json`):
- Dev server: `npm run dev` → serves at `http://localhost:5173/pinch/`. **The `/pinch/` base path is required** (set by `vite.config.ts`); `http://localhost:5173/` alone will 404.
- Build: `npm run build` (runs `tsc` then `vite build`, output to `dist/`).
- There is **no separate lint script**. Type-checking is the `tsc` step inside `npm run build`; run that to verify types. Build warnings about chunk size / dynamic-vs-static imports are expected and non-fatal.

**Billing is optional and disabled by default.** Without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars, `isBillingEnabled()` returns false and every tool runs free with no sign-in. Exercising the billing flow end-to-end (Supabase Auth + Postgres + Deno Edge Functions + Stripe) requires external hosted services and secrets; see `docs/BILLING.md`. The Edge Functions in `supabase/functions/` run on Deno, separate from the npm project.

**URL-based tools (Image Scanner, Dev Audit, Crawl)** depend on public CORS proxies (`corsproxy.io`, `images.weserv.nl`) and outbound internet access at runtime. The Crush optimizer and HAR/baseline Tools work fully offline.

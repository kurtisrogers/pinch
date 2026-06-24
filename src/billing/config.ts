export function isBillingEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function supabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL ?? "";
}

export function supabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
}

export function stripeProCheckoutUrl(): string | undefined {
  const url = import.meta.env.VITE_STRIPE_PRO_CHECKOUT_URL;
  return url && url.length > 0 ? url : undefined;
}

export function functionsBaseUrl(): string {
  return `${supabaseUrl()}/functions/v1`;
}

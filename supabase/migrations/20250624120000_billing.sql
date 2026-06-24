-- Pinch billing: profiles, usage logs, credit ledger RPCs

create type public.plan_t as enum ('free', 'pro', 'team');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan public.plan_t not null default 'free',
  credits_remaining int not null default 10 check (credits_remaining >= 0),
  period_start timestamptz not null default date_trunc('month', timezone('utc', now())),
  period_end timestamptz not null default (date_trunc('month', timezone('utc', now())) + interval '1 month'),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tool text not null,
  credits_cost int not null check (credits_cost > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index usage_logs_user_created_idx on public.usage_logs (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.usage_logs enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "usage_logs_select_own"
  on public.usage_logs for select
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.plan_allowance(p public.plan_t)
returns int
language sql
immutable
as $$
  select case p
    when 'free' then 10
    when 'pro' then 200
    when 'team' then 1000
  end;
$$;

create or replace function public.ensure_fresh_period(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
  allowance int;
begin
  select * into prof from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found';
  end if;

  if now() >= prof.period_end then
    allowance := public.plan_allowance(prof.plan);
    update public.profiles
    set
      credits_remaining = allowance,
      period_start = date_trunc('month', timezone('utc', now())),
      period_end = date_trunc('month', timezone('utc', now())) + interval '1 month',
      updated_at = now()
    where id = p_user_id
    returning * into prof;
  end if;

  return prof;
end;
$$;

create or replace function public.consume_credits(
  p_user_id uuid,
  p_tool text,
  p_cost int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
  new_balance int;
begin
  if p_cost <= 0 then
    raise exception 'cost must be positive';
  end if;

  prof := public.ensure_fresh_period(p_user_id);

  if prof.credits_remaining < p_cost then
    return jsonb_build_object(
      'allowed', false,
      'credits_remaining', prof.credits_remaining,
      'plan', prof.plan,
      'period_end', prof.period_end,
      'required', p_cost,
      'error', 'insufficient_credits'
    );
  end if;

  new_balance := prof.credits_remaining - p_cost;

  update public.profiles
  set credits_remaining = new_balance, updated_at = now()
  where id = p_user_id;

  insert into public.usage_logs (user_id, tool, credits_cost)
  values (p_user_id, p_tool, p_cost);

  return jsonb_build_object(
    'allowed', true,
    'credits_remaining', new_balance,
    'plan', prof.plan,
    'period_end', prof.period_end,
    'cost', p_cost
  );
end;
$$;

create or replace function public.get_credit_status(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
  allowance int;
begin
  prof := public.ensure_fresh_period(p_user_id);
  allowance := public.plan_allowance(prof.plan);

  return jsonb_build_object(
    'credits_remaining', prof.credits_remaining,
    'plan', prof.plan,
    'period_end', prof.period_end,
    'monthly_allowance', allowance
  );
end;
$$;

create or replace function public.set_plan_from_stripe(
  p_user_id uuid,
  p_plan public.plan_t,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    plan = p_plan,
    credits_remaining = public.plan_allowance(p_plan),
    stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
    stripe_subscription_id = coalesce(p_stripe_subscription_id, stripe_subscription_id),
    period_start = date_trunc('month', timezone('utc', now())),
    period_end = date_trunc('month', timezone('utc', now())) + interval '1 month',
    updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.set_plan_by_stripe_customer(
  p_stripe_customer_id text,
  p_plan public.plan_t,
  p_stripe_subscription_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    plan = p_plan,
    credits_remaining = public.plan_allowance(p_plan),
    stripe_subscription_id = coalesce(p_stripe_subscription_id, stripe_subscription_id),
    period_start = date_trunc('month', timezone('utc', now())),
    period_end = date_trunc('month', timezone('utc', now())) + interval '1 month',
    updated_at = now()
  where stripe_customer_id = p_stripe_customer_id;
end;
$$;

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select on public.usage_logs to authenticated;

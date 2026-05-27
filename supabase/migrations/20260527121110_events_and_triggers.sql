-- ============================================================
-- SETUP: run this once in SQL Editor to register the service role key:
--   ALTER DATABASE postgres SET app.settings.service_role_key = '<your-service-role-key>';
--   SELECT pg_reload_conf();
-- Get the key from: Supabase Dashboard -> Settings -> API -> service_role
-- ============================================================

-- Extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ============================================================
-- TABLES
-- ============================================================

-- User profiles (populated by USER EVENT trigger)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  created_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
create policy "profile_own" on public.user_profiles for all using (auth.uid() = id);

-- Daily sales reports (populated by CRON EVENT)
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  total_orders integer not null default 0,
  total_revenue numeric(10,2) not null default 0,
  completed_orders integer not null default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- STORAGE: product-images bucket
-- ============================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "product_images_upload" on storage.objects
  for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "product_images_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and auth.uid() = owner);

-- ============================================================
-- RPC: decrement_stock (used by on-order-created function)
-- ============================================================

create or replace function public.decrement_stock(p_product_id uuid, p_quantity integer)
returns void as $$
begin
  update public.products
  set stock = stock - p_quantity
  where id = p_product_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- HELPER: wrapper called by cron to trigger daily-report function
-- ============================================================

create or replace function public.trigger_daily_report()
returns void as $$
declare
  service_key text := current_setting('app.settings.service_role_key', true);
begin
  if service_key is null then
    raise notice 'app.settings.service_role_key not set — skipping daily report trigger';
    return;
  end if;

  perform net.http_post(
    url := 'https://oqrrplrmyjvwuvywvrao.supabase.co/functions/v1/daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- EVENT 1: DB CHANGE — new order triggers on-order-created function
-- ============================================================

create or replace function public.notify_order_created()
returns trigger as $$
declare
  service_key text := current_setting('app.settings.service_role_key', true);
begin
  if service_key is null then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://oqrrplrmyjvwuvywvrao.supabase.co/functions/v1/on-order-created',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := row_to_json(NEW)::jsonb
  );
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_order_created
  after insert on public.orders
  for each row execute function public.notify_order_created();

-- ============================================================
-- EVENT 2: STORAGE — file upload triggers on-file-upload function
-- ============================================================

create or replace function public.notify_storage_upload()
returns trigger as $$
declare
  service_key text := current_setting('app.settings.service_role_key', true);
begin
  if NEW.bucket_id <> 'product-images' or service_key is null then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://oqrrplrmyjvwuvywvrao.supabase.co/functions/v1/on-file-upload',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'bucket_id', NEW.bucket_id,
      'name', NEW.name,
      'owner', NEW.owner
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_product_image_upload
  after insert on storage.objects
  for each row execute function public.notify_storage_upload();

-- ============================================================
-- EVENT 3: USER — new registration triggers on-user-registered function
-- ============================================================

create or replace function public.notify_user_registered()
returns trigger as $$
declare
  service_key text := current_setting('app.settings.service_role_key', true);
begin
  -- Always create profile directly (reliable fallback)
  insert into public.user_profiles (id, full_name)
  values (NEW.id, NEW.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  -- Also call Edge Function asynchronously
  if service_key is not null then
    perform net.http_post(
      url := 'https://oqrrplrmyjvwuvywvrao.supabase.co/functions/v1/on-user-registered',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.notify_user_registered();

-- ============================================================
-- EVENT 4: CRON — daily report every day at 08:00 UTC
-- ============================================================

select cron.schedule(
  'daily-sales-report',
  '0 8 * * *',
  'select public.trigger_daily_report();'
);

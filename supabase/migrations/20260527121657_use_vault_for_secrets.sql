-- ============================================================
-- SETUP: run this once in SQL Editor to store your service role key:
--   select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
-- Get the key from: Supabase Dashboard -> Settings -> API -> service_role
-- ============================================================

-- Helper to fetch service role key from vault
create or replace function public.get_service_role_key()
returns text as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;
$$ language sql security definer stable;

-- ============================================================
-- EVENT 1: DB CHANGE — new order triggers on-order-created
-- ============================================================

create or replace function public.notify_order_created()
returns trigger as $$
declare
  service_key text := public.get_service_role_key();
begin
  if service_key is null then
    raise notice '[notify_order_created] service_role_key not in vault — skipping';
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

-- ============================================================
-- EVENT 2: STORAGE — file upload triggers on-file-upload
-- ============================================================

create or replace function public.notify_storage_upload()
returns trigger as $$
declare
  service_key text := public.get_service_role_key();
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

-- ============================================================
-- EVENT 3: USER — new registration triggers on-user-registered
-- ============================================================

create or replace function public.notify_user_registered()
returns trigger as $$
declare
  service_key text := public.get_service_role_key();
begin
  -- Always create profile directly (reliable)
  insert into public.user_profiles (id, full_name)
  values (NEW.id, NEW.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

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

-- ============================================================
-- EVENT 4: CRON — daily report wrapper
-- ============================================================

create or replace function public.trigger_daily_report()
returns void as $$
declare
  service_key text := public.get_service_role_key();
begin
  if service_key is null then
    raise notice '[trigger_daily_report] service_role_key not in vault — skipping';
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

-- LOG/MONITORING EVENT: alert when product stock drops below threshold

create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  product_name text not null,
  stock_level integer not null,
  message text not null,
  created_at timestamptz default now()
);

-- Trigger function: fires when product stock is updated to below 5
create or replace function public.notify_low_stock()
returns trigger as $$
declare
  service_key text := public.get_service_role_key();
begin
  -- Only fire when stock drops below 5
  if NEW.stock < 5 and (OLD.stock is null or OLD.stock >= 5) then
    if service_key is not null then
      perform net.http_post(
        url := 'https://oqrrplrmyjvwuvywvrao.supabase.co/functions/v1/on-low-stock',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'id', NEW.id,
          'name', NEW.name,
          'stock', NEW.stock
        )
      );
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_product_low_stock
  after update of stock on public.products
  for each row execute function public.notify_low_stock();

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null,
  stock integer not null default 0,
  image_url text,
  created_at timestamptz default now()
);

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending',
  total numeric(10,2) not null,
  created_at timestamptz default now()
);

-- Order items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  quantity integer not null,
  price numeric(10,2) not null
);

-- Cart
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamptz default now(),
  unique(user_id, product_id)
);

-- Enable Row Level Security
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.cart_items enable row level security;

-- Products: readable by all, writable by authenticated
create policy "products_read" on public.products for select using (true);
create policy "products_write" on public.products for all using (auth.role() = 'authenticated');

-- Orders: users see only their own
create policy "orders_own" on public.orders for all using (auth.uid() = user_id);
create policy "order_items_own" on public.order_items for all
  using (exists (select 1 from public.orders where id = order_id and user_id = auth.uid()));

-- Cart: users see only their own
create policy "cart_own" on public.cart_items for all using (auth.uid() = user_id);

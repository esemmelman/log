create table public.elliot_log_items_v1 (
id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
name text not null check(length(trim(name)) between 1 and 200), created_at timestamptz not null default now(), unique(id,owner_id));
create table public.elliot_log_records_v1 (
id uuid primary key default gen_random_uuid(), item_id uuid not null, owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
speaker text not null check(speaker in ('Me','Other')), body text not null check(length(trim(body)) between 1 and 20000),
created_at timestamptz not null default now(), foreign key(item_id,owner_id) references public.elliot_log_items_v1(id,owner_id) on delete cascade);
create index elliot_log_items_v1_owner_idx on public.elliot_log_items_v1(owner_id);
create index elliot_log_records_v1_item_date_idx on public.elliot_log_records_v1(item_id,created_at,id);
alter table public.elliot_log_items_v1 enable row level security;
alter table public.elliot_log_records_v1 enable row level security;
revoke all on public.elliot_log_items_v1, public.elliot_log_records_v1 from anon,authenticated;
grant select,insert,delete on public.elliot_log_items_v1 to authenticated;
grant update(name) on public.elliot_log_items_v1 to authenticated;
grant select,insert on public.elliot_log_records_v1 to authenticated;
create policy elliot_log_items_v1_select on public.elliot_log_items_v1 for select to authenticated using(owner_id=(select auth.uid()));
create policy elliot_log_items_v1_insert on public.elliot_log_items_v1 for insert to authenticated with check(owner_id=(select auth.uid()));
create policy elliot_log_items_v1_update on public.elliot_log_items_v1 for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy elliot_log_items_v1_delete on public.elliot_log_items_v1 for delete to authenticated using(owner_id=(select auth.uid()));
create policy elliot_log_records_v1_select on public.elliot_log_records_v1 for select to authenticated using(owner_id=(select auth.uid()));
create policy elliot_log_records_v1_insert on public.elliot_log_records_v1 for insert to authenticated with check(owner_id=(select auth.uid()));

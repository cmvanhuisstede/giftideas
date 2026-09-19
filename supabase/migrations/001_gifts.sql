-- Run this whole file in Supabase's SQL Editor before deploying.
-- After creating your Auth user, run the final INSERT below with that user's UUID.

create table if not exists public.owner_settings (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- This table is intentionally invisible to both visitors and signed-in users.
alter table public.owner_settings enable row level security;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.owner_settings where user_id = auth.uid()
  );
$$;

revoke all on public.owner_settings from anon, authenticated;
grant execute on function public.is_owner() to anon, authenticated;

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 70),
  link text not null check (link ~ '^https?://'),
  image_path text,
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.gifts enable row level security;

drop policy if exists "Anyone can view gifts" on public.gifts;
drop policy if exists "Only the owner can add gifts" on public.gifts;
drop policy if exists "Only the owner can edit gift details" on public.gifts;
drop policy if exists "Only the owner can delete gifts" on public.gifts;

create policy "Anyone can view gifts"
on public.gifts for select to anon, authenticated using (true);

create policy "Only the owner can add gifts"
on public.gifts for insert to authenticated with check (public.is_owner());

create policy "Only the owner can edit gift details"
on public.gifts for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "Only the owner can delete gifts"
on public.gifts for delete to authenticated using (public.is_owner());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gifts'
  ) then
    alter publication supabase_realtime add table public.gifts;
  end if;
end;
$$;

-- Anonymous visitors use this limited function instead of receiving direct update access.
create or replace function public.set_gift_claimed(gift_id uuid, is_claimed boolean)
returns public.gifts
language plpgsql
security definer
set search_path = public
as $$
declare updated_gift public.gifts;
begin
  update public.gifts
  set claimed = is_claimed
  where id = gift_id
  returning * into updated_gift;
  return updated_gift;
end;
$$;

revoke all on function public.set_gift_claimed(uuid, boolean) from public;
grant execute on function public.set_gift_claimed(uuid, boolean) to anon, authenticated;

-- Create a public Storage bucket for cover images.
insert into storage.buckets (id, name, public)
values ('gift-images', 'gift-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Owner can upload covers" on storage.objects;
drop policy if exists "Owner can update covers" on storage.objects;
drop policy if exists "Owner can remove covers" on storage.objects;

create policy "Owner can upload covers"
on storage.objects for insert to authenticated
with check (bucket_id = 'gift-images' and public.is_owner());

create policy "Owner can update covers"
on storage.objects for update to authenticated
using (bucket_id = 'gift-images' and public.is_owner())
with check (bucket_id = 'gift-images' and public.is_owner());

create policy "Owner can remove covers"
on storage.objects for delete to authenticated
using (bucket_id = 'gift-images' and public.is_owner());

-- Once you have created your account in Authentication → Users, run this once:
-- insert into public.owner_settings (user_id) values ('PASTE-YOUR-AUTH-USER-UUID-HERE');

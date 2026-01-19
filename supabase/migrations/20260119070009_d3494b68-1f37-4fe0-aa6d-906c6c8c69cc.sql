-- App icons storage bucket
insert into storage.buckets (id, name, public)
values ('app-icons', 'app-icons', true)
on conflict (id) do update set public = excluded.public;

-- Storage policies (app-icons)
-- Public read so icons can be fetched by browsers for PWA metadata
create policy "Public can read app icons"
on storage.objects
for select
using (bucket_id = 'app-icons');

-- Super admins manage
create policy "Super admins can upload app icons"
on storage.objects
for insert
with check (bucket_id = 'app-icons' and public.is_super_admin());

create policy "Super admins can update app icons"
on storage.objects
for update
using (bucket_id = 'app-icons' and public.is_super_admin())
with check (bucket_id = 'app-icons' and public.is_super_admin());

create policy "Super admins can delete app icons"
on storage.objects
for delete
using (bucket_id = 'app-icons' and public.is_super_admin());

-- App settings singleton
create table if not exists public.app_settings (
  id int primary key default 1,
  app_name text not null default 'Wild Ones Family App',
  short_name text not null default 'Family Dashboard',
  icon_192_path text,
  icon_512_path text,
  apple_touch_icon_path text,
  favicon_path text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

alter table public.app_settings enable row level security;

create policy "Super admins can read app settings"
on public.app_settings
for select
using (public.is_super_admin());

create policy "Super admins can manage app settings"
on public.app_settings
for all
using (public.is_super_admin())
with check (public.is_super_admin());

insert into public.app_settings (
  id,
  icon_192_path,
  icon_512_path,
  apple_touch_icon_path,
  favicon_path
)
values (
  1,
  'icon-192x192.png',
  'icon-512x512.png',
  'apple-touch-icon.png',
  'favicon.ico'
)
on conflict (id) do nothing;
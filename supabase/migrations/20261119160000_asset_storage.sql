alter table public.products
  add column if not exists image_url text
  check (image_url is null or char_length(image_url) <= 2000);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kurostore-assets',
  'kurostore-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.asset_files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'kurostore-assets',
  object_path text not null,
  original_name text not null,
  public_url text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size >= 0),
  sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, object_path)
);

drop trigger if exists asset_files_set_updated_at on public.asset_files;
create trigger asset_files_set_updated_at before update on public.asset_files
  for each row execute function public.set_updated_at();

alter table public.asset_files enable row level security;

drop policy if exists "Asset files are publicly readable" on public.asset_files;
create policy "Asset files are publicly readable"
  on public.asset_files for select to anon, authenticated
  using (true);

drop policy if exists "Public assets are downloadable" on storage.objects;
create policy "Public assets are downloadable"
  on storage.objects for select
  using (bucket_id = 'kurostore-assets');

grant select on public.asset_files to anon, authenticated;

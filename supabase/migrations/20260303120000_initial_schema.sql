create extension if not exists pgcrypto;

create type public.bookmark_type as enum ('default', 'header', 'hidden');

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_uid text not null,
  title text not null,
  authors text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_uid)
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_uid text not null,
  book_id uuid not null references public.books(id) on delete cascade,
  bookmark_text text not null,
  paragraph integer not null default 0,
  word integer not null default 0,
  bookmark_type public.bookmark_type not null default 'default',
  source_style_id integer,
  source_visible integer,
  source_creation_time bigint,
  source_modification_time bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_uid)
);

create index bookmarks_book_id_idx on public.bookmarks (book_id, paragraph, word);
create index books_user_id_idx on public.books (user_id);
create index bookmarks_user_id_idx on public.bookmarks (user_id);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  books_count integer not null default 0,
  bookmarks_count integer not null default 0,
  delete_error text,
  created_at timestamptz not null default now()
);

create index import_runs_user_id_idx on public.import_runs (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger books_updated_at
before update on public.books
for each row execute function public.set_updated_at();

create trigger bookmarks_updated_at
before update on public.bookmarks
for each row execute function public.set_updated_at();

alter table public.books enable row level security;
alter table public.bookmarks enable row level security;
alter table public.import_runs enable row level security;

create policy "Users can read own books"
on public.books
for select
using (auth.uid() = user_id);

create policy "Users can insert own books"
on public.books
for insert
with check (auth.uid() = user_id);

create policy "Users can update own books"
on public.books
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own books"
on public.books
for delete
using (auth.uid() = user_id);

create policy "Users can read own bookmarks"
on public.bookmarks
for select
using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
on public.bookmarks
for insert
with check (auth.uid() = user_id);

create policy "Users can update own bookmarks"
on public.bookmarks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
on public.bookmarks
for delete
using (auth.uid() = user_id);

create policy "Users can read own import runs"
on public.import_runs
for select
using (auth.uid() = user_id);

create policy "Users can insert own import runs"
on public.import_runs
for insert
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imports',
  'imports',
  false,
  52428800,
  array['application/x-sqlite3', 'application/octet-stream']
)
on conflict (id) do nothing;

create policy "Users can upload own import files"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'imports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read own import files"
on storage.objects
for select to authenticated
using (
  bucket_id = 'imports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own import files"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'imports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

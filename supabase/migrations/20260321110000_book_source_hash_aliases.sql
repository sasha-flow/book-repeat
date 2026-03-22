create table if not exists public.book_source_hashes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  source_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_hash)
);

create index if not exists book_source_hashes_user_id_idx
on public.book_source_hashes (user_id);

create index if not exists book_source_hashes_book_id_idx
on public.book_source_hashes (book_id);

alter table public.book_source_hashes enable row level security;

create policy "Users can read own book source hashes"
on public.book_source_hashes
for select
using (auth.uid() = user_id);

create policy "Users can insert own book source hashes"
on public.book_source_hashes
for insert
with check (auth.uid() = user_id);

create policy "Users can update own book source hashes"
on public.book_source_hashes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own book source hashes"
on public.book_source_hashes
for delete
using (auth.uid() = user_id);

insert into public.book_source_hashes (user_id, book_id, source_hash)
select user_id, id, source_hash
from public.books
where source_hash is not null
on conflict (user_id, source_hash) do nothing;

alter table public.books
drop constraint if exists books_user_id_source_hash_key;

alter table public.books
drop column if exists source_hash;

create or replace function public.merge_user_books(
  target_user_id uuid,
  winner_book_id uuid,
  loser_book_ids uuid[]
)
returns jsonb
language plpgsql
as $$
declare
  moved_aliases integer := 0;
  deleted_aliases integer := 0;
  moved_bookmarks integer := 0;
  deleted_books integer := 0;
begin
  if coalesce(array_length(loser_book_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'movedAliases', 0,
      'deletedAliases', 0,
      'movedBookmarks', 0,
      'deletedBooks', 0
    );
  end if;

  if winner_book_id = any(loser_book_ids) then
    raise exception 'Winner book cannot also be a loser book';
  end if;

  if not exists (
    select 1
    from public.books
    where id = winner_book_id
      and user_id = target_user_id
  ) then
    raise exception 'Winner book does not belong to the target user';
  end if;

  if exists (
    select 1
    from public.books
    where id = any(loser_book_ids)
      and user_id <> target_user_id
  ) then
    raise exception 'All loser books must belong to the target user';
  end if;

  update public.book_source_hashes aliases
  set book_id = winner_book_id
  where aliases.user_id = target_user_id
    and aliases.book_id = any(loser_book_ids)
    and not exists (
      select 1
      from public.book_source_hashes winner_aliases
      where winner_aliases.user_id = aliases.user_id
        and winner_aliases.book_id = winner_book_id
        and winner_aliases.source_hash = aliases.source_hash
    );
  get diagnostics moved_aliases = row_count;

  delete from public.book_source_hashes aliases
  where aliases.user_id = target_user_id
    and aliases.book_id = any(loser_book_ids);
  get diagnostics deleted_aliases = row_count;

  update public.bookmarks
  set book_id = winner_book_id
  where user_id = target_user_id
    and book_id = any(loser_book_ids);
  get diagnostics moved_bookmarks = row_count;

  delete from public.books
  where user_id = target_user_id
    and id = any(loser_book_ids);
  get diagnostics deleted_books = row_count;

  return jsonb_build_object(
    'movedAliases', moved_aliases,
    'deletedAliases', deleted_aliases,
    'movedBookmarks', moved_bookmarks,
    'deletedBooks', deleted_books
  );
end;
$$;
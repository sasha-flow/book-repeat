alter table public.books
rename column source_uid to source_hash;

alter table public.books
drop constraint if exists books_user_id_source_uid_key;

alter table public.books
add constraint books_user_id_source_hash_key unique (user_id, source_hash);
-- ============================================================================
-- PANEL OSOBISTY - 0003_storage.sql
-- Prywatny bucket na zdjecia paragonow.
--
-- Konwencja sciezki: receipts/<user_id>/<nazwa_pliku>
-- Pierwszy segment sciezki MUSI byc uuid uzytkownika - na tym opieraja sie
-- polityki. Aplikacja kompresuje zdjecie do ~200 KB przed wyslaniem,
-- limit 512 KB to zapas bezpieczenstwa.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  524288,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists receipts_select_own on storage.objects;
create policy receipts_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists receipts_insert_own on storage.objects;
create policy receipts_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists receipts_update_own on storage.objects;
create policy receipts_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists receipts_delete_own on storage.objects;
create policy receipts_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

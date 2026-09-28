-- A restrictive boundary also defeats unrelated permissive Storage policies.
create policy autofix_listing_photos_server_only on storage.objects
as restrictive for all to anon,authenticated
using (bucket_id <> 'autofix-listing-photos')
with check (bucket_id <> 'autofix-listing-photos');

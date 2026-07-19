-- =============================================================
-- Tammie Care V2 — สิทธิ์เข้าถึงรูปใน Storage (bucket: pet-photos)
-- รันหลังสร้าง bucket 'pet-photos' (Public bucket = ปิด)
-- =============================================================
--
-- โครงสร้าง path ที่ตกลงกันไว้:   <pet_id>/<ชื่อไฟล์>
--   เช่น  9f3c1a2e-...-b7/general-2026-07-17-1.jpg
--
-- โฟลเดอร์ชั้นแรก = pet_id → ใช้ผูกสิทธิ์รูปเข้ากับสิทธิ์ของสัตว์ตัวนั้นได้ตรง ๆ
-- ผลคือ: ใครเห็นสัตว์ตัวไหนได้ ก็เห็นรูปของตัวนั้นได้เท่านั้น
--        vet เปิดรูปดูได้ (view) แต่อัป/ลบไม่ได้
--        คนนอกเปิด URL ตรง ๆ ไม่ได้เลย (bucket เป็น private)
-- =============================================================


-- helper: แปลงโฟลเดอร์ชั้นแรกของ path เป็น pet_id แล้วหา family_id ของสัตว์ตัวนั้น
create or replace function public.pet_family_from_path(object_name text)
returns uuid language sql stable security definer set search_path = public as $$
  select p.family_id
  from public.pets p
  where p.id = nullif((storage.foldername(object_name))[1], '')::uuid;
$$;


-- -------------------------------------------------------------
-- อ่านรูป: parent ทุกระดับ + vet ที่ได้รับสิทธิ์
-- -------------------------------------------------------------
drop policy if exists pet_photos_select on storage.objects;
create policy pet_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pet-photos'
    and can_view_family(pet_family_from_path(name))
  );

-- -------------------------------------------------------------
-- อัปโหลดรูป: เฉพาะ parent ที่ edit / admin (vet อัปไม่ได้)
-- -------------------------------------------------------------
drop policy if exists pet_photos_insert on storage.objects;
create policy pet_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pet-photos'
    and can_edit_family(pet_family_from_path(name))
  );

-- -------------------------------------------------------------
-- แก้ไข / ลบรูป: เฉพาะ parent ที่ edit / admin
-- -------------------------------------------------------------
drop policy if exists pet_photos_update on storage.objects;
create policy pet_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pet-photos'
    and can_edit_family(pet_family_from_path(name))
  );

drop policy if exists pet_photos_delete on storage.objects;
create policy pet_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pet-photos'
    and can_edit_family(pet_family_from_path(name))
  );


-- -------------------------------------------------------------
-- ตรวจว่า bucket เป็น private จริง — public ต้องเป็น false
-- -------------------------------------------------------------
select id, name, public from storage.buckets where id = 'pet-photos';

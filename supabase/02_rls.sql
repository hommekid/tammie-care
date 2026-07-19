-- =============================================================
-- Tammie Care V2 — RLS Policies (PHASE 1)
-- รันหลัง 01_schema.sql · paste ทั้งไฟล์แล้วกด Run · รันซ้ำได้
-- =============================================================
--
-- หลักการ: สิทธิ์ทั้งหมดบังคับที่ฐานข้อมูล ไม่ใช่ที่ JavaScript
--   parent permission = view  → อ่านอย่างเดียว
--   parent permission = edit  → อ่าน + แก้ข้อมูลสัตว์
--   parent permission = admin → edit + จัดการสมาชิก/สิทธิ์/เพิ่ม-ลบสัตว์
--   vet                       → อ่านอย่างเดียว ไม่มี write policy ใด ๆ
--
-- ⚠️ เหตุผลที่ต้องใช้ security definer function:
--   ถ้าเขียน policy ของ family_members โดย select จาก family_members เอง
--   จะเกิด infinite recursion — Postgres จะ error ทันที
--   function แบบ security definer รันด้วยสิทธิ์เจ้าของ (ข้าม RLS) จึงตัดวงจรนั้น
--   ทุกตัวตั้ง search_path = public เพื่อกันการ hijack
-- =============================================================


-- -------------------------------------------------------------
-- Helper functions
-- -------------------------------------------------------------

-- ดูข้อมูลของครอบครัวนี้ได้ไหม (เป็น parent หรือ vet ที่ได้รับสิทธิ์)
create or replace function public.can_view_family(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_members where family_id = fid and user_id = auth.uid()
  ) or exists (
    select 1 from vet_access where family_id = fid and vet_user_id = auth.uid()
  );
$$;

-- แก้ข้อมูลสัตว์ของครอบครัวนี้ได้ไหม (parent ที่ edit หรือ admin เท่านั้น)
create or replace function public.can_edit_family(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_members
    where family_id = fid and user_id = auth.uid()
      and permission in ('edit','admin')
  );
$$;

-- เป็น admin ของครอบครัวนี้ไหม (จัดการสมาชิก/สิทธิ์/ลบสัตว์)
create or replace function public.is_family_admin(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_members
    where family_id = fid and user_id = auth.uid() and permission = 'admin'
  );
$$;

-- อยู่ครอบครัวเดียวกับ user คนนี้ไหม (ใช้ให้สมาชิกเห็นชื่อกันได้)
create or replace function public.shares_family_with(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from family_members me
    join family_members them on them.family_id = me.family_id
    where me.user_id = auth.uid() and them.user_id = uid
  );
$$;


-- -------------------------------------------------------------
-- profiles
--   อ่านได้: ตัวเอง / คนในครอบครัวเดียวกัน (ไว้โชว์ชื่อ เช่น "โดยแม่")
--   แก้ได้: เฉพาะ profile ตัวเอง · insert ทำโดย trigger ตอนสมัคร
-- -------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or shares_family_with(id));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());


-- -------------------------------------------------------------
-- families
--   อ่านได้: parent + vet ของครอบครัวนั้น
--   แก้ชื่อ: admin เท่านั้น
--   insert/delete: ไม่เปิดให้ client (สร้างครอบครัวใหม่ทำใน SQL editor
--   ด้วยสิทธิ์ service — ตามแผน Step "ใส่มือก่อน แล้วค่อยทำ invite flow")
-- -------------------------------------------------------------
drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select to authenticated
  using (can_view_family(id));

drop policy if exists families_update on public.families;
create policy families_update on public.families
  for update to authenticated
  using (is_family_admin(id)) with check (is_family_admin(id));


-- -------------------------------------------------------------
-- family_members
--   อ่าน: ทุกคนที่เห็นครอบครัวนี้ (parent + vet)
--   เพิ่ม/แก้/ลบ: admin เท่านั้น
-- -------------------------------------------------------------
drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members
  for select to authenticated
  using (can_view_family(family_id));

drop policy if exists family_members_insert on public.family_members;
create policy family_members_insert on public.family_members
  for insert to authenticated
  with check (is_family_admin(family_id));

drop policy if exists family_members_update on public.family_members;
create policy family_members_update on public.family_members
  for update to authenticated
  using (is_family_admin(family_id)) with check (is_family_admin(family_id));

drop policy if exists family_members_delete on public.family_members;
create policy family_members_delete on public.family_members
  for delete to authenticated
  using (is_family_admin(family_id));


-- -------------------------------------------------------------
-- vet_access
--   อ่าน: คนในครอบครัว + ตัวหมอเอง (หมอต้องรู้ว่าตัวเองเข้าถึงบ้านไหนได้)
--   ให้/ถอนสิทธิ์หมอ: admin เท่านั้น
-- -------------------------------------------------------------
drop policy if exists vet_access_select on public.vet_access;
create policy vet_access_select on public.vet_access
  for select to authenticated
  using (vet_user_id = auth.uid() or can_view_family(family_id));

drop policy if exists vet_access_insert on public.vet_access;
create policy vet_access_insert on public.vet_access
  for insert to authenticated
  with check (is_family_admin(family_id));

drop policy if exists vet_access_update on public.vet_access;
create policy vet_access_update on public.vet_access
  for update to authenticated
  using (is_family_admin(family_id)) with check (is_family_admin(family_id));

drop policy if exists vet_access_delete on public.vet_access;
create policy vet_access_delete on public.vet_access
  for delete to authenticated
  using (is_family_admin(family_id));


-- -------------------------------------------------------------
-- pets  ← หัวใจของระบบ
--   อ่าน: parent + vet ของครอบครัว · ตัวที่ archived เห็นเฉพาะคนที่แก้ได้
--   เพิ่ม/แก้: parent ที่ edit หรือ admin (vet เขียนไม่ได้เด็ดขาด)
--   ลบถาวร: admin เท่านั้น — แต่ UI ให้ใช้ soft delete (archived = true) แทน
--   with check ป้องกันการ "ย้ายสัตว์ข้ามครอบครัว" ตอน update ด้วย
-- -------------------------------------------------------------
drop policy if exists pets_select on public.pets;
create policy pets_select on public.pets
  for select to authenticated
  using (
    can_view_family(family_id)
    and (archived = false or can_edit_family(family_id))
  );

drop policy if exists pets_insert on public.pets;
create policy pets_insert on public.pets
  for insert to authenticated
  with check (can_edit_family(family_id));

drop policy if exists pets_update on public.pets;
create policy pets_update on public.pets
  for update to authenticated
  using (can_edit_family(family_id))
  with check (can_edit_family(family_id));

drop policy if exists pets_delete on public.pets;
create policy pets_delete on public.pets
  for delete to authenticated
  using (is_family_admin(family_id));


-- -------------------------------------------------------------
-- ปิดท้าย: ห้าม anon (คนไม่ล็อกอิน) แตะอะไรทั้งสิ้น
-- ทุก policy ข้างบนระบุ "to authenticated" อยู่แล้ว
-- บรรทัดล่างนี้เป็นการยืนยันซ้ำอีกชั้น
-- -------------------------------------------------------------
revoke all on public.families       from anon;
revoke all on public.profiles       from anon;
revoke all on public.family_members from anon;
revoke all on public.vet_access     from anon;
revoke all on public.pets           from anon;

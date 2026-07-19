-- =============================================================
-- Tammie Care V2 — ชุดทดสอบ Checkpoint Step 2
-- ต้องผ่านครบทั้ง 3 ข้อก่อนไปต่อ Step 3 (migrate ข้อมูลจริง)
-- =============================================================
--
-- ⚠️ ทำก่อนรันไฟล์นี้: สร้าง user ทดสอบ 3 คนใน Supabase Dashboard
--    (Authentication → Users → Add user → ติ๊ก Auto Confirm User)
--
--      1. parent1@test.com   → parent สิทธิ์ admin ของบ้าน "บ้านแทมมี่"
--      2. vet1@test.com      → สัตวแพทย์ (view เท่านั้น)
--      3. outsider@test.com  → คนนอก ไม่ได้อยู่บ้านไหนเลย
--
--    รหัสผ่านอะไรก็ได้ (เป็น user ทดสอบ ลบทิ้งทีหลัง)
--
-- =============================================================


-- =============================================================
-- ส่วนที่ 1 — SEED ข้อมูลทดสอบ
-- (SQL Editor รันด้วยสิทธิ์ service = ข้าม RLS จึง insert ได้ตรง ๆ)
-- =============================================================

-- สร้างครอบครัวทดสอบ + ผูกสมาชิก + ใส่สัตว์ 1 ตัว
with fam as (
  insert into public.families (name)
  values ('บ้านแทมมี่ (ทดสอบ)')
  returning id
),
p1 as (
  insert into public.family_members (family_id, user_id, permission)
  select fam.id, u.id, 'admin'
  from fam, auth.users u where u.email = 'parent1@test.com'
  returning family_id
),
v1 as (
  insert into public.vet_access (family_id, vet_user_id)
  select fam.id, u.id
  from fam, auth.users u where u.email = 'vet1@test.com'
  returning family_id
)
insert into public.pets (family_id, slug, name, data)
select fam.id, 'testpet', 'น้องทดสอบ',
       '{"profile":{"name":"น้องทดสอบ","species":"dog"},"meds":[]}'::jsonb
from fam;

-- ดูว่า seed เข้าครบไหม
select f.name as family, p.name as pet, p.slug
from public.families f join public.pets p on p.family_id = f.id;

select f.name as family, pr.email, fm.permission
from public.family_members fm
join public.families f on f.id = fm.family_id
join public.profiles pr on pr.id = fm.user_id;


-- =============================================================
-- ส่วนที่ 2 — ทดสอบ RLS โดย "สวมสิทธิ์" เป็น user แต่ละคน
--
-- วิธีนี้จำลอง JWT ของผู้ใช้จริงใน transaction เดียว แล้ว rollback
-- ทำให้ทดสอบ RLS ได้โดยไม่ต้องรอสร้าง frontend
--
-- ⚠️ ต้องรันทีละ block (ไฮไลต์แล้วกด Run) เพราะแต่ละ block เป็น transaction
--
-- ⚠️ ลำดับสำคัญมาก: ต้อง set request.jwt.claims (ซึ่งต้องอ่าน auth.users)
--    ให้เสร็จ "ก่อน" สลับ role เป็น authenticated
--    ถ้าสลับ role ก่อน จะอ่าน auth.users ไม่ได้ → ERROR 42501 permission denied
--    (และห้ามแก้ด้วยการ GRANT SELECT ON auth.users TO authenticated เด็ดขาด —
--     นั่นจะเปิดให้ผู้ใช้ทุกคนอ่านอีเมลของทุกคนในระบบ)
-- =============================================================


-- -------------------------------------------------------------
-- TEST 1 — parent (admin) ต้องอ่านได้ + เขียนได้
-- คาดหวัง: select เห็นน้องทดสอบ 1 แถว · update สำเร็จ
-- -------------------------------------------------------------
begin;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email='parent1@test.com'),
                      'role','authenticated')::text, true);
  select set_config('role', 'authenticated', true);   -- สลับ role ทีหลังเสมอ

  -- ควรเห็น 1 แถว
  select 'TEST1-select' as test, count(*) as rows_seen from public.pets;

  -- ควรสำเร็จ (updated 1 row)
  update public.pets set name = 'น้องทดสอบ (แก้โดย parent)' where slug = 'testpet';
  select 'TEST1-update' as test, count(*) as rows_updated
  from public.pets where name like '%แก้โดย parent%';
rollback;


-- -------------------------------------------------------------
-- TEST 2 — vet ต้องอ่านได้ แต่เขียนต้องไม่สำเร็จ
-- คาดหวัง: select เห็น 1 แถว · update ได้ 0 แถว (RLS กรองออก ไม่ใช่ error)
--          insert ต้อง ERROR: new row violates row-level security policy
-- -------------------------------------------------------------
begin;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email='vet1@test.com'),
                      'role','authenticated')::text, true);
  select set_config('role', 'authenticated', true);

  -- ควรเห็น 1 แถว (หมออ่านได้)
  select 'TEST2-select' as test, count(*) as rows_seen from public.pets;

  -- ควรได้ 0 แถว ← ถ้าได้ 1 คือ RLS พัง หยุดทันที
  update public.pets set name = 'หมอแอบแก้' where slug = 'testpet';
  select 'TEST2-update-blocked' as test, count(*) as should_be_zero
  from public.pets where name = 'หมอแอบแก้';
rollback;

-- vet insert ต้อง ERROR (รันแยก เพราะ error จะตัด transaction)
begin;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email='vet1@test.com'),
                      'role','authenticated')::text, true);
  select set_config('role', 'authenticated', true);

  -- ✅ บรรทัดนี้ "ต้อง" ขึ้น error — ถ้ารันผ่านคือ RLS พัง
  insert into public.pets (family_id, name)
  select id, 'หมอแอบเพิ่ม' from public.families limit 1;
rollback;


-- -------------------------------------------------------------
-- TEST 3 — คนนอกต้องไม่เห็นอะไรเลย
-- คาดหวัง: ทุก count = 0
-- -------------------------------------------------------------
begin;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email='outsider@test.com'),
                      'role','authenticated')::text, true);
  select set_config('role', 'authenticated', true);

  select 'TEST3-pets'     as test, count(*) as should_be_zero from public.pets;
  select 'TEST3-families' as test, count(*) as should_be_zero from public.families;
  select 'TEST3-members'  as test, count(*) as should_be_zero from public.family_members;
rollback;


-- -------------------------------------------------------------
-- TEST 4 — parent สิทธิ์ view ต้องอ่านได้แต่เขียนไม่ได้
-- (ลดสิทธิ์ parent1 เป็น view ชั่วคราวใน transaction แล้ว rollback)
-- คาดหวัง: select เห็น 1 · update ได้ 0 แถว
-- -------------------------------------------------------------
begin;
  update public.family_members set permission = 'view'
  where user_id = (select id from auth.users where email='parent1@test.com');

  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email='parent1@test.com'),
                      'role','authenticated')::text, true);
  select set_config('role', 'authenticated', true);

  select 'TEST4-select' as test, count(*) as rows_seen from public.pets;

  update public.pets set name = 'view แอบแก้' where slug = 'testpet';
  select 'TEST4-update-blocked' as test, count(*) as should_be_zero
  from public.pets where name = 'view แอบแก้';
rollback;


-- =============================================================
-- สรุปเกณฑ์ผ่าน (ต้องครบทุกข้อ)
--   TEST1: select = 1, update = 1        ✅ parent edit/admin ทำงานได้
--   TEST2: select = 1, update = 0, insert ERROR   ✅ vet อ่านอย่างเดียวจริง
--   TEST3: ทุกค่า = 0                    ✅ คนนอกมองไม่เห็นอะไรเลย
--   TEST4: select = 1, update = 0        ✅ ระดับ view แยกจาก edit จริง
--
-- ไม่ผ่านข้อใดข้อหนึ่ง = ห้ามไป Step 3 (migrate ข้อมูลจริง)
-- นี่คือรากฐานของทั้งระบบ ตามที่ระบุไว้ในแผน
-- =============================================================


-- =============================================================
-- ล้างข้อมูลทดสอบ (รันเมื่อผ่านครบแล้ว ก่อน migrate ของจริง)
-- =============================================================
-- delete from public.families where name = 'บ้านแทมมี่ (ทดสอบ)';
--   ↑ ลบครอบครัว = ลบ pets/members/vet_access ตาม (on delete cascade)
--   ส่วน user ทดสอบลบใน Dashboard → Authentication → Users

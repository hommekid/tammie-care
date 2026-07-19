-- =============================================================
-- Tammie Care V2 — สร้างครอบครัวจริง + ผูกบัญชีจริงเป็น admin
-- รันหลังจาก: ล้างข้อมูลทดสอบ + สร้างบัญชีจริงใน Authentication แล้ว
-- =============================================================


-- -------------------------------------------------------------
-- 0) ล้างข้อมูลทดสอบ (ถ้ายังไม่ได้ทำ)
--    ⚠️ cascade → ลบ pets / family_members / vet_access ของบ้านทดสอบทั้งหมด
--    ปลอดภัยเพราะยังไม่มีข้อมูลจริงในระบบ
-- -------------------------------------------------------------
delete from public.families where name = 'บ้านแทมมี่ (ทดสอบ)';

-- user ทดสอบลบใน Dashboard → Authentication → Users (⋯ ท้ายแถว → Delete user)
-- ลบ user แล้ว profiles จะหายตาม (on delete cascade)

-- ตรวจว่าว่างจริง — ควรได้ 0 ทั้งคู่
select 'families' as tbl, count(*) from public.families
union all
select 'pets', count(*) from public.pets;


-- -------------------------------------------------------------
-- 1) สร้างครอบครัวจริง + ผูกบัญชีจริงเป็น admin
--    ⚠️ ต้องสร้าง hommekidgo@gmail.com ใน Authentication → Users ก่อน
--    (ติ๊ก Auto Confirm User)
-- -------------------------------------------------------------
with fam as (
  insert into public.families (name)
  values ('บ้านแทมมี่')
  returning id
)
insert into public.family_members (family_id, user_id, role, permission)
select fam.id, u.id, 'parent', 'admin'
from fam, auth.users u
where u.email = 'hommekidgo@gmail.com';


-- -------------------------------------------------------------
-- 2) ยืนยันผล — ต้องได้ 1 แถว: บ้านแทมมี่ / hommekidgo@gmail.com / admin
--    ถ้าได้ 0 แถว = ยังไม่ได้สร้างบัญชีใน Authentication (ไปสร้างก่อน แล้วรันข้อ 1 ใหม่)
-- -------------------------------------------------------------
select f.id as family_id, f.name as family, pr.email, fm.permission
from public.family_members fm
join public.families f  on f.id  = fm.family_id
join public.profiles pr on pr.id = fm.user_id;

-- 📌 เก็บค่า family_id ที่ได้ไว้ — script migrate ต้องใช้

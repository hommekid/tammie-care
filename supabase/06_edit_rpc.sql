-- =============================================================
-- Tammie Care V2 — ฟังก์ชันสำหรับแก้ข้อมูลจากหน้าเว็บ (Step 5)
-- รันใน SQL Editor · รันซ้ำได้
-- =============================================================
--
-- ทำไมต้องมีฟังก์ชันนี้ แทนที่จะให้ frontend ส่ง data ทั้งก้อนกลับมา:
--   pets.data เป็น jsonb ก้อนเดียวที่รวมทุกหมวด (ยา/ผลเลือด/อาการ/...)
--   ถ้าแม่เปิดหน้าเว็บไว้ตอน 9 โมง แล้วพ่อบันทึกอาการตอน 10 โมง
--   พอแม่กดบันทึกยาตอน 11 โมงโดยส่งก้อนเต็มที่โหลดไว้ตั้งแต่ 9 โมง
--   → บันทึกของพ่อจะหายไปเงียบ ๆ
--   ฟังก์ชันนี้แก้เฉพาะ "เส้นทาง" ที่ระบุ (เช่น symptoms → diarrhea)
--   ส่วนอื่นในก้อนเดียวกันไม่ถูกแตะเลย
--
-- ⚠️ ต้องเป็น SECURITY INVOKER (ค่าเริ่มต้น) ห้ามใส่ SECURITY DEFINER
--    เพราะต้องให้ RLS ตรวจสิทธิ์ตามผู้ใช้ที่เรียกจริง ๆ
--    ถ้าใส่ DEFINER = ใครก็แก้ข้อมูลบ้านคนอื่นได้ผ่านฟังก์ชันนี้
-- =============================================================

create or replace function public.set_pet_path(
  p_pet_id uuid,
  p_path   text[],      -- เช่น ARRAY['symptoms','diarrhea']
  p_value  jsonb        -- ค่าใหม่ของเส้นทางนั้น (ทั้งอาร์เรย์)
)
returns jsonb
language plpgsql
as $$
declare
  cur jsonb;
  i   int;
  sub text[];
begin
  -- อ่านค่าปัจจุบัน (RLS กรองแล้ว — ไม่มีสิทธิ์ดู = ไม่เจอ)
  select coalesce(data, '{}'::jsonb) into cur from public.pets where id = p_pet_id;
  if cur is null then
    raise exception 'ไม่พบสัตว์เลี้ยง หรือไม่มีสิทธิ์เข้าถึง';
  end if;

  -- สร้าง object ระดับกลางที่ยังไม่มี (jsonb_set จะไม่ทำงานถ้า parent ไม่มีอยู่จริง)
  -- เช่นโปรไฟล์ที่ยังไม่เคยมี symptoms เลย
  if array_length(p_path, 1) > 1 then
    for i in 1 .. array_length(p_path, 1) - 1 loop
      sub := p_path[1:i];
      if cur #> sub is null then
        cur := jsonb_set(cur, sub, '{}'::jsonb, true);
      end if;
    end loop;
  end if;

  cur := jsonb_set(cur, p_path, p_value, true);

  -- RLS ตรวจอีกชั้นตอนเขียน: สิทธิ์ view หรือ vet จะไม่เข้าเงื่อนไข → not found
  update public.pets set data = cur where id = p_pet_id;
  if not found then
    raise exception 'บันทึกไม่สำเร็จ — คุณไม่มีสิทธิ์แก้ข้อมูลของสัตว์ตัวนี้';
  end if;

  return cur;
end;
$$;

-- ให้ผู้ใช้ที่ล็อกอินเรียกได้ (สิทธิ์จริงยังถูกคุมด้วย RLS ข้างใน)
revoke all on function public.set_pet_path(uuid, text[], jsonb) from public, anon;
grant execute on function public.set_pet_path(uuid, text[], jsonb) to authenticated;


-- =============================================================
-- ทดสอบ (ไม่บังคับ) — ยืนยันว่าสิทธิ์ยังถูกบังคับผ่านฟังก์ชันนี้
-- ⚠️ ต้อง set jwt claims ก่อน set role เสมอ (เหมือนไฟล์ 03)
-- =============================================================
-- begin;
--   select set_config('request.jwt.claims',
--     json_build_object('sub', (select id from auth.users where email='hommekidgo@gmail.com'),
--                       'role','authenticated')::text, true);
--   select set_config('role', 'authenticated', true);
--
--   -- ควรสำเร็จ: เขียน key ทดสอบแล้ว rollback ทิ้ง
--   select jsonb_pretty(public.set_pet_path(
--     (select id from public.pets where slug='frappe'),
--     ARRAY['__test'], '"ok"'::jsonb) -> '__test');
-- rollback;

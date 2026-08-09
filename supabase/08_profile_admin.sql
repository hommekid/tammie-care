-- =============================================================
-- Tammie Care V2 — โปรไฟล์สัตว์ = admin เท่านั้น
-- รันใน SQL Editor · รันซ้ำได้
-- =============================================================
--
-- โจทย์: การเพิ่ม/ลด/แก้โปรไฟล์สัตว์ ให้เฉพาะ admin
--   - โปรไฟล์ (card) อยู่ใน pets.data ก้อนเดียวกับข้อมูลอื่น
--   - edit เขียน data ได้ผ่าน set_pet_path อยู่แล้ว → ต้องกันเฉพาะ path 'card'
--   บังคับ 2 ชั้น:
--     1) set_pet_path ปฏิเสธการเขียน path[1] = 'card' ถ้าไม่ใช่ admin
--     2) set_pet_profile = RPC เดียวที่เขียน card ได้ (เช็ก admin ในตัว)
--   - เพิ่มสัตว์ (create_pet) เปลี่ยนเป็น admin เท่านั้น
-- =============================================================


-- -------------------------------------------------------------
-- อัปเดต set_pet_path: กันการเขียน 'card' โดยคนที่ไม่ใช่ admin
-- (ยังเป็น SECURITY INVOKER — RLS ตรวจสิทธิ์ทั่วไปตามเดิม)
-- -------------------------------------------------------------
create or replace function public.set_pet_path(
  p_pet_id uuid, p_path text[], p_value jsonb
)
returns jsonb
language plpgsql
as $$
declare
  cur jsonb; i int; sub text[]; fid uuid;
begin
  select coalesce(data, '{}'::jsonb), family_id into cur, fid from public.pets where id = p_pet_id;
  if cur is null then
    raise exception 'ไม่พบสัตว์เลี้ยง หรือไม่มีสิทธิ์เข้าถึง';
  end if;

  -- โปรไฟล์ (card) แก้ได้เฉพาะ admin
  if p_path[1] = 'card' and not is_family_admin(fid) then
    raise exception 'เฉพาะแอดมินของครอบครัวเท่านั้นที่แก้โปรไฟล์สัตว์ได้';
  end if;

  if array_length(p_path, 1) > 1 then
    for i in 1 .. array_length(p_path, 1) - 1 loop
      sub := p_path[1:i];
      if cur #> sub is null then cur := jsonb_set(cur, sub, '{}'::jsonb, true); end if;
    end loop;
  end if;

  cur := jsonb_set(cur, p_path, p_value, true);
  update public.pets set data = cur where id = p_pet_id;
  if not found then
    raise exception 'บันทึกไม่สำเร็จ — คุณไม่มีสิทธิ์แก้ข้อมูลของสัตว์ตัวนี้';
  end if;
  return cur;
end;
$$;


-- -------------------------------------------------------------
-- set_pet_profile — เขียน card + name พร้อมกัน (admin เท่านั้น)
-- security definer + เช็ก is_family_admin เอง
-- -------------------------------------------------------------
create or replace function public.set_pet_profile(p_pet_id uuid, p_card jsonb, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fid uuid; newdata jsonb;
begin
  select family_id into fid from pets where id = p_pet_id;
  if fid is null then raise exception 'ไม่พบสัตว์เลี้ยง'; end if;
  if not is_family_admin(fid) then
    raise exception 'เฉพาะแอดมินของครอบครัวเท่านั้นที่แก้โปรไฟล์สัตว์ได้';
  end if;

  update pets
    set data = jsonb_set(coalesce(data, '{}'::jsonb), '{card}', p_card, true),
        name = coalesce(nullif(trim(p_name), ''), name)
    where id = p_pet_id
    returning data into newdata;
  return newdata;
end;
$$;


-- -------------------------------------------------------------
-- create_pet: เปลี่ยนจาก can_edit_family → is_family_admin
-- -------------------------------------------------------------
create or replace function public.create_pet(fid uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not is_family_admin(fid) then raise exception 'เฉพาะแอดมินของครอบครัวเท่านั้นที่เพิ่มสัตว์ได้'; end if;
  insert into pets (family_id, name, data, sort_order)
  values (fid, coalesce(nullif(trim(p_name), ''), 'น้องใหม่'), '{}'::jsonb,
          coalesce((select max(sort_order) + 1 from pets where family_id = fid), 0))
  returning id into new_id;
  return new_id;
end;
$$;


-- สิทธิ์เรียก
revoke all on function public.set_pet_profile(uuid, jsonb, text) from public, anon;
grant execute on function public.set_pet_profile(uuid, jsonb, text) to authenticated;

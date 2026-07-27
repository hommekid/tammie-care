-- =============================================================
-- Tammie Care V2 — RPC จัดการครอบครัว (Step "หน้าจัดการครอบครัว")
-- รันใน SQL Editor · รันซ้ำได้
-- =============================================================
--
-- ทำไมต้องเป็น RPC:
--   - การเพิ่มคนด้วยอีเมลต้องค้น auth.users ซึ่ง client (authenticated) อ่านไม่ได้
--   - การโชว์อีเมลของหมอ (vet) ก็อ่านจาก profiles ตรง ๆ ไม่ได้ (RLS ไม่ครอบ)
--   → ใช้ security definer ที่ "เช็กก่อนเสมอว่าผู้เรียกเป็น admin ของครอบครัวนั้น"
--     ถ้าไม่ใช่ → raise exception ทันที
--
-- ⚠️ ทุกฟังก์ชันตั้ง search_path = public, auth เพื่อกัน hijack
-- =============================================================


-- -------------------------------------------------------------
-- ภาพรวมครอบครัว — สมาชิก (parent) + หมอ (vet) พร้อมอีเมล/ชื่อ
-- ใครก็ตามที่เป็นสมาชิกครอบครัวเรียกดูได้ (ไว้โชว์ในหน้าจัดการ)
-- -------------------------------------------------------------
create or replace function public.family_overview(fid uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare result jsonb;
begin
  if not can_view_family(fid) then
    raise exception 'ไม่มีสิทธิ์ดูข้อมูลครอบครัวนี้';
  end if;

  select jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', fm.user_id, 'email', p.email, 'name', p.name, 'permission', fm.permission
      ) order by fm.permission desc, p.email)
      from family_members fm join profiles p on p.id = fm.user_id
      where fm.family_id = fid), '[]'::jsonb),
    'vets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', va.vet_user_id, 'email', p.email, 'name', p.name
      ) order by p.email)
      from vet_access va join profiles p on p.id = va.vet_user_id
      where va.family_id = fid), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;


-- -------------------------------------------------------------
-- หา user_id จากอีเมล (ต้องสมัครไว้ก่อน) — ใช้ภายใน
-- -------------------------------------------------------------
create or replace function public.uid_by_email(p_email text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;


-- -------------------------------------------------------------
-- เพิ่ม parent เข้าครอบครัวด้วยอีเมล (admin เท่านั้น)
-- -------------------------------------------------------------
create or replace function public.add_member_by_email(fid uuid, p_email text, p_permission text default 'view')
returns text language plpgsql security definer set search_path = public, auth as $$
declare target uuid;
begin
  if not is_family_admin(fid) then raise exception 'เฉพาะแอดมินของครอบครัวเท่านั้น'; end if;
  if p_permission not in ('view','edit','admin') then raise exception 'ระดับสิทธิ์ไม่ถูกต้อง'; end if;

  target := uid_by_email(p_email);
  if target is null then
    raise exception 'ยังไม่มีบัญชีอีเมลนี้ — ให้เขาสมัครเข้าระบบก่อน แล้วค่อยเพิ่ม';
  end if;

  insert into family_members (family_id, user_id, role, permission)
  values (fid, target, 'parent', p_permission)
  on conflict (family_id, user_id) do update set permission = excluded.permission;

  return 'ok';
end;
$$;


-- -------------------------------------------------------------
-- ให้สิทธิ์ vet ดูข้อมูลครอบครัว ด้วยอีเมล (admin เท่านั้น)
-- -------------------------------------------------------------
create or replace function public.add_vet_by_email(fid uuid, p_email text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare target uuid;
begin
  if not is_family_admin(fid) then raise exception 'เฉพาะแอดมินของครอบครัวเท่านั้น'; end if;

  target := uid_by_email(p_email);
  if target is null then
    raise exception 'ยังไม่มีบัญชีอีเมลนี้ — ให้สัตวแพทย์สมัครเข้าระบบก่อน';
  end if;

  insert into vet_access (family_id, vet_user_id, permission)
  values (fid, target, 'view')
  on conflict (family_id, vet_user_id) do nothing;

  return 'ok';
end;
$$;


-- -------------------------------------------------------------
-- เปลี่ยนระดับสิทธิ์ของสมาชิก (admin เท่านั้น)
-- กันไม่ให้ถอด admin คนสุดท้ายของครอบครัว (ไม่งั้นจะไม่เหลือใครจัดการ)
-- -------------------------------------------------------------
create or replace function public.set_member_permission(fid uuid, p_user uuid, p_permission text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not is_family_admin(fid) then raise exception 'เฉพาะแอดมินของครอบครัวเท่านั้น'; end if;
  if p_permission not in ('view','edit','admin') then raise exception 'ระดับสิทธิ์ไม่ถูกต้อง'; end if;

  if p_permission <> 'admin' then
    if (select count(*) from family_members where family_id = fid and permission = 'admin') <= 1
       and exists (select 1 from family_members where family_id = fid and user_id = p_user and permission = 'admin') then
      raise exception 'ต้องมีแอดมินอย่างน้อย 1 คน — ตั้งคนอื่นเป็นแอดมินก่อนถึงจะลดสิทธิ์คนนี้ได้';
    end if;
  end if;

  update family_members set permission = p_permission where family_id = fid and user_id = p_user;
  return 'ok';
end;
$$;


-- -------------------------------------------------------------
-- ถอดสมาชิก / ถอนสิทธิ์หมอ (admin เท่านั้น)
-- -------------------------------------------------------------
create or replace function public.remove_member(fid uuid, p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not is_family_admin(fid) then raise exception 'เฉพาะแอดมินของครอบครัวเท่านั้น'; end if;
  if (select count(*) from family_members where family_id = fid and permission = 'admin') <= 1
     and exists (select 1 from family_members where family_id = fid and user_id = p_user and permission = 'admin') then
    raise exception 'ถอดแอดมินคนสุดท้ายไม่ได้';
  end if;
  delete from family_members where family_id = fid and user_id = p_user;
  return 'ok';
end;
$$;

create or replace function public.remove_vet(fid uuid, p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not is_family_admin(fid) then raise exception 'เฉพาะแอดมินของครอบครัวเท่านั้น'; end if;
  delete from vet_access where family_id = fid and vet_user_id = p_user;
  return 'ok';
end;
$$;


-- -------------------------------------------------------------
-- สร้างสัตว์ใหม่ (edit/admin) — คืน id
-- (การแก้ข้อมูล/archive ทำผ่าน pets policy เดิมได้เลย ไม่ต้องมี RPC)
-- -------------------------------------------------------------
create or replace function public.create_pet(fid uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not can_edit_family(fid) then raise exception 'ไม่มีสิทธิ์เพิ่มสัตว์ในครอบครัวนี้'; end if;
  insert into pets (family_id, name, data, sort_order)
  values (fid, coalesce(nullif(trim(p_name), ''), 'น้องใหม่'), '{}'::jsonb,
          coalesce((select max(sort_order) + 1 from pets where family_id = fid), 0))
  returning id into new_id;
  return new_id;
end;
$$;


-- -------------------------------------------------------------
-- สิทธิ์เรียก: authenticated เท่านั้น (ข้างในเช็ก admin อีกชั้น)
-- -------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'family_overview(uuid)', 'add_member_by_email(uuid,text,text)', 'add_vet_by_email(uuid,text)',
    'set_member_permission(uuid,uuid,text)', 'remove_member(uuid,uuid)', 'remove_vet(uuid,uuid)',
    'create_pet(uuid,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon;', fn);
    execute format('grant execute on function public.%s to authenticated;', fn);
  end loop;
end $$;
-- uid_by_email เป็น helper ภายใน — ไม่ grant ให้ client เรียกตรง
revoke all on function public.uid_by_email(text) from public, anon, authenticated;

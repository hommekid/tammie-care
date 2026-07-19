-- =============================================================
-- Tammie Care V2 — Schema (PHASE 1)
-- รันใน Supabase SQL Editor: paste ทั้งไฟล์แล้วกด Run
-- รันซ้ำได้ (idempotent) — ใช้ if not exists / or replace ทั้งหมด
-- =============================================================

-- ตาราง Phase 2 (task_templates / task_completions) และ Phase 3 (pet_game_config)
-- ยังไม่สร้างในไฟล์นี้ตามแผน — ทำหลัง Phase 1 นิ่งใน production

-- -------------------------------------------------------------
-- 1) families — 1 แถว = 1 ครอบครัว
-- -------------------------------------------------------------
create table if not exists public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 2) profiles — ข้อมูลผู้ใช้ (id ผูกกับ auth.users)
--    ลบ user ใน Auth = ลบ profile ตาม (cascade)
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 3) family_members — ผูก parent เข้าครอบครัว + ระดับสิทธิ์
--    1 คนอยู่ได้หลายครอบครัว แต่ 1 ครอบครัวมีได้แถวเดียวต่อคน
-- -------------------------------------------------------------
create table if not exists public.family_members (
  family_id  uuid not null references public.families(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'parent' check (role = 'parent'),
  permission text not null default 'view'   check (permission in ('view','edit','admin')),
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index if not exists family_members_user_idx on public.family_members(user_id);

-- -------------------------------------------------------------
-- 4) vet_access — ให้สัตวแพทย์อ่านข้อมูลของครอบครัวได้ (view เท่านั้น)
-- -------------------------------------------------------------
create table if not exists public.vet_access (
  family_id   uuid not null references public.families(id) on delete cascade,
  vet_user_id uuid not null references public.profiles(id) on delete cascade,
  permission  text not null default 'view' check (permission = 'view'),
  created_at  timestamptz not null default now(),
  primary key (family_id, vet_user_id)
);

create index if not exists vet_access_user_idx on public.vet_access(vet_user_id);

-- -------------------------------------------------------------
-- 5) pets — โปรไฟล์ + ข้อมูลสุขภาพทั้งหมด
--    data (jsonb) = โครง data/<id>.json เดิมทั้งก้อน ไม่แปลงรูป
--    slug = id เดิมใน V1 ('frappe' / 'wafer') เก็บไว้ให้ลิงก์เก่ายังอ้างอิงได้
--    archived = soft delete (ลบแล้วกู้คืนได้ตามแผน Step 5)
-- -------------------------------------------------------------
create table if not exists public.pets (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  slug       text,
  name       text not null,
  data       jsonb not null default '{}'::jsonb,
  sort_order int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pets_family_idx on public.pets(family_id);
create unique index if not exists pets_family_slug_uniq
  on public.pets(family_id, slug) where slug is not null;

-- ค้นใน jsonb ได้เร็วขึ้น (เผื่ออนาคตอยาก query ทะลุเข้าไปใน data)
create index if not exists pets_data_gin on public.pets using gin (data jsonb_path_ops);

-- -------------------------------------------------------------
-- Trigger: อัปเดต updated_at อัตโนมัติทุกครั้งที่แก้ pets
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pets_set_updated_at on public.pets;
create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- Trigger: สมัครสมาชิกใหม่ใน Auth → สร้างแถวใน profiles ให้อัตโนมัติ
-- (ถ้าไม่มีตัวนี้ ต้องมานั่งสร้าง profile เองทุกคน)
-- -------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- เปิด RLS ทุกตาราง (ยังไม่มี policy = ห้ามหมด ซึ่งถูกต้อง)
-- policy อยู่ใน 02_rls.sql — ต้องรันไฟล์นั้นต่อ
-- -------------------------------------------------------------
alter table public.families       enable row level security;
alter table public.profiles       enable row level security;
alter table public.family_members enable row level security;
alter table public.vet_access     enable row level security;
alter table public.pets           enable row level security;

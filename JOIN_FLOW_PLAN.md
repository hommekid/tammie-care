# 🔎 แผน: ระบบขอเข้าครอบครัว + เชิญเข้าครอบครัว

> **สถานะ: 📝 แผน — ยังไม่เริ่มลงมือ** (วางแผน 12 ส.ค. 2026) · branch `v2-multiuser`
> แตกรายละเอียดจากหัวข้อ "🔎 ระบบขอเข้าครอบครัว + ตั้งชื่อครอบครัว" ใน `TAMMIE_CARE_V2_PLAN.md`
> อ่านคู่กับ `NOTES_gotchas.md` ก่อนลงมือเสมอ

---

## 1. เป้าหมาย

**หลักการเดียวที่คุมทั้งระบบ: ไม่ว่าใครเริ่ม อีกฝ่ายต้องกดยืนยันเสมอ**

| ใครเริ่ม | ทางเข้า | ใครกดยืนยัน |
|---|---|---|
| ผู้ใช้ (parent / สัตวแพทย์) | ค้นหาครอบครัว → กดขอเข้า | **admin ของครอบครัวนั้น** approve |
| admin | เพิ่มด้วยอีเมล (แบบปัจจุบัน) | **ผู้ถูกเชิญ** กดยอมรับ |

กันได้ 2 อย่างพร้อมกัน: คนแอบขอเข้าโดยไม่มีใครอนุมัติ · คนถูกลากเข้าครอบครัวโดยไม่รู้ตัว

**ข้อจำกัดความเป็นส่วนตัว:** ค้นหาครอบครัวได้ = คนนอกเห็นได้แค่ **ชื่อครอบครัว** เท่านั้น
ห้ามเห็นสัตว์ / สมาชิก / อีเมลใคร จนกว่าจะถูก approve

---

## 2. การตัดสินใจที่เคาะแล้ว

| เรื่อง | เคาะเป็น | เหตุผล |
|---|---|---|
| วิธีให้คนนอกหาครอบครัวเจอ | **มีทั้ง 2 ทาง** — ค้นด้วยชื่อ + รหัสครอบครัว 6 หลัก | ครอบครัวที่ห่วงความเป็นส่วนตัวปิดการค้นด้วยชื่อได้ (`discoverable = false`) แล้วแจกรหัสแทน |
| ที่อยู่ของ UI คำเชิญ/คำขอ | **หน้า `join.html` แยก** + แบนเนอร์เตือนบน `index.html` | `index.html` ติด `?v=` ไม่ได้ (entry point) — ยัดของใหญ่เข้าไปแล้วเจอปัญหาแคชค้างแน่ (NOTES ข้อ 1) |
| 1 บัญชี อยู่กี่ครอบครัว | **คงไว้ 1 ครอบครัวก่อน** | รอบนี้โฟกัสที่ flow ขอ/เชิญ · schema เผื่อไว้ให้รองรับหลายครอบครัวทีหลังได้ ไม่ต้องรื้อ |
| เชิญอีเมลที่ยังไม่มีบัญชี | **ยังไม่รองรับ** — ใช้ปุ่ม "คัดลอกลิงก์เชิญ" แทน | แบบเต็มต้องเก็บ `invited_email` + แก้ trigger `handle_new_user` ให้ผูกคำเชิญตอนสมัคร — ซับซ้อนเกินความจำเป็นรอบแรก |
| admin เห็นอีเมลคนที่ขอเข้าไหม | **เห็นเต็ม** + บังคับผู้ขอใส่ข้อความแนะนำตัว | คนขอเป็นฝ่ายเริ่มเอง = ยินยอมโดยปริยาย · admin ต้องมีข้อมูลพอจะยืนยันตัวตนก่อนกด approve |
| คนขอเลือกสิทธิ์ตัวเองได้ไหม | **ไม่ได้** — บังคับ `view` ตอนขอ | admin เป็นคนตั้งระดับสิทธิ์ตอน approve เท่านั้น |

---

## 3. Schema — `supabase/09_join_requests.sql` (ไฟล์ใหม่ ไม่แตะ `01`/`02`)

### 3.1 เพิ่มคอลัมน์ใน `families`

- `join_code text unique` — 6 ตัว จากชุด `A-Z2-9` (ตัด `O 0 I 1` ที่อ่านสับสน) · backfill ให้ครอบครัวที่มีอยู่แล้ว
- `discoverable boolean not null default true` — ค้นด้วยชื่อเจอไหม (ปิดแล้วยังเข้าด้วยรหัสได้)

### 3.2 ตารางใหม่ `join_requests`

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | uuid pk | |
| `family_id` | uuid → families | on delete cascade |
| `user_id` | uuid → profiles | คนที่จะเข้าครอบครัว |
| `role_requested` | text | `parent` / `vet` |
| `permission` | text | `view`/`edit`/`admin` — ใช้ตอน approve · คำขอจาก user บังคับเป็น `view` |
| `requested_by` | uuid → profiles | **ใครกดสร้างรายการนี้** |
| `direction` | text **generated** | `requested_by = user_id → 'request'` ไม่งั้น `'invite'` |
| `status` | text | `pending` / `approved` / `rejected` / `cancelled` |
| `message` | text | ข้อความแนะนำตัวจากผู้ขอ |
| `decided_by`, `decided_at` | uuid / timestamptz | ใครกดตัดสิน เมื่อไหร่ |
| `created_at` | timestamptz | |

- `direction` เป็น **generated column** ไม่ใช่คอลัมน์ธรรมดา — คำนวณจาก `requested_by` เสมอ กันสถานะเพี้ยนจากการเขียนผิด
- **unique partial index** `(family_id, user_id) where status = 'pending'` — กันคำขอซ้ำ/สแปม

### 3.3 RLS ของ `join_requests`

- `select` — `user_id = auth.uid()` **หรือ** `is_family_admin(family_id)`
- `insert` / `update` / `delete` — **ไม่มี policy เลย** → เขียนได้ทางเดียวคือผ่าน RPC security definer
- `revoke all ... from anon`
- **ไม่แก้ `families_select`** — คนนอกยังอ่านตาราง `families` ตรงไม่ได้ · การค้นหาไปผ่าน RPC เท่านั้น จึงเห็นได้แค่ `{id, name}`

---

## 4. RPC (ทุกตัว `security definer` + `set search_path = public, auth` + grant เฉพาะ `authenticated`)

### ค้นหา

1. `search_families(q text)` — ต้อง **≥3 ตัวอักษร** · เฉพาะ `discoverable = true` · `limit 10` · คืนแค่ `id + name`
2. `lookup_family_by_code(p_code text)` — exact match ไม่สน `discoverable` (รหัส = capability)

### ผู้ใช้ขอเข้า

3. `request_join(fid, p_role, p_message)` — ผู้ขอ = `auth.uid()` เสมอ (ส่ง user_id เข้ามาไม่ได้)
   guard: ยังไม่เป็นสมาชิก/vet ของครอบครัวนี้ · ยังไม่มีครอบครัวใด (Phase 1 = 1 ครอบครัว) · ไม่มี pending ค้าง · **ถูกปฏิเสธจากครอบครัวนี้ภายใน 24 ชม. ขอซ้ำไม่ได้** · pending รวมไม่เกิน 3 · **บังคับ `permission = 'view'`**

### admin เชิญ

4. `invite_member_by_email(fid, p_email, p_role, p_permission)` — admin เท่านั้น · สร้าง `join_requests` แถวใหม่ (ไม่ใช่ insert เข้าครอบครัวตรง)
   - ⚠️ **ต้องเปลี่ยนพฤติกรรมของ `add_member_by_email` / `add_vet_by_email` เดิมให้สร้างคำเชิญแทนการ insert ตรง** — ไม่งั้นเส้นทางเก่ายังลากคนเข้าครอบครัวได้โดยไม่ยินยอม (นี่คือช่องที่ต้องปิดให้ได้)
   - ยังคงข้อจำกัดเดิม: อีเมลนั้นต้องมีบัญชีในระบบแล้ว

### ตอบคำขอ/คำเชิญ — ตัวเดียวจบ

5. `respond_join_request(p_id, p_accept, p_permission default null)` — เช็กสิทธิ์ตาม `direction` **ใน DB**
   - `direction = 'request'` → ผู้ตอบต้องเป็น **admin ของครอบครัวนั้น** (ตั้ง `permission` ตอน approve ได้)
   - `direction = 'invite'` → ผู้ตอบต้องเป็น **`user_id` เอง** และใช้ `permission` ที่ admin ตั้งไว้ (**ห้ามยกระดับสิทธิ์ตัวเอง**)
   - approve → insert `family_members` (parent) หรือ `vet_access` (vet) + ปิด `status` ใน transaction เดียว
6. `cancel_join_request(p_id)` — ผู้เริ่มถอนเอง (user ถอนคำขอ · admin ถอนคำเชิญ) → `status = 'cancelled'`

### อ่านรายการ

7. `my_join_requests()` — คำเชิญ + คำขอของฉัน พร้อมชื่อครอบครัว
8. `family_join_requests(fid)` — admin ดู pending ของครอบครัว พร้อมชื่อ/อีเมล/ข้อความของผู้ขอ

### ตั้งค่าครอบครัว

9. `regenerate_join_code(fid)` — admin สร้างรหัสใหม่ (รหัสเก่าใช้ไม่ได้ทันที)
10. `set_family_discoverable(fid, p_on boolean)` — admin เปิด/ปิดการค้นด้วยชื่อ

---

## 5. Frontend

### 5.1 `app/join.html` — ไฟล์ใหม่

3 ส่วนในหน้าเดียว:

1. **คำเชิญ/คำขอค้างของฉัน** — ยอมรับ / ปฏิเสธ / ยกเลิก
2. **ค้นหาครอบครัว** — ช่องชื่อ + ช่องรหัส → ผลลัพธ์แสดง **ชื่อครอบครัวอย่างเดียว** → เลือกบทบาท (ผู้ปกครอง / สัตวแพทย์) + ใส่ข้อความแนะนำตัว → ส่งคำขอ
3. **สถานะคำขอที่ส่งไปแล้ว** — รออนุมัติ / ถูกปฏิเสธ / ยกเลิกเอง

### 5.2 `app/family.html` (admin)

- การ์ดใหม่ **"📥 คำขอเข้าครอบครัว (n)"** — โชว์ชื่อ/อีเมล/ข้อความ → approve (เลือกสิทธิ์) หรือปฏิเสธ
- การ์ดใหม่ **"✉️ คำเชิญที่ส่งแล้ว — รอตอบรับ"** — ยกเลิกได้
- การ์ดใหม่ **"🔗 รหัสครอบครัว"** — โชว์รหัส + คัดลอก + สร้างใหม่ + สวิตช์ "ให้ค้นเจอด้วยชื่อครอบครัว"
- **ปุ่ม "เพิ่ม" → "ส่งคำเชิญ"** + ข้อความกำกับว่าต้องรออีกฝ่ายกดยอมรับก่อนถึงเข้าจริง
- **ปุ่ม "คัดลอกลิงก์เชิญ"** — ได้ `https://tammie-care.hommekidgo.workers.dev/login.html?next=join.html` ส่งทางไลน์ให้คนที่ยังไม่มีบัญชี (สมัครเสร็จเด้งเข้าหน้าคำเชิญทันที)

### 5.3 `app/index.html`

- มีครอบครัวอยู่แล้ว + มี pending → แบนเนอร์ **"🔔 มีคำเชิญ n รายการ"** ลิงก์ไป `join.html`
- ยังไม่มีครอบครัวเลย → เปลี่ยน empty state เดิม ("ยังไม่มีสัตว์เลี้ยงที่คุณเข้าถึงได้") เป็น **คำเชิญที่ค้างอยู่ + ปุ่ม "เข้าร่วมครอบครัว →"**

### 5.4 `app/login.html`

- สมัครเสร็จ → พาไป `join.html` แทนข้อความเดิม "บอกผู้ดูแลครอบครัวให้เพิ่มอีเมลนี้"

### 5.5 `app/lib.js`

เพิ่ม wrapper: `searchFamilies` · `lookupFamilyByCode` · `requestJoin` · `inviteMember` · `respondJoinRequest` · `cancelJoinRequest` · `myJoinRequests` · `familyJoinRequests` · `regenJoinCode` · `setFamilyDiscoverable`

⚠️ **bump `?v=25 → 26` ทุกไฟล์ใน `app/`**: `sed -i '' 's/theme.css?v=25/theme.css?v=26/; s/lib.js?v=25/lib.js?v=26/' app/*.html`

---

## 6. ลำดับลงมือ

| # | งาน | ผลลัพธ์ |
|---|---|---|
| 1 | `supabase/09_join_requests.sql` | schema + RLS + RPC ทั้งหมด (รันใน SQL Editor, รันซ้ำได้) |
| 2 | `supabase/10_test_join.sql` | test checkpoint ตามข้อ 7 — **ไม่ผ่านครบห้ามไปต่อ** |
| 3 | `app/lib.js` + bump `?v=` | wrapper ครบ 10 ตัว |
| 4 | `app/join.html` | หน้าใหม่ ทำงานได้ครบ 3 ส่วน |
| 5 | `app/family.html` | 3 การ์ดใหม่ + เปลี่ยนคำปุ่มเป็น "ส่งคำเชิญ" |
| 6 | `app/index.html` + `app/login.html` | แบนเนอร์ + empty state + ปลายทางหลังสมัคร |
| 7 | อัปเดต `NOTES_gotchas.md` + `TAMMIE_CARE_V2_PLAN.md` | จดกับดักที่เจอระหว่างทำ |
| 8 | push `v2-multiuser` → รอ build ~1 นาที | ทดสอบบนมือถือจริง (hard refresh) |

---

## 7. Test checklist (ทำใน `10_test_join.sql` + ทดสอบมือบนเว็บ)

- [ ] คนนอกเรียก `search_families` เจอ **แค่ชื่อ** — ยิง `pets` / `family_members` / `profiles` ตรง ได้ 0 แถว
- [ ] ค้นด้วยคำ 2 ตัวอักษร → ถูกปฏิเสธ · ครอบครัวที่ `discoverable = false` ค้นด้วยชื่อไม่เจอ แต่เข้าด้วยรหัสได้
- [ ] user ขอเข้า → admin เห็นคำขอ → approve → user เห็นสัตว์ทันที
- [ ] admin เชิญ → **ผู้ถูกเชิญยังไม่เห็นอะไรเลยจนกว่าจะกดยอมรับ**
- [ ] non-admin เรียก `respond_join_request` ของ `direction='request'` → exception
- [ ] ผู้ใช้เรียก `respond_join_request` ด้วย `id` ของคนอื่น → exception
- [ ] ผู้ถูกเชิญยกระดับ `permission` ตัวเองตอนกดยอมรับ → ไม่มีผล (ใช้ค่าที่ admin ตั้ง)
- [ ] ถูกปฏิเสธแล้วขอครอบครัวเดิมซ้ำภายใน 24 ชม. → ถูกปฏิเสธ
- [ ] vet ที่ถูก approve → เข้า `vet_access` ไม่ใช่ `family_members` · เขียนข้อมูลไม่ได้
- [ ] คนที่มีครอบครัวแล้วกดขอเข้าครอบครัวอื่น → ถูกปฏิเสธ (ข้อจำกัด Phase 1)

---

## 8. กับดักที่ต้องระวัง (จาก `NOTES_gotchas.md`)

- **แคช** — bump `?v=` ทุกไฟล์ · `index.html` / `family.html` / `login.html` / `join.html` เป็น entry point ติด `?v=` ไม่ได้ → ต้อง **hard refresh (Cmd+Shift+R)** หรือ incognito ตอนทดสอบ · workers.dev ต้องรอ build ~1 นาทีหลัง push
- **ไฟล์ทดสอบ SQL** — `set_config('request.jwt.claims', ...)` **ก่อน** `set_config('role','authenticated')` เสมอ ไม่งั้นอ่าน `auth.users` ไม่ได้ (ERROR 42501)
- **ห้าม** `grant select on auth.users to authenticated` เด็ดขาด — เปิดให้ทุกคนอ่านอีเมลทุกคน
- ทุก RPC ต้อง `set search_path = public, auth` กัน hijack
- `join.html` ต้องอยู่ใน `app/` — `wrangler.toml` เสิร์ฟเฉพาะโฟลเดอร์นี้
- `create or replace function` เปลี่ยน return type ไม่ได้ — ถ้าจะแก้ signature ของ `add_member_by_email` ต้อง `drop function` ก่อน

---

## 9. อยู่นอกขอบเขตรอบนี้ (backlog)

- เชิญอีเมลที่ยังไม่มีบัญชี (`invited_email` + ผูกตอนสมัครใน trigger `handle_new_user`)
- แจ้งเตือนทางอีเมล/LINE เมื่อมีคำขอหรือคำเชิญใหม่ (ติดโควตา SMTP — ดู NOTES ข้อ 7)
- 1 บัญชีอยู่หลายครอบครัว + ตัวสลับครอบครัวใน UI
- ประวัติคำขอย้อนหลังแบบเต็ม / audit log

# 🪤 Tammie Care V2 — บันทึกกับดัก + เหตุผลการตัดสินใจ (handoff)

ไฟล์นี้จดสิ่งที่ **ไม่ได้อยู่ในโค้ดตรง ๆ** — บั๊กที่เจอ, กับดักที่กินเวลา, และเหตุผลเบื้องหลังการตัดสินใจ
เพื่อให้แชตใหม่/คนใหม่ไม่ต้องเจอซ้ำ · อ่านคู่กับ `TAMMIE_CARE_V2_PLAN.md` (แผนหลัก)

---

## ⚡ กับดักที่เจอบ่อย (เจอซ้ำแน่ถ้าไม่รู้)

### 1. แคช JS/HTML ค้าง — อาการ "แก้แล้วไม่เปลี่ยน"
- `theme.css` และ `lib.js` ติด `?v=NN` cache-bust แล้ว — **แก้ CSS/lib ต้อง bump เลข `?v=` ทุกไฟล์** (`sed -i 's/theme.css?v=25/theme.css?v=26/' app/*.html`)
- **`index.html` / `pet.html` / `family.html` / `login.html` เอง ติด `?v=` ไม่ได้** (เป็น entry point) → เวลาแก้ inline JS ในไฟล์พวกนี้ ต้อง **hard refresh (Cmd+Shift+R)** หรือ incognito
- อาการคลาสสิกที่หลงเชื่อว่าเป็นบั๊กโค้ด แต่จริง ๆ คือแคช: "ยังเห็น section เดิม", "TC.xxx is not a function", "ปุ่มเก่ายังอยู่" → **เช็กแคชก่อนเสมอ**
- บน workers.dev ต้องรอ build (~1 นาที) หลัง push ด้วย

### 2. Supabase `set_pet_path` — ลำดับ path สำคัญ
- RPC เขียนเฉพาะเส้นทางใน jsonb (ไม่ส่ง data ทั้งก้อน) กันสองคนแก้ทับกัน
- **`set_pet_path` guard: path[1]='card' เขียนได้เฉพาะ admin** (อยู่ใน `08_profile_admin.sql`) — โปรไฟล์สัตว์ = admin only
- ถ้าเพิ่ม path ใหม่ที่ต้อง admin-only ต้องเพิ่ม guard ในฟังก์ชันนี้

### 3. SQL test (`03_test_checkpoint.sql`) — ต้อง set jwt claims ก่อน set role
```sql
-- ✅ ถูก: claims ก่อน (ยังเป็น superuser อ่าน auth.users ได้) แล้วค่อยลด role
select set_config('request.jwt.claims', ...);
select set_config('role', 'authenticated', true);
-- ❌ ผิด: ลด role ก่อน → อ่าน auth.users ไม่ได้ → ERROR 42501
```
- **ห้ามแก้ด้วย `GRANT SELECT ON auth.users TO authenticated`** — เปิดให้ทุกคนอ่านอีเมลทุกคน (ช่องโหว่)

### 4. Accordion / element ที่ยังไม่เข้า DOM
- `fillLabBody` (และ pattern คล้ายกัน) ใช้ `document.getElementById` ข้างใน → **ต้อง append element เข้าหน้าก่อนแล้วค่อยเรียก** ไม่งั้นหา element ไม่เจอ = error null
- เจอกับ lab accordion ตอน re-render หลังบันทึก (LAB_OPEN ตั้งไว้) — แก้โดย fill หลัง append ใน `renderLabs`

### 5. อักษรซีริลลิกปนละติน
- เคยเผลอพิมพ์ `м` (ซีริลลิก) แทน `m` ในชื่อฟังก์ชัน — ผ่าน `node --check` แต่พังตอนรัน
- **ตรวจ JS syntax ทุกครั้งหลังแก้ pet.html** ด้วย: `node --check` (สคริปต์ดึง `<script>` block สุดท้ายมาเช็ก)

### 6. รูปใน bucket เป็น private → ต้องใช้ signed URL
- `pet-photos` เป็น private bucket → เปิดรูปตรง ๆ ไม่ได้ ต้อง `TC.signedUrl(path)` (มี cache ในตัว)
- path เก็บใน data เป็น `<pet_id>/<ชื่อไฟล์>` — RLS ของ storage ผูกสิทธิ์รูปเข้ากับสิทธิ์ของสัตว์ตัวนั้น (`05_storage_policies.sql`)

---

## 🧭 เหตุผลการตัดสินใจสำคัญ (ทำไมทำแบบนี้)

| เรื่อง | ตัดสินใจ | เหตุผล |
|---|---|---|
| เก็บข้อมูลสัตว์ | `pets.data` เป็น **jsonb ก้อนเดียว** (โครง JSON เดิมทั้งก้อน) | migrate จาก V1 ได้ครบไม่ตกหล่น + port โค้ดเรนเดอร์เดิมได้เกือบหมด · แลกกับว่าโหลดทั้งก้อนทุกครั้ง (ยังไม่เป็นปัญหา) · ถ้า labs โตเป็นพันค่อยแตกตาราง |
| ความปลอดภัย | **RLS/RPC ที่ DB เป็นตัวคุมจริง** ไม่ใช่ซ่อนปุ่มใน JS | ต่อให้ยิง API ตรงข้าม UI ก็ไม่ผ่าน · ปุ่มที่ซ่อน = UX เท่านั้น |
| การเขียนข้อมูล | RPC `set_pet_path` (แก้เฉพาะ path) ไม่ส่ง data ทั้งก้อน | กันสองคนเปิดหน้าค้างแล้วบันทึกทับกันจนข้อมูลอีกฝ่ายหาย |
| โปรไฟล์สัตว์/เพิ่มสัตว์ | **admin เท่านั้น** (RPC `set_pet_profile` + `create_pet` เช็ก `is_family_admin`) | ผู้ใช้ขอไว้ · edit แก้ข้อมูลสุขภาพได้แต่ไม่แตะโปรไฟล์/เพิ่มลบสัตว์ |
| ลบสัตว์ / ลบหมวดผลเลือด | เตือนหลายชั้น + พิมพ์ชื่อยืนยัน + **ลบรูปใน Storage ด้วย** | ข้อมูลสุขภาพหลายปีมีค่า · กันลบพลาด · ไม่ให้เหลือไฟล์กำพร้า |
| ค่าผลเลือด `< >` | เก็บเป็น string, `parseLabVal` แยก op+ตัวเลข | เครื่องนับไม่ได้ (เช่น `>2000`) ต้องคิดเกณฑ์อันตรายจากเครื่องหมาย + พล็อตกราฟที่ตัวเลข |
| เทมเพลตผลเลือด | ฝังใน `LAB_TEMPLATES` (โค้ด) — CBC 18 / เคมี 22 | ค่าเยอะ พิมพ์เองลำบาก · ติ๊กเพิ่มแล้ว copy เป็นของสัตว์ตัวนั้น แก้อิสระ · เตือนให้เช็กเกณฑ์ปกติ (แต่ละแล็บต่างกัน) |
| หน้าสรุป | section ยืดหยุ่น (built-in + custom ลิสต์/กราฟ) เก็บใน `data.custom` + `display.hidden/order` | น้องแต่ละตัวเน้นไม่เหมือนกัน · สัตว์ใหม่ default = danger+watch |
| ดีไซน์การจัดการ | **✏️ = แก้เนื้อหา · ⚙️ = ตั้งค่า/โครง** · read-only default กด ✏️ ค่อยจัดการ (แท็บสรุป) · content tab แก้ inline | ให้ผู้ใช้เรียนรู้ vocabulary เดียว |

---

## 🔑 ค่าคงที่ / ข้อมูลระบบ

- Supabase: `https://fvsdtkjzrvxqntybyfhg.supabase.co` · region South Asia · publishable key อยู่ใน `app/config.js` (ปลอดภัยที่จะ commit — RLS คุม)
- **Secret key ห้าม commit** (repo ยัง public) · ใช้เฉพาะรัน `migrate.py` บนเครื่อง
- Deploy: Cloudflare **Workers** (ไม่ใช่ Pages) · `wrangler.toml` เสิร์ฟ **เฉพาะ `app/`** · URL: `https://tammie-care.hommekidgo.workers.dev`
- branch งาน: **`v2-multiuser`** · `main` = เว็บ V1 เดิมบน GitHub Pages (ยังไม่ cutover)
- ครอบครัวจริง: "บ้านแทมมี่" · admin: hommekidgo@gmail.com · สัตว์: เฟ่ (frappe) + เฟ่อ (wafer)
- Phase 1 รองรับ **1 ครอบครัว/บัญชี** (ใช้ครอบครัวแรก) — ระบบขอเข้าหลายครอบครัวอยู่ใน backlog

---

## 📁 ลำดับไฟล์ SQL (รันตามลำดับถ้าตั้ง DB ใหม่)
`01_schema` → `02_rls` → (`03_test_checkpoint` ไม่บังคับ) → `04_seed_real` → `05_storage_policies` → `06_edit_rpc` → `07_family_rpc` → `08_profile_admin`

> ⚠️ `08_profile_admin.sql` **recreate `set_pet_path`** (เพิ่ม guard card) — ถ้ารัน `06` ใหม่ทับ ต้องรัน `08` ตามหลังเสมอ

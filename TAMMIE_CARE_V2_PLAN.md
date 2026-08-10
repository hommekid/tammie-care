# 🐾 Tammie Care V2 — แผนอัปเกรดเป็นระบบหลายผู้ใช้ (Multi-User)

> **สถานะ: 📝 แผนงาน — ยังไม่เริ่มทำจริง** · จะเริ่มทำบน branch ใหม่ของ repo (เช่น `v2-multiuser`) โดย `main` + เว็บเดิมใช้งานได้ตามปกติตลอดช่วงพัฒนา
>
> สรุปรวมจาก: `README.md` · `PROJECT_CONTEXT.md` · `DESIGN_SYSTEM.md` · `tammie-care-multiuser-upgrade-plan.md` (v2)

---

## 1. เป้าหมาย

ยกระดับ Tammie Care จาก **เว็บ static (HTML/JS + JSON + commit ผ่าน GitHub Token, ผู้ใช้คนเดียว)** → **ระบบหลายครอบครัว หลายผู้ใช้ มี login จริง + สิทธิ์ตามบทบาท** โดย:

1. **ข้อมูลเดิมต้อง migrate ไปครบ 100%** — ทุก record ของเฟ่ (frappe) และเฟ่อ (wafer) ต้องอยู่ในระบบใหม่ครบ ตรวจนับได้
2. **ระบบใหม่ตามแพลน v2** — Supabase (DB + Auth + RLS) + Cloudflare Pages, บทบาท parent/vet, ระดับสิทธิ์ view/edit/admin, ฟีเจอร์ task รายวัน/รายสัปดาห์ (Phase 2) และมินิเกม (Phase 3)
3. **ความเสถียรมาก่อน** — ไม่มี big-bang cutover: ระบบเก่าทำงานจนกว่าระบบใหม่จะพิสูจน์ตัวเองใน production แล้วเท่านั้น
4. **หน้าตาคงธีมเดิม** — ใช้ design system พาสเทลสว่างจาก `DESIGN_SYSTEM.md` ทั้งหมด (สี/ฟอนต์/รัศมี/เงา/Mermaid) — V2 เปลี่ยน "ที่มาของข้อมูลและสิทธิ์" ไม่เปลี่ยนบุคลิกของเว็บ

**Stack:** Supabase free tier (Postgres + Auth + Storage) · Cloudflare Pages free (hosting) · frontend ยังเป็น HTML/JS + Supabase JS client ผ่าน CDN (ไม่มี build step)

---

## 📌 ความคืบหน้า

| Step | สถานะ | บันทึก |
|---|---|---|
| 1 · สมัครบริการ | ✅ เสร็จ 19 ก.ค. 2026 | โปรเจกต์ Supabase `Tammie Care's Project` (free, region South Asia) · เก็บ Project URL + publishable key แล้ว |
| 2 · Database + RLS | ✅ **ผ่าน checkpoint 19 ก.ค. 2026** | รัน `supabase/01_schema.sql` + `02_rls.sql` · ทดสอบ `03_test_checkpoint.sql` ผ่านครบ 4 ข้อ (parent admin เขียนได้ · vet อ่านอย่างเดียว · คนนอกไม่เห็นอะไร · view≠edit) |
| 3 · Migrate ข้อมูล | ✅ **ผ่าน checkpoint 19 ก.ค. 2026** | ครอบครัว "บ้านแทมมี่" + บัญชีจริงเป็น admin · bucket `pet-photos` (private) + policy · รัน `supabase/migrate.py` ผ่านการตรวจครบ 5 ข้อ ทั้งเฟ่และเฟ่อ |
| 4 · Frontend ใหม่ | ✅ ครบ 6 แท็บ 19 ก.ค. 2026 | `app/`: login + รายชื่อสัตว์ + dashboard · พอร์ตครบทุกแท็บ (สรุป · อาการประจำวัน · การรักษา · **ผลเลือด** · ยา · นัดหมาย) |
| 5 · Inline edit ตามสิทธิ์ | ✅ ครบทุกหมวด 19 ก.ค. 2026 | เพิ่ม/แก้/**ลบ**ได้ทุกแท็บ: อาการประจำวัน(+รูป) · การรักษา(+รูป+flowchart) · ยา · นัดหมาย · ผลเลือด(+เพิ่มค่า/หมวดใหม่ +ลบผล) · แท็บสรุป (Leuco เกณฑ์ · สัญญาณอันตราย+ปฐมพยาบาลเลือดกำเดา · สิ่งที่ต้องติดตาม · ก้อนในตับ) · **⚙️ ปรับหน้าสรุป** — parent ซ่อน/แสดง/จัดลำดับ section ต่อตัว (display.hidden/order) · ดีไซน์ read-only default กด ✏️ ค่อยจัดการ |
| · ปรับปรุงผลเลือด | ✅ เสร็จ 19 ก.ค. 2026 | จัดการค่าตรวจ + เกณฑ์ปกติต่อหมวด (ตั้งตอนเพิ่มหมวด/แก้ทีหลัง) · แก้ชื่อหมวด + ลบทั้งหมวด · เลื่อนลำดับค่า (↑↓) · รองรับค่า `< >` ที่เครื่องนับไม่ได้ (เช่น `>2000`) คิดเกณฑ์อันตรายจากเครื่องหมาย · จิ้มการ์ดค่าเพื่อดูกราฟแนวโน้ม (แทน dropdown) · **เทมเพลต CBC (18 ค่า) + Blood Chemistry (22 ค่า)** ติ๊กเพิ่มได้ทันที + เตือนเช็กเกณฑ์ปกติ · **⚙️ ซ่อน/แสดงหมวด** (display.hiddenPanels — ค่าเฉพาะโรคที่ไม่ติดตามแล้วซ่อนได้ ข้อมูลไม่หาย) |
| · แก้โปรไฟล์/การ์ด | ✅ เสร็จ 19 ก.ค. 2026 | ✏️ โปรไฟล์ ที่หัว dashboard (**admin เท่านั้น** — RPC `set_pet_profile` + guard `set_pet_path` กัน 'card', ดู `supabase/08_profile_admin.sql`) · แก้ชื่อ/ชื่อเล่น/emoji/พันธุ์/วันเกิด/สถานะ/รูป · **ครอปรูปเป็นสี่เหลี่ยม** (เลื่อน+ซูม, canvas ล้วน) · อายุแสดงปี+เดือน |
| · UI/UX ย่อย | ✅ เสร็จ 19 ก.ค. 2026 | banner `header.jpg` หน้าแรก + แถบชื่อ/จัดการ/ออก มุมขวาล่าง (มือถือเหลือไอคอน) · โชว์ชื่อเล่นสมาชิกแทนอีเมล + กดแก้ชื่อตัวเองได้ · favicon ชุดเต็ม + manifest · แท็บนัดหมายเหลือแค่ปฏิทิน · หน้าแรกทน error ชั่วคราว · **หน้าสรุปเพิ่ม/ลบหัวข้อเองได้ + เลือกชนิด (ลิสต์/กราฟ)** สัตว์ใหม่ default danger+watch · ลบสัตว์ลบรูปใน Storage + เตือน 3 ชั้น |
| 6 · Deploy | 🔄 ขึ้นแล้ว 19 ก.ค. 2026 | **https://tammie-care.hommekidgo.workers.dev** (Cloudflare Workers static assets, branch `v2-multiuser`) · เหลือ checkpoint: ใช้จริงต่อเนื่องหลายวัน + ชวนคนในครอบครัวลอง |
| · จัดการครอบครัว | ✅ เสร็จ 19 ก.ค. 2026 | หน้า `family.html` (admin เท่านั้น): เพิ่ม/ถอน parent + เปลี่ยนสิทธิ์ · ให้/ถอนสิทธิ์ vet · เพิ่ม/ซ่อน/ลบถาวรสัตว์ · ทั้งหมดด้วยอีเมล ผ่าน RPC `supabase/07_family_rpc.sql` (security definer, เช็ก admin ใน DB) · หน้า login มีโหมด**สมัครสมาชิก**แล้ว → คนอื่นสมัครเองได้ แล้ว admin ผูกเข้าครอบครัว = **ระบบเป็นหลายผู้ใช้จริงแล้ว** |
| 7 · Cutover | ⬜ ยังไม่เริ่ม | เปลี่ยน repo เป็น private · ปลด GitHub Token + password จาก `admin.html` เดิม · ให้หน้าใหม่เป็น default |

**Phase 1 เหลือแค่ Step 7 cutover** (แก้ข้อมูลได้ครบทุกอย่างผ่านเว็บแล้ว ไม่ต้องแตะ Supabase เพื่อแก้อะไรอีก)

---

## 🧹 ปรับ UX การจัดการให้สม่ำเสมอ (ตรวจ 19 ก.ค. 2026 — ยังไม่แก้)

ฟีเจอร์ครบแล้ว แต่ "ภาษา + ตำแหน่ง + ความปลอดภัย" ของการจัดการยังไม่เป็นระบบเดียวกัน · ทำตามลำดับ #6 → #1+#2 → #3+#5 → #4 → #7

| # | ปัญหา | เสนอแก้ | ระดับ |
|---|---|---|---|
| 6 | ลบหมวดผลเลือดเตือนครั้งเดียว ทั้งที่ลบผลตรวจหลายปีด้วย | ยกระดับเป็นพิมพ์ชื่อหมวดยืนยัน หรือเตือน 2 ชั้น | สูง (ปลอดภัย) |
| 1 | "ซ่อน" หลายที่ (สัตว์/section สรุป/หมวดผลเลือด) คำ+ปุ่มไม่เหมือนกัน | ใช้คำ+ไอคอนเดียวกันทุกที่ (👁 ซ่อน/แสดง) ตำแหน่งแบบเดียวกัน | สูง |
| 2 | การแก้ไม่มี pattern เดียว (บาง ✏️ จัดการ, บาง ⚙️, บางปุ่มโผล่เลย) | กติกาเดียว: ✏️ = แก้เนื้อหา · ⚙️ = ตั้งค่า/จัดการโครง | สูง |
| 3 | ⚙️ เฟืองทำหลายอย่าง (ปรับหน้าสรุป/ซ่อนหมวด/ค่า+เกณฑ์) | เติมข้อความท้ายไอคอนให้ชัด ไม่ให้เฟืองลอย ๆ | กลาง |
| 5 | ⚙️ ค่า+เกณฑ์ผลเลือดหายาก (อยู่ล่างสุดของหมวดที่ต้องกาง) | ย้ายลิงก์ขึ้นหัวหมวด (แถวเดียวกับชื่อหมวด) | กลาง |
| 4 | แก้โปรไฟล์อยู่ลึก (ต้องเข้า dashboard สัตว์) | เพิ่มทางเข้าที่หน้าจัดการครอบครัว ตรงรายการสัตว์ | กลาง |
| 7 | เพิ่มเทมเพลตซ้ำได้ (CBC ซ้ำสองหมวด) | เช็กชื่อซ้ำก่อนเพิ่ม แล้วเตือน/ข้าม | ต่ำ |

> ข้อ 8 เดิม (ตารางค่า+เกณฑ์แน่นบนมือถือ) — ตรวจแล้ว **โอเค ตัดออก**

**หมายเหตุจัดการครอบครัว:** เพิ่มคนด้วยอีเมลได้เฉพาะคนที่สมัครไว้แล้ว (RPC ค้น `auth.users`) · กันถอด/ลดสิทธิ์ admin คนสุดท้าย · ลบสัตว์ถาวรต้องพิมพ์ชื่อยืนยัน (ซ่อน = soft delete ผ่าน `archived` กู้ได้) · Phase 1 รองรับ 1 ครอบครัว/บัญชี (ใช้ครอบครัวแรก)

**หมายเหตุการเขียนข้อมูล (Step 5):** ไม่ส่ง `data` ทั้งก้อนกลับไป แต่เรียก RPC `set_pet_path(pet_id, path, value)` แก้เฉพาะเส้นทางที่ระบุ — กันกรณีสองคนเปิดหน้าค้างไว้แล้วบันทึกทับกันจนข้อมูลของอีกฝ่ายหายเงียบ ๆ · ฟังก์ชันเป็น SECURITY INVOKER เพื่อให้ RLS ยังตรวจสิทธิ์จริง · รูปย่อเหลือด้านยาว 1400px ก่อนอัป · ลบบันทึกแล้วไม่ลบไฟล์รูป (เผื่อกู้)

**หมายเหตุ deploy:** `wrangler.toml` ตั้งให้เสิร์ฟ **เฉพาะโฟลเดอร์ `app/`** — ไม่รวม `data/*.json` และ `img/` เพื่อไม่ให้ข้อมูลสุขภาพไปเปิดเป็นไฟล์สาธารณะบนโดเมนใหม่ซ้ำอีกที่ · push ขึ้น `v2-multiuser` เมื่อไหร่ เว็บอัปเดตเองใน ~1 นาที

**โครงไฟล์ V2 (`app/`)**

| ไฟล์ | หน้าที่ |
|---|---|
| `config.js` | Supabase URL + publishable key (ปลอดภัยที่จะ commit — RLS คุมจริง) |
| `theme.css` | CSS variables ที่เดียว + base styles — เตรียมไว้ให้ระบบเลือกธีมใน Phase 3 |
| `lib.js` | `TC.*` — auth guard, `getMyRole()`, อ่านข้อมูลสัตว์, signed URL, error ไทย |
| `login.html` | เข้าสู่ระบบ (มีตัวดักว่า config ยังไม่ได้ตั้งค่า) |
| `index.html` | รายชื่อสัตว์ + เตือนนัด 7 วัน + ป้ายโหมดสัตวแพทย์ |
| `pet.html` | dashboard — โครงแท็บครบ 6 แท็บ ทำจริงแล้ว 1 (สรุป) |

**สิ่งที่อยู่ในระบบแล้ว (19 ก.ค. 2026)**

| | เฟ่ (frappe) | เฟ่อ (wafer) |
|---|---|---|
| meds / labs / labConfig | 19 / 17 / 36 | 5 / 9 / 28 |
| treatments / appointments / watchList | 8 / 9 / 5 | 6 / 7 / 5 |
| อาการ | เลือดกำเดา 36 · ท้องเสีย 27 · ทั่วไป 15 | อาเจียน 9 · ท้องเสีย 10 · ทั่วไป 3 |
| ก้อนในตับ / หัวใจ | 19 / 2 | — |
| รูปใน Storage | 38 | 8 |

**หมายเหตุการ migrate**

- ข้อมูลจาก `pets.json` (ชื่อเล่น/emoji/status/statusNote) เก็บไว้ใน `pets.data.card` — ไม่ได้อยู่ในไฟล์ per-pet จึงต้องเก็บแยกไม่ให้ตกหล่น
- รูปเก็บเป็น path `<pet_id>/<ชื่อไฟล์>` ใน bucket `pet-photos` (private) · frontend ต้องใช้ signed URL เปิดรูป
- `pets` มี unique constraint `(family_id, slug)` เพื่อให้ upsert ของ script ทำงาน (partial index ใช้กับ ON CONFLICT ไม่ได้)
- ระหว่าง dual-run: **แก้ข้อมูลผ่านระบบเดิมเท่านั้น** แล้วรัน `migrate.py` ซ้ำก่อน cutover (idempotent)

---

## 2. จากเดิม → ใหม่

| ด้าน | ระบบเดิม (V1) | ระบบใหม่ (V2) |
|---|---|---|
| ข้อมูล | `data/*.json` ใน repo | Supabase Postgres (`pets.data` เป็น jsonb โครงเดิม) |
| การแก้ไข | `admin.html` + รหัสผ่าน + GitHub Token | login จริง + inline edit บนหน้า pet ตามสิทธิ์ |
| ผู้ใช้ | คนเดียว ไม่มี login | หลายครอบครัว หลายคน · parent (view/edit/admin) + vet (view) |
| ความปลอดภัย | รหัสผ่านฝังในโค้ด (repo public!) | RLS ที่ฐานข้อมูล — bypass UI ก็เขียนไม่ได้ |
| Hosting | GitHub Pages | Cloudflare Pages |
| รูปภาพ | `img/` ใน repo | Supabase Storage (ดูข้อ 6 — open decision) |
| Deploy ข้อมูล | commit → รอ Pages build ~1 นาที | บันทึกเข้า DB เห็นผลทันที |

---

## 3. โมเดลข้อมูล (Supabase / Postgres)

### ตารางหลัก (Phase 1)

| ตาราง | คอลัมน์ | หน้าที่ |
|---|---|---|
| `families` | `id`, `name` | 1 แถว = 1 ครอบครัว |
| `pets` | `id`, `family_id`, `name`, `data` (jsonb), `archived` (bool) | โปรไฟล์ + ข้อมูลสุขภาพทั้งหมด |
| `profiles` | `id` (= Supabase Auth user id), `name`, `email` | ข้อมูลผู้ใช้ |
| `family_members` | `family_id`, `user_id`, `role` (`parent`), `permission` (`view`/`edit`/`admin`) | ผูก parent เข้าครอบครัว + ระดับสิทธิ์ |
| `vet_access` | `family_id`, `vet_user_id`, `permission` (`view` เสมอ) | ให้หมออ่านข้อมูลสัตว์ของครอบครัวได้ |

### ตาราง Phase 2 (task) + Phase 3 (เกม)

| ตาราง | คอลัมน์ | หน้าที่ |
|---|---|---|
| `task_templates` | `id`, `pet_id`, `title`, `frequency` (`daily`/`weekly`), `category` | นิยามงานดูแลประจำ (ให้ข้าว แปรงฟัน อาบน้ำ) |
| `task_completions` | `id`, `task_template_id`, `completed_by`, `completed_at`, `period_key` | log การทำงาน · `period_key` = `2026-07-19` (daily) / `2026-W29` (weekly) |
| `pet_game_config` | `pet_id`, `max_hp`, `sprite_id` | ตั้งค่ามินิเกม (Phase 3) |

### หัวใจของแผน: `pets.data` (jsonb) = โครง JSON เดิมทั้งก้อน

เก็บโครงสร้าง `data/<id>.json` เดิม **ไม่แปลงรูป**: `profile`, `meds`, `vitals`, `labPanels`, `labConfig`, `labs`, `symptoms`, `treatments`, `appointments`, `dangerSigns`, `watchList`, `leucoPlus`, `display`

ข้อดี: (1) migrate ได้ครบแบบไม่ตกหล่น — ก้อน JSON ทั้งไฟล์ = ค่าใน 1 คอลัมน์ (2) โค้ดเรนเดอร์ dashboard เดิม (แท็บ/ปฏิทิน/กราฟ/Mermaid) เอามาใช้ต่อได้เกือบทั้งหมด แค่เปลี่ยน `fetch('data/x.json')` → query Supabase (3) ค่อยแตกเป็นตารางย่อย (เช่น labs) ทีหลังได้ถ้าจำเป็น — ไม่ต้องตัดสินใจตอนนี้

### กติกาสิทธิ์ (RLS — บังคับที่ฐานข้อมูล ไม่ใช่ที่ JS)

- `SELECT` pet ได้ ถ้าอยู่ใน `family_members` **หรือ** `vet_access` ของ family นั้น
- `INSERT`/`UPDATE` pet ได้ เฉพาะ `family_members.permission` = `edit` หรือ `admin`
- vet ไม่มี write policy ใด ๆ · task/เกม: เฉพาะ `family_members` (vet มองไม่เห็น)
- การซ่อนปุ่มใน UI = UX เท่านั้น — **RLS คือความปลอดภัยจริง**

**Flow การเข้าถึง:** ทุกคนสมัครผ่าน Supabase Auth ก่อน → เอา `user_id` ไปใส่ `family_members` (parent) หรือ `vet_access` (vet) — ช่วงแรกใส่มือใน table editor, ระบบ invite ในแอปไว้ Phase 3

---

## 4. การ Migrate ข้อมูลเดิม (ต้องครบ 100%)

### 4.1 Inventory ข้อมูลปัจจุบัน (baseline สำหรับตรวจนับหลัง migrate)

| ไฟล์ | เนื้อหา |
|---|---|
| `data/pets.json` | รายชื่อสัตว์ทั้งหมด (2 ตัว) |
| `data/frappe.json` | **เฟ่** — โปรไฟล์ · ยาประจำ 19 · labs: CBC 9 + เคมี 5 + Cardiac 2 + Coag 1 · นัดหมาย 6 · symptoms (เลือดกำเดา/ท้องเสีย/ทั่วไป) · treatments + flowchart · dangerSigns/watchList/leucoPlus · vitals + liverTumor · display (ซ่อน stats) |
| `data/wafer.json` | **เฟ่อ** — โปรไฟล์ · ยาประจำ 5 · CBC 4 + เคมี 5 · การรักษา 4 · อาเจียน 6 · ท้องเสีย 6 · นัดหมาย 5 · display.tabs เฉพาะตัว (ไม่มีเลือดกำเดา/Leuco/กราฟก้อน) |
| `img/` | header, รูปโปรไฟล์, favicon, **รูปอาการ/ผลเลือด/การรักษาที่อัปผ่าน admin** (path ถูกอ้างใน JSON) |

> ⚠️ ตอนลงมือจริงให้เขียน script นับจำนวน record จริงจากไฟล์ JSON อีกครั้ง (ตัวเลขข้างบนมาจาก PROJECT_CONTEXT ณ ก.ค. 2026 — ข้อมูลเพิ่มทุกสัปดาห์)

### 4.2 ขั้นตอน migrate

1. Script ครั้งเดียว (Node/Python): อ่าน `pets.json` + `frappe.json` + `wafer.json` → insert `families` 1 แถว + `pets` ตัวละแถว (`data` = JSON ทั้งก้อน)
2. **ไม่แตะไฟล์ JSON ใน repo** — เป็น backup และเว็บเดิมยังใช้อยู่
3. รูปภาพ: อัปโหลดรูปที่ JSON อ้างถึงเข้า Supabase Storage แล้ว rewrite path ใน `data` (หรือคงเสิร์ฟจาก repo ช่วงแรก — ดู open decision)
4. **ช่วง dual-run มีกติกาชัด: แก้ข้อมูลที่ระบบเดิมเท่านั้น** จนกว่าจะ cutover → ก่อน cutover รัน migrate ซ้ำรอบสุดท้าย (re-run ทับได้ ต้องเขียน script แบบ idempotent)

### 4.3 Checklist ตรวจว่าครบ (ทำก่อนถือว่า migrate ผ่าน)

- [ ] Script เทียบอัตโนมัติ: JSON เดิม vs `pets.data` ใน DB — deep-equal ทุก key (ไม่ใช่แค่นับจำนวน)
- [ ] นับจำนวนต่อหมวดต่อตัว (meds/labs/treatments/appointments/symptoms แต่ละชนิด/liverTumor/watchList) ตรงกับ inventory
- [ ] Spot-check ค่าจริง: WBC ล่าสุดของเฟ่, Albumin ของเฟ่อ, วันนัดถัดไป, flowchart Mermaid เรนเดอร์ได้
- [ ] รูปทุก path ใน `data` เปิดได้จริงในระบบใหม่ (ไม่มีรูปแตก)
- [ ] `display` ต่อตัวทำงานถูก: เฟ่ซ่อน stats · เฟ่อไม่มีแท็บเลือดกำเดา/Leuco/กราฟก้อน
- [ ] เว็บเดิมยังทำงานปกติ (ไม่มีอะไรพัง)

---

## 5. แผนงานเป็น Phase (แต่ละ step มี ✅ checkpoint — ไม่ผ่านห้ามไปต่อ)

### PHASE 1 — Multi-User Core

**Step 0 · เตรียม branch** — สร้าง branch `v2-multiuser` · งานใหม่ทั้งหมดอยู่ที่นี่ · `main` = ระบบเดิม deploy อยู่ · ไฟล์ใหม่แยกชื่อ (เช่น `app/` หรือ `v2/`) ไม่ทับไฟล์เดิม

**Step 1 · สมัครบริการ** — สร้างโปรเจกต์ Supabase + บัญชี Cloudflare · เก็บ URL + anon key ให้ปลอดภัย (anon key อยู่ใน frontend ได้ เพราะ RLS คุม แต่ **service key ห้ามหลุดเด็ดขาด**)
✅ เข้า dashboard ทั้งสองได้

**Step 2 · Database + RLS** — สร้าง 5 ตารางหลัก + foreign keys · เปิด Auth (email/password) · เปิด RLS ทุกตาราง + เขียน policy ตามข้อ 3
✅ สร้าง user ทดสอบ 2 คน (parent + vet) แล้วยืนยันครบ 3 ข้อ: parent (edit) อ่าน+เขียนของครอบครัวตัวเองได้ · parent ต่างครอบครัวมองไม่เห็นอะไรเลย · vet อ่านได้แต่เขียน fail — **ไม่ผ่านครบห้ามไปต่อ นี่คือรากฐานของทั้งระบบ**

**Step 3 · Migrate ข้อมูล** — ทำตามข้อ 4 ทั้งหมด
✅ checklist 4.3 ผ่านครบทุกข้อ

**Step 4 · Frontend ใหม่ (คู่ขนาน ไม่แทนของเดิม)** — Supabase JS ผ่าน CDN · หน้า login/register · หน้า list + pet dashboard อ่านจาก Supabase (port โค้ดเรนเดอร์เดิม + ธีมจาก `DESIGN_SYSTEM.md`)
UX: mobile-first (พ่อแม่ใช้บนมือถือ) · UI ไทย · error เป็นภาษาคน ("รหัสผ่านไม่ถูกต้อง") · flow สั้น: login → เห็นสัตว์ทันที
✅ login เป็น parent เห็นสัตว์ครบจาก Supabase · login เป็น vet เห็นแบบอ่านอย่างเดียว

**Step 5 · UI ตามสิทธิ์** — **ไม่มีหน้า admin แยกอีกต่อไป**: หน้า pet เดียว default อ่านอย่างเดียว · ผู้มีสิทธิ์ edit/admin เห็นปุ่ม ✏️ ต่อ section → แก้ inline → Save/Cancel (แก้ทีละ section พลาดยากกว่า เหมาะกับมือถือ) · หน้า "จัดการครอบครัว" แยกสำหรับงานนาน ๆ ครั้ง: เพิ่ม parent / ให้สิทธิ์ vet / เปลี่ยน permission (admin เท่านั้น) / เพิ่ม-ลบสัตว์ (ลบ = พิมพ์ชื่อยืนยัน + soft-delete ผ่าน `archived` กู้คืนได้) · โหมด vet ติดป้ายชัด "โหมดสัตวแพทย์ — ดูอย่างเดียว"
✅ แต่ละ role เห็น UI ถูกต้อง + ยิง API ตรง ๆ ข้ามสิทธิ์แล้วโดน RLS block

**Step 6 · Deploy ระบบใหม่ (ของเดิมยังอยู่)** — ต่อ repo (branch v2) เข้า Cloudflare Pages · ทดสอบ flow เต็มใน production บนมือถือจริง · ชวนคนในครอบครัวจริง 1 คนมาลองใช้
✅ ใช้งานจริงต่อเนื่องหลายวันโดยไม่มีปัญหา

**Step 7 · Cutover + เก็บกวาด (หลัง Step 6 นิ่งแล้วเท่านั้น)** — รัน migrate รอบสุดท้าย → ให้หน้าใหม่เป็น default → ตัด GitHub Token logic + `CONFIG.password` ออกจาก `admin.html` → archive หน้า JSON เก่า (อยู่ใน git history) → เช็กไม่มี live page อ้าง `data/*.json` → merge เข้า `main`
✅ **Phase 1 จบ — ระบบ multi-user ใช้งานจริง**

### PHASE 2 — Task ดูแลประจำวัน/สัปดาห์ (เริ่มหลัง Phase 1 นิ่งใน production)

**Step 8 · Backend** — สร้าง `task_templates` + `task_completions` · กำหนดวัน reset รายสัปดาห์ · RLS: เฉพาะ family_members · parent คนไหนก็ทำได้ `completed_by` บันทึกว่าใคร
✅ insert ทดสอบแล้ว RLS ถูกต้อง

**Step 9 · Frontend** — checklist ต่อตัว แยก daily/weekly · ติ๊ก → insert completion · reset โดยเทียบ `period_key` (ไม่ต้องมี cron) · โชว์ว่าใครทำ ("เฟ่ได้กินข้าวแล้ว ✓ โดยแม่")
✅ reset ถูกต้องข้ามวัน/สัปดาห์ · สอง parent เห็นของกันและกัน

**Step 10 · Gamification (optional)** — streak + badge — ทำเมื่อ checklist ถูกใช้จริงทุกวันแล้วเท่านั้น

### PHASE 3 — มินิเกม HP + ตัวละคร Pixel (หลัง Step 8–9 ใช้จริงทุกวัน)

- HP **คำนวณตอนโหลดหน้า** จากประวัติ `task_completions` (ไม่เก็บเลขสด ไม่ต้องมี server/cron) · ทำ task เสร็จ HP ขึ้นทันทีบนจอ
- ตัวละคร: sprite CC0 จาก itch.io หรือวาดเอง · 3 อารมณ์ตาม HP: happy >70 / normal 40–70 / เหนื่อย <40 · animation แบบ CSS sprite-sheet ทีหลัง
- ⚠️ **ตัดสินใจก่อนสร้าง:** HP ลดได้เมื่อพลาด task (กระตุ้น แต่เห็นน้องเศร้าอาจใจเสีย — น้องป่วยจริงอยู่) vs แต้มบวกอย่างเดียว (XP/level ไม่มีลงโทษ)
✅ HP คำนวณถูก · อารมณ์เปลี่ยนตาม threshold · ทำ task แล้ว HP ขึ้นเห็น ๆ

### Backlog (Phase 3+)

Invite ในแอป (เพิ่มคนด้วย email) · Magic link / OAuth · แจ้งเตือน task ค้าง · ฟีเจอร์ฝั่ง vet (clinical notes — ต้องมีตาราง + write policy ใหม่) · แตก `labs` เป็นตารางแยกถ้าอยาก query/กราฟข้ามตัว · **ระบบเลือก Theme** (ดูด้านล่าง)

### 🔔 การแจ้งเตือนบนมือถือ (บันทึกไว้ 19 ก.ค. 2026 — ยังไม่ทำ)

เรียงจากง่าย/คุ้มสุด ไปยากสุด

**1. ปุ่ม "เพิ่มลงปฏิทิน" (.ics)** — ทำได้ทันทีหลังพอร์ตแท็บครบ
สร้างไฟล์ `.ics` จาก `appointments` แล้วให้ผู้ใช้กดเพิ่มเข้าปฏิทินมือถือ → **ปฏิทินเครื่องเตือนเอง** (ตั้งเวลาล่วงหน้าได้ตามใจ) · ไม่ต้องมี server ไม่ต้องขอสิทธิ์แจ้งเตือน ใช้ได้ทั้ง iPhone/Android เท่ากัน · โค้ดไม่กี่สิบบรรทัด

**2. Web Push จริง (ทำพร้อม Phase 2)**
- Android: ใช้ได้จากเบราว์เซอร์ปกติ
- **iPhone: ต้อง "เพิ่มลงหน้าจอโฮม" ก่อน** (iOS 16.4+) เปิดจาก Safari เฉย ๆ ไม่ได้ — เป็นกำแพงถ้าจะให้ทุกคนในครอบครัวใช้
- ต้องมี service worker + VAPID keys + ตัวส่ง push + **ตัวรันตามเวลา** (`pg_cron` + Edge Function บน Supabase free tier)
- 📌 **ทำพร้อม Phase 2** เพราะตอนนั้นมี cron + Edge Function อยู่แล้ว ใช้โครงเดียวกันส่งได้ทั้งเตือนนัดและเตือน task ที่ยังไม่ทำ

**3. ส่งผ่าน LINE / อีเมล**
เชื่อถือได้กว่า Web Push บน iOS และผู้ใช้ไม่ต้องติดตั้งอะไร แต่ต้องตั้ง bot/ผู้ส่งเพิ่ม
(LINE Notify ตัวเดิมปิดบริการแล้วตั้งแต่ต้นปี 2025 — ต้องใช้ Messaging API แทน)

### 🎨 ระบบเลือก Theme (Phase 3+ — ยังไม่ทำใน Phase 1)

**คอนเซปต์:** ให้ user แต่ละคนเลือกธีมตามใจชอบ — ธีมพาสเทลสว่างปัจจุบัน (`DESIGN_SYSTEM.md`) เป็น default · เริ่มทำ**หลังระบบใหม่ใช้งานจริงได้แล้วเท่านั้น**

- แต่ละธีม = ชุดค่า CSS variables ทับ `:root` (design system ปัจจุบันเป็น token อยู่แล้ว จึงสลับธีมได้โดยไม่แก้โครงสร้าง)
- เก็บธีมที่เลือกเป็น**ต่อ user** — เพิ่มคอลัมน์ `theme` ใน `profiles` (sync ข้ามเครื่อง) + cache ใน localStorage กัน flash ตอนโหลด
- เลือกธีมจากหน้าตั้งค่า/จัดการครอบครัว · ไอเดียธีมเพิ่ม: โทนมืด (dark), โทนชมพู, โทนเขียวมิ้นต์ ฯลฯ
- ธีมใหม่ต้องคงกติกา semantic เดิม: สีสถานะ เขียว/เหลือง/แดง (Leuco, เตือนนัด, ค่าเลือดผิดปกติ) ต้องอ่านง่ายและคอนทราสต์พอในทุกธีม + ปรับ themeVariables ของ Mermaid ตามธีมด้วย

**สิ่งเดียวที่ควรทำเผื่อไว้ตั้งแต่ Phase 1 (ต้นทุนต่ำ):** ประกาศ CSS variables ไว้ที่ไฟล์กลางไฟล์เดียว (เช่น `theme.css`) แทนการซ้ำ `:root` ในทุกหน้าแบบ V1 — ตอนทำระบบธีมจริงจะเพิ่มได้ทันทีโดยไม่ต้องรื้อ

---

## 6. Open Decisions (ตัดสินใจตอนเริ่มลงมือ)

1. ~~**SQL schema + RLS syntax ฉบับจริง**~~ → ✅ **เคาะแล้ว 19 ก.ค. 2026** — อยู่ใน `supabase/01_schema.sql` + `02_rls.sql` ผ่านการทดสอบแล้ว
2. ~~**รูปภาพ**~~ → ✅ **เคาะแล้ว: ย้ายเข้า Supabase Storage** ตั้งแต่ migrate รอบแรก · script ต้องอัปโหลดไฟล์ใน `img/` ที่ถูกอ้างใน JSON แล้ว rewrite path ใน `data` · bucket ตั้งเป็น private + RLS ให้ตรงกับสิทธิ์ของ `pets` (คนนอกเปิด URL ตรงไม่ได้)
3. ~~**repo**~~ → ✅ **เคาะแล้ว: เปลี่ยนเป็น private ตอน Step 7 (cutover)** — ทำก่อนหน้านั้นไม่ได้เพราะ GitHub Pages แผนฟรีต้องใช้ public repo เว็บเดิมจะดับทันที · Cloudflare Pages ต่อ private repo ได้ปกติ · หมายเหตุ: private หยุดการรั่วนับจากวันนั้น แต่ไม่ลบสิ่งที่เคยเปิดเผยไปแล้ว · รหัส `richie2407` ถือว่าหลุดแล้ว ห้ามใช้ซ้ำที่อื่น
4. วัน reset weekly task (จันทร์?)
5. UI ไทยล้วน vs สลับไทย/อังกฤษสำหรับ vet
6. โมเดลเกม: HP ลดได้ vs แต้มบวกอย่างเดียว
7. ชื่อ branch: `v2-multiuser` (เสนอ)
8. รายชื่อธีมที่จะมีให้เลือก (นอกจาก default พาสเทลสว่าง) — ตัดสินใจตอนถึง Phase 3

---

## 7. ข้อควรระวัง

- **ห้าม** ฝัง service key / password ในโค้ด (บทเรียนจาก V1 ที่รหัสอยู่ใน repo public)
- ช่วง dual-run ห้ามแก้ข้อมูลสองที่ — ระบบเดิมคือ source of truth จนถึงวินาที cutover
- ไฟล์ JSON เดิม = backup ถาวร อย่าลบ (อยู่ใน git history เสมอ)
- ทดสอบทุก checkpoint บน**มือถือจริง** ไม่ใช่แค่ desktop
- ช่วงค่าปกติผลเลือด (labConfig min/max) ควรให้สัตวแพทย์ยืนยัน — ติดค้างจาก V1

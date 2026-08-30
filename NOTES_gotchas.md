# 🪤 Tammie Care V2 — บันทึกกับดัก + เหตุผลการตัดสินใจ (handoff)

ไฟล์นี้จดสิ่งที่ **ไม่ได้อยู่ในโค้ดตรง ๆ** — บั๊กที่เจอ, กับดักที่กินเวลา, และเหตุผลเบื้องหลังการตัดสินใจ
เพื่อให้แชตใหม่/คนใหม่ไม่ต้องเจอซ้ำ · อ่านคู่กับ `TAMMIE_CARE_V2_PLAN.md` (แผนหลัก)

---

## ⚡ กับดักที่เจอบ่อย (เจอซ้ำแน่ถ้าไม่รู้)

### 1. แคช JS/HTML ค้าง — อาการ "แก้แล้วไม่เปลี่ยน"
- `theme.css` และ `lib.js` ติด `?v=NN` cache-bust แล้ว — **แก้ CSS/lib ต้อง bump เลข `?v=` ทุกไฟล์** · **เลขปัจจุบัน = 41** (`sed -i '' 's/theme.css?v=41/theme.css?v=42/g; s/lib.js?v=41/lib.js?v=42/g' app/*.html`)
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

### 7. ⚠️ SMTP ในตัวของ Supabase free จำกัดหนัก — วางแผนก่อนเปิดใช้จริง
- เมลยืนยัน/รีเซ็ตรหัส ของ Supabase built-in ส่งได้ **~2-3 เมล/ชั่วโมง** เท่านั้น + เป็นแค่สำหรับ dev/ทดสอบ (Supabase บอกเองว่าห้ามใช้ production)
- **ระหว่างเทสตอนนี้:** ปิด Confirm email (Authentication → Providers → Email) ไว้ → สมัครอีเมลปลอมได้เลย ใช้งานทันที ไม่ติดโควตา
- **ก่อนเปิดใช้จริง / ทำระบบขอเข้าครอบครัว** ต้องเลือกทางใดทางหนึ่ง:
  - **Google OAuth** (แนะนำสุดสำหรับ use case นี้) — ไม่ต้องส่งเมลเลย, ไม่ติดโควตา SMTP, คนในครอบครัวล็อกอินด้วย Gmail ที่มีอยู่, ปลอดภัยกว่ารหัสผ่าน, ได้อีเมลจริงมาโชว์ตอน admin approve พอดี
  - **ต่อ custom SMTP** — Authentication → SMTP Settings: Resend (ฟรี 3,000/เดือน, เซ็ตง่ายสุด) / Brevo (300/วัน) / Mailgun / SendGrid
- ⚠️ Magic link / OTP **ก็ติดโควตา SMTP เดียวกัน** — ไม่ช่วยแก้ปัญหานี้

### 8. dialog ทุกตัวเป็นกล่องของเราเอง "🐾 Tammie says" (12 ส.ค. 2026, ขยาย confirm/prompt วันเดียวกัน)
- `lib.js` ทำกล่องเอง แทน alert/confirm/prompt ของเบราว์เซอร์ (ที่บังคับหัวข้อเป็นชื่อโดเมน `...workers.dev says` เปลี่ยนไม่ได้)
- **`window.alert` ถูกทับ** — ทุก `alert()` เดิมได้กล่องใหม่ทันที ไม่ต้องแก้ call site · มีคิวในตัว · **ไม่บล็อก** (โค้ดบรรทัดถัดไปทำงานต่อทันที)
  → เขียน `alert()` ใหม่ **ห้ามมีโค้ดที่ต้อง "รอผู้ใช้รับทราบก่อน" ต่อท้าย**
- **`TC.confirm(msg, {okLabel, danger})` / `TC.prompt(msg, default)` คืน Promise** — ทุก call site แปลงเป็น `await` แล้ว (family/index/pet รวม ~24 จุด) · ฟังก์ชัน/handler ที่หุ้มต้องเป็น `async`
  → ⚠️ **เพิ่มที่เรียก confirm/prompt ใหม่ ต้อง `async` + `await` เสมอ** ไม่งั้น Promise เป็น truthy ตลอด (`if (confirm(...))` จะจริงเสมอ)
  → `TC.confirm` คืน `true/false` · `TC.prompt` คืน `string`/`null` (กด ยกเลิก/Esc/คลิกนอก) — semantics เหมือน native เดิม แปลงแล้วไม่ต้องแก้ logic รอบข้าง
- ปิดด้วยปุ่ม / Enter (ตกลง) / Esc / คลิกนอกกล่อง · CSS อยู่ที่ `.tc-alert` + `.tc-ask-input` ใน `theme.css`

### 9. `input[type=date]` ยื่นล้นกล่องบน iOS Safari (12 ส.ค. 2026)
- iOS เรนเดอร์ช่องวันที่เป็น **คอนโทรลเนทีฟที่มีความกว้างขั้นต่ำของตัวเอง** → สั่ง `width: 100%` อย่างเดียวเอาไม่อยู่ กล่องยื่นล้นการ์ดออกไปทางขวา (บน desktop ปกติดี เห็นเฉพาะมือถือ)
- ต้องเพิ่ม `-webkit-appearance: none` + `min-width: 0` + `max-width: 100%` ด้วย · และ iOS จัดค่าในช่อง**กึ่งกลาง**โดยดีฟอลต์ ต้องสั่ง `text-align: left` + `::-webkit-date-and-time-value { text-align: left }` ให้ตรงกับช่องอื่น
- แก้เป็น rule กลางที่ `input[type=date]` ใน `theme.css` แล้ว — ช่องวันที่ใหม่ที่เพิ่มทีหลังได้ทันทีไม่ต้องแก้ซ้ำ (ตอนนี้มี 3 จุด: วันเกิดในโปรไฟล์ · วันที่การรักษา · วันที่ตรวจในผลเลือด)
- 📌 **บทเรียน: ทดสอบฟอร์มบนมือถือจริงเสมอ** — คอนโทรลเนทีฟ (date/select/file) หน้าตาและขนาดต่างจาก desktop มาก

### 10. หน้าสรุป: core (มีเสมอ) + custom (สร้างเอง) · leuco/tumor แสดงเฉพาะน้องที่มีข้อมูลเดิม (12 ส.ค. 2026)
- `pet.html` แยก section หน้าสรุปเป็น 2 กลุ่ม: **`SUMMARY_CORE`** (danger/watch — มีเสมอ ลบไม่ได้) และ **`SUMMARY_TEMPLATES`** (leuco/tumor)
- **สัตว์ใหม่เห็นแค่ danger + watch** · อยากได้หัวข้ออื่นให้ user สร้างเอง (➕ เพิ่มหัวข้อแบบลิสต์/กราฟ = custom) — **ไม่มีปุ่ม "เพิ่มเทมเพลต leuco/tumor" แล้ว** (เอาออกตามคำขอ: อะไรนอกเหนือ default ให้ user สร้างเอง)
- leuco/tumor **แสดงเฉพาะน้องที่มีข้อมูลเดิม** (`templateOn` = `hasData` เป็นหลัก · เฟ่/เฟ่อมี leucoPlus/liverTumor อยู่แล้ว จึงโชว์อัตโนมัติ ไม่ต้อง migrate) และ **ลบได้** (🗑 ใน ⚙️ ปรับหน้าสรุป → ถอดจาก `display.builtins` + ล้างข้อมูลตาม `clearPath`/`clearValue`)
- `display.builtins[]` ยังอยู่ในโค้ด (เผื่ออนาคต) แต่ตอนนี้ไม่มี UI เขียนค่าลงไปแล้ว — presence มาจาก `hasData` ล้วน ๆ
- `leucoBox` ทำ `const lp = d.leucoPlus || {}` (กันพังถ้าไม่มีข้อมูล)

### 11. หมวดอาการประจำวัน เพิ่ม/ลบ/เปลี่ยนสีเองได้ (12 ส.ค. 2026)
- หมวดเก็บใน **`data.display.tabs = [{source, label, color}]`** · `dailyCats(d)` อ่าน+เติม `SYM_COLOR_MAP` (side effect) ให้ `symColor()` ใช้ทั้งหน้า · `SYM_COLORS`/`SYM_LABELS` เดิมเหลือเป็น fallback เฉยๆ
- UI: ปุ่ม "⚙️ จัดการหมวด" ในแท็บอาการ → `toggleCatCfg()` (แถวละ: `<input type=color>` + ชื่อ + 🗑) · หมวดใหม่ได้ `source = 'cat_xxxxx'`
- ⚠️ **`display.tabs` อาจมี entry `source:'treatments'` ปนอยู่** (ของเก่า) — ตอนบันทึกต้อง filter หมวดอาการออกมาแก้ แล้ว **ผูก entry treatments กลับคืน** ไม่งั้นหาย
- ⚠️ ลบหมวด = เขียน `symptoms` ทั้งก้อนกลับโดยลบ key นั้น (ไม่ใช่ set `[]`) — เพราะ `dailyCats` union จะดึง key ที่มี array ว่างกลับมาโชว์ (แก้แล้วให้ union เช็ก `.length` ด้วย เป็นกันชนอีกชั้น)
- `<input type=color>` คืนค่า `#rrggbb` เสมอ — เก็บตรงๆ ได้ ไม่ต้องแปลง
- **น้องใหม่มี "อาการทั่วไป" (general) ให้อัตโนมัติ** — `dailyCats()` คืนอย่างน้อย 1 หมวดเสมอ (ถ้าไม่มี tabs/ไม่มีบันทึกเลย) เพื่อให้ลงบันทึกได้ทันทีโดยไม่ต้องสร้างหมวดก่อน · เปลี่ยนสี/เพิ่มหมวดทีหลังได้ผ่าน ⚙️ จัดการหมวด (`pickCats` เลยตัด fallback เดิมที่โชว์ทั้ง 4 หมวดออก)

### 15. Health Timeline — `timeline.html` (รายงานสุขภาพ + PDF) (13 ส.ค. 2026)
- ไฟล์แยก **`app/timeline.html?id=<pet>`** — เข้าจากปุ่ม "📄 รายงาน" หัวหน้า pet · โหลด pet ผ่าน `TC.getPet` (RLS คุม parent+vet)
- รวมทุกเหตุการณ์มีวันที่: น้ำหนัก · อาการ (ทุกหมวด) · การรักษา · **ผลเลือด (บอกแค่ชื่อหมวด ไม่โชว์ค่า)** · จัดกลุ่มตามวัน เรียงใหม่→เก่า · ช่วง 7/30/60/365 วัน/กำหนดเอง (default 30 วัน · มีปุ่ม 2 เดือน=60 ให้เลือก) · น้ำหนัก "จาก→ถึง" ในช่วง
- **รูปกดดูได้** — thumbnail (`.tl-thumb`) ขอ signed URL ทีละใบ (`attachPhotos` ผูกกล่องด้วย `e._i` = index ใน all ที่ sort แล้ว) · คลิก → lightbox (reuse `.lightbox` ใน theme.css) · โหลดเสร็จก่อนกด print = ติดไปใน PDF ด้วย
- **PDF = `window.print()` + `@media print`** (ซ่อน header/controls, โชว์ `.print-head`) — ผู้ใช้กด "Save as PDF" เองในเมนู print · ฟอนต์ไทยตรง ไม่ต้องมี library
- **เป็น entry point ใหม่** — ติด `?v=` ไม่ได้ (hard refresh) · แต่ **ไม่ได้แก้ theme.css/lib.js เลย จึงไม่ต้อง bump `?v=`** (ยังชี้ v เดิม) · timeline.html อยู่ใน `app/` → wrangler เสิร์ฟให้อยู่แล้ว
- **ไม่ import ฟังก์ชันจาก pet.html** — timeline.html มี catInfo/treatLabel/SYM_* ของตัวเอง (ถ้าเพิ่มหมวด/สีใหม่ใน pet.html ต้องซิงก์ default ที่นี่ด้วย ถ้าจะให้ตรง)
- เทียบช่วงวันด้วย string ISO (`>=from && <=to`) — ได้เพราะ `YYYY-MM-DD` เรียงตามตัวอักษร = เรียงตามเวลา

### 14. รวมปฏิทิน — แท็บ "🗓️ ปฏิทิน" เดียว แทน อาการ+การรักษา (13 ส.ค. 2026)
- แท็บ `daily` + `treat` **ถูกยุบเป็น `calendar`** ใน `TABS` + dispatch · `renderDaily`/`renderTreat` ถูกลบทิ้ง เหลือ **`renderCalendar()`** ตัวเดียวรวม events อาการ+การรักษาบน `buildCalendar` เดียว (key `'calendar'`)
- **presentation merge — ไม่ยุบ data**: อาการยังอยู่ `symptoms[หมวด][]` · การรักษายังอยู่ `treatments[]` · ฟอร์มแยกเหมือนเดิม (`openSymForm` / `openTreatForm`)
- **"หาหมอ" = หมวดพิเศษ** source `'treat'` (const `TREAT_SRC`) · สีเก็บที่ **`display.treatColor`** (ไม่ยุ่ง treatments data) · recolor ได้ · **ลบ/แก้ชื่อไม่ได้**
- helper ที่ share (openSymForm/saveSymptom/delSymptom/openTreatForm/delTreat) เดิมชี้ `showTab('daily'/'treat')` → **แก้เป็น `'calendar'` หมดแล้ว** · `setCalFocus`/`buildCalendar` key ก็ใช้ `'calendar'`
- ⚠️ **ลบหมวดอาการ = ย้ายบันทึกไป general (อาการทั่วไป) ไม่ลบทิ้ง** (`moveSet` ใน `toggleCatCfg`) · `general` + `treat` ลบไม่ได้ (general = ปลายทาง fallback) · ถ้าย้ายแล้วไม่มี general ในลิสต์ จะเติมให้อัตโนมัติ
- นัดหมาย (`appts`) **ยังแยกแท็บเหมือนเดิม** (อดีต vs อนาคต คนละงาน)
- **สี default**: อาการทั่วไป (general) = ฟ้า `#5b8def` · หาหมอ (treat) = เขียว `#5fa57f` (`treatColor` fallback) · `dailyCats` การันตี general อยู่ในลิสต์เสมอ (default + ปลายทาง fallback)
- **หาหมอแก้ชื่อได้** — เก็บ `display.treatLabel` (default 'หาหมอ') · `treatLabel(d)` ใช้ที่ legend + ปุ่ม 🏥 · ในตัวจัดการหมวด แถวหาหมอ = สี+ชื่อแก้ได้ (ลบไม่ได้) แทรก**ต่อจากอาการทั่วไป** (render หลัง row ที่ locked=general)
- `actionsHTML`/`wireActions`/`drawFlow` ยังใช้อยู่ (meds/appts/renderCalendar) — ไม่ได้ลบ

### 13. บันทึกน้ำหนัก — section กราฟในหน้าสรุป (default on, ซ่อนได้) (13 ส.ค. 2026)
> อัปเดต: หัวโปรไฟล์โชว์ **"น้ำหนักล่าสุด" เป็นข้อความเฉยๆ** (กดไม่ได้) · เอาปุ่ม ✎ บันทึก + `logWeight` ออกแล้ว · บันทึก/แก้น้ำหนักไปทำที่กราฟ ⚖️ ในหน้าสรุป
- น้ำหนักเก็บใน **`data.vitals.weight = [{date, size, note}]`** (โครงเดียวกับกราฟก้อนในตับ) · ใช้ `weightChart(d)` = `genericGraphBox` savePath `['vitals','weight']`
- section "⚖️ น้ำหนัก (kg)" อยู่ใน `getSections` **เสมอ (default on ทุกตัว)** แต่ **ซ่อนได้** ผ่าน ⚙️ ปรับหน้าสรุป (untick → เข้า `display.hidden`) · ลบถาวรไม่ได้ (ไม่ใช่ custom/template) — แค่ซ่อน ข้อมูลไม่หาย · ไม่มีข้อมูลก็ไม่พัง (กราฟโชว์ "ยังไม่มีค่าที่วัดได้")
- หัวโปรไฟล์โชว์ "⚖️ น้ำหนักล่าสุด X kg" **เฉพาะเมื่อมีข้อมูล + section ไม่ถูกซ่อน** · แตะ → `logWeight()` ไปหน้าสรุปเปิดฟอร์มบันทึกเลย (guard ว่า `form-weight` มีอยู่)
- ⚠️ header อัปเดตตอน `renderHeader()` (โหลดหน้า) เท่านั้น — บันทึกน้ำหนักใหม่แล้วเลข "ล่าสุด" ที่หัวจะสดตอนรีเฟรช/เปิดหน้าใหม่ (กราฟในสรุปสดทันที)

### 12. หน้าสรุป: ไฟเตือนจากค่าผลเลือด (custom type 'alert') — เลือกค่าตรวจตัวไหนก็ได้ (13 ส.ค. 2026)
- section หน้าสรุปเพิ่มชนิดที่ 3: **`custom[id] = {type:'alert', title, sourceKey, sourceLabel, direction, danger, warn, rules[]}`** (นอกจาก list/graph เดิม) · ปุ่ม "🚦 เพิ่มไฟเตือนจากค่าผลเลือด" ใน ⚙️ ปรับหน้าสรุป
- **generalize ของ Leuco Plus** — Leuco เดิม (`SUMMARY_TEMPLATES.leuco`) ยัง**ล็อก WBC** ไว้ (เฟ่ใช้อยู่ ไม่แตะ) · ตัวใหม่นี้ผูกกับค่าผลเลือด **ตัวไหนก็ได้** (เลือกจาก `labValueOptions(d)` = keys จาก labConfig + labs)
- `direction`: `below` = ค่ายิ่งต่ำยิ่งอันตราย (เช่น WBC) · `above` = ค่ายิ่งสูงยิ่งอันตราย (เช่น ค่าตับ/ไต) · เทียบ `danger`(🔴)/`warn`(🟡) แล้วโชว์กล่อง `.leuco-box` สีตามระดับ (reuse CSS เดิม)
- ลบได้เหมือน custom อื่น (🗑 ในหน้าปรับสรุป → `delCustom`) · แก้เกณฑ์ผ่าน `editCustomAlert(id)` (openForm)
- flow เพิ่ม: prompt ชื่อ → สร้างโครงเปล่า `sourceKey:''` → เปิด `editCustomAlert` ให้เลือกค่า+ตั้งเกณฑ์ทันที (ถ้ายังไม่เลือกค่า กล่องโชว์ "ยังไม่ได้เลือกค่าผลเลือด")

---

## 🧭 เหตุผลการตัดสินใจสำคัญ (ทำไมทำแบบนี้)

| เรื่อง | ตัดสินใจ | เหตุผล |
|---|---|---|
| เก็บข้อมูลสัตว์ | `pets.data` เป็น **jsonb ก้อนเดียว** (โครง JSON เดิมทั้งก้อน) | migrate จาก V1 ได้ครบไม่ตกหล่น + port โค้ดเรนเดอร์เดิมได้เกือบหมด · แลกกับว่าโหลดทั้งก้อนทุกครั้ง (ยังไม่เป็นปัญหา) · ถ้า labs โตเป็นพันค่อยแตกตาราง |
| ความปลอดภัย | **RLS/RPC ที่ DB เป็นตัวคุมจริง** ไม่ใช่ซ่อนปุ่มใน JS | ต่อให้ยิง API ตรงข้าม UI ก็ไม่ผ่าน · ปุ่มที่ซ่อน = UX เท่านั้น |
| การเขียนข้อมูล | RPC `set_pet_path` (แก้เฉพาะ path) ไม่ส่ง data ทั้งก้อน | กันสองคนเปิดหน้าค้างแล้วบันทึกทับกันจนข้อมูลอีกฝ่ายหาย |
| โปรไฟล์สัตว์/เพิ่มสัตว์ | **admin เท่านั้น** (RPC `set_pet_profile` + `create_pet` เช็ก `is_family_admin`) | ผู้ใช้ขอไว้ · edit แก้ข้อมูลสุขภาพได้แต่ไม่แตะโปรไฟล์/เพิ่มลบสัตว์ |
| ลบสัตว์ / ลบหมวดผลเลือด | เตือนหลายชั้น + พิมพ์ชื่อยืนยัน + **ลบรูปใน Storage ด้วย** | ข้อมูลสุขภาพหลายปีมีค่า · กันลบพลาด · ไม่ให้เหลือไฟล์กำพร้า |
| ค่าผลเลือด `< >` และ `,` | เก็บเป็น string, `parseLabVal` แยก op+ตัวเลข + **ตัด comma หลักพันทิ้ง** (`1,000` → 1000) | เครื่องนับไม่ได้ (เช่น `>2000`) ต้องคิดเกณฑ์อันตรายจากเครื่องหมาย + พล็อตกราฟที่ตัวเลข · comma ทำ `Number()` เป็น NaN กราฟหาย (13 ส.ค. 2026) — ทุกที่ที่แปลงค่าผลเลือดเป็นเลข **ต้องผ่าน `parseLabVal` เท่านั้น** ห้ามใช้ `Number(values[key])` ตรงๆ (leuco/🚦 alert แก้แล้ว) |
| เทมเพลตผลเลือด | ฝังใน `LAB_TEMPLATES` (โค้ด) — CBC 18 / เคมี 22 | ค่าเยอะ พิมพ์เองลำบาก · ติ๊กเพิ่มแล้ว copy เป็นของสัตว์ตัวนั้น แก้อิสระ · เตือนให้เช็กเกณฑ์ปกติ (แต่ละแล็บต่างกัน) |
| หน้าสรุป | section ยืดหยุ่น (built-in + custom ลิสต์/กราฟ) เก็บใน `data.custom` + `display.hidden/order` | น้องแต่ละตัวเน้นไม่เหมือนกัน · สัตว์ใหม่ default = danger+watch |
| ดีไซน์การจัดการ | **✏️ = แก้เนื้อหา · ⚙️ = ตั้งค่า/โครง** · read-only default กด ✏️ ค่อยจัดการ (แท็บสรุป) · content tab แก้ inline | ให้ผู้ใช้เรียนรู้ vocabulary เดียว |
| กล่อง dialog | ทำกล่องเองทั้ง alert/confirm/prompt ที่ `lib.js` (`window.alert` ทับ · `TC.confirm`/`TC.prompt` คืน Promise) | หัวข้อ dialog ของเบราว์เซอร์เป็นชื่อโดเมน เปลี่ยนไม่ได้ · confirm/prompt แลกกับต้อง `await` ทุก call site (ดูกับดักข้อ 8) |
| ฟอร์มเพิ่ม/แก้ผลตรวจ | **ไม่มี dropdown เลือกหมวด** — ฟอร์มเปิดอยู่ในหมวดที่กางเสมอ | ทุกทางเข้าส่ง `panelId` มาให้อยู่แล้ว · เลือกซ้ำ = ช่องเปล่าให้กดผิดหมวด |
| ป้ายฟอร์ม required | **ไม่ใช้ "(เว้นว่างได้)" แล้ว** · ช่องจำเป็น = ดอกจันทร์แดง `*` (ที่เหลือถือว่าไม่บังคับ) | `openForm` field ใส่ `required: true` → เติม `*` อัตโนมัติ (คลาส `.req`) · ฟอร์ม inline (อาการ/ผลเลือด/โปรไฟล์) ใส่ `<span class="req">*</span>` มือ |
| หน้าสรุป section | แยกเป็น **core (danger/watch) มีเสมอ** + **เทมเพลต (leuco/tumor) เลือกเพิ่ม/ลบได้** (เหมือนเทมเพลตผลเลือด) | สัตว์ใหม่ควรเริ่มโล่ง มีแค่ 2 อันหลัก · leuco/tumor เป็นเคสเฉพาะโรค ไม่ใช่ทุกตัวต้องมี |
| หมวดอาการประจำวัน | ผู้ใช้ **เพิ่ม/ลบหมวด + เลือกสีเอง** ได้ (⚙️ จัดการหมวด) เก็บใน `display.tabs = [{source,label,color}]` | น้องแต่ละตัวมีอาการต่างกัน · สี default hardcode ไม่พอ |

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

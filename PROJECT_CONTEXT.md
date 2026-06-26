# Tammie Care — สรุปโปรเจกต์ (สำหรับเริ่มแชตใหม่)

## ภาพรวม
เว็บดูแลสุขภาพสัตว์เลี้ยง (static HTML/JS ล้วน ไม่มี backend) ใช้ JSON เป็น source of truth
- โฟลเดอร์: `~/Documents/TammieCare/tammie-care` (git repo)
- GitHub: `github.com/hommekid/tammie-care` (Public), branch `main`
- Deploy: GitHub Pages → https://hommekid.github.io/tammie-care/
- อนาคต: อาจย้าย Cloudflare Pages + Private repo (ซ่อน GitHub Token ผ่าน serverless function)

## โครงสร้างไฟล์
```
index.html        หน้าแรก: banner หัวเว็บ (img/header.jpg) + การ์ดสัตว์เลี้ยง · การ์ดมี 🔔 + แถบเตือนถ้ามีนัดภายใน 7 วัน (อ่าน appointments จาก data/<id>.json เลยวันนัดเตือนหาย)
pet.html          dashboard ต่อตัวผ่าน ?id=  (แท็บใหญ่ สรุป/ผลเลือด/ติดตามอาการ)
admin.html        หน้าแก้ข้อมูล: รหัสผ่าน + ฟอร์ม (พับได้) + commit ขึ้น GitHub ผ่าน Token
site.webmanifest  ไอคอนแอปตอนเพิ่มลงโฮมสกรีน
PROJECT_CONTEXT.md ไฟล์นี้
data/pets.json    รายชื่อสัตว์ทั้งหมด (การ์ดหน้าแรก + ตัวเลือกใน admin ดึงจากไฟล์นี้)
data/frappe.json  ข้อมูลเฟ่ทั้งหมด (1 ตัว = 1 ไฟล์)
data/wafer.json   ข้อมูลเฟ่อ (เวเฟอร์) — โปรไฟล์/ยา/ผลเลือด/การรักษา/อาเจียน+ท้องเสีย
img/              header.jpg, frappe.jpg, wafer.jpg, favicon-32/180/192/512.png, รูปอาการ/ผลเลือดที่อัปผ่าน admin
```

## โมเดลข้อมูล (data/<id>.json)
- `profile` : name, nickname, emoji, photo, species, breed, birthDate, conditions[], medications[]
- `meds`[] : ยาประจำ — {name, am (โดสเช้า), pm (โดสเย็น), note} · am/pm เป็น string ("1", "65mg", "" ได้)
- `vitals` : `latest` (ค่าตรวจหัวใจ/x-ray/ประสาท), `heartSize`[], `liverTumor`[] (date/size/note/alert)
- `labPanels`[] : นิยามหมวดผลเลือด {id, name} — ปัจจุบัน cbc, chem, cardiac, coag
- `labConfig`[] : นิยามค่าผลเลือดต่อหมวด {panel, key, label, unit, min, max} (min/max = ช่วงปกติ เว้นได้)
- `labs`[] : ผลตรวจแต่ละครั้ง {date, panel, values:{key:number}, note} (1 record = 1 ใบ/หมวด/วัน)
- `symptoms`: `nosebleed`[] (date/side/detail), `diarrhea`[] (date/detail/photos[]), `general`[] (date/detail/photos[]), `vomiting`[] (date/detail/photos[] — อาเจียน, เฟ่อใช้) · เพิ่ม key อาการใหม่ได้ แล้วผูกเป็นแท็บผ่าน `display.tabs`
- `treatments`[] : {date, entries:[{doctor, specialty, notes}]}
- `appointments`[] : ตารางนัดหมาย {date, doctor (หมอ/การตรวจ), note} — เรียงตามวันที่ (เฟ่+เฟ่อ)
- `dangerSigns`, `watchList`
- `leucoPlus` : {alwaysBelow, withSymptomsBelow, wbcInThousands(=false ตอนนี้ WBC เก็บเป็นค่าดิบ), rules[]}
- `display` (optional ต่อตัว): `hidden`[] (section ที่ซ่อน — เฟ่ซ่อน "stats"), `order`[], `dashGroups`[], `calendar`{source,title}, `tabs`[], `stats`[]

## หน้า dashboard (pet.html)
- จัดเป็น **แท็บใหญ่** (display.dashGroups): **สรุป** / **💊 ยา** / **ผลเลือด** / **ติดตามอาการ** / **📅 นัดหมาย**
- section keys: stats, leuco, meds, labs, danger, watch, calendar, tumor, tabs, appts (ซ่อน section ที่ไม่มีข้อมูลอัตโนมัติ)
- **สรุป**: leuco (ไฟเตือน Leuco Plus เทียบ WBC ดิบ 🔴<4000/🟡4000-4499/🟢≥4500), สัญญาณอันตราย, สิ่งที่ต้องติดตาม, **กราฟก้อนในตับ (ล่างสุด)** · (stats ถูกซ่อน)
- **💊 ยา**: ตารางยาประจำเต็ม (ยา/เช้า/เย็น/หมายเหตุ) โชว์หมด ไม่พับ
- **ผลเลือด**: แต่ละหมวด (CBC/เคมี/Cardiac/Coag) เป็นแถบพับได้ **default หุบหมด** หัวแถบโชว์ "⚠️ X ค่าผิดปกติ / ✓ ปกติ"; กางเห็นการ์ดค่าล่าสุด (แดงถ้าผิดปกติ + วงเล็บช่วงปกติ) + กราฟแนวโน้มเลือกค่าได้ · เฉพาะ CBC+เคมี มี "ตารางสรุปทุกวันที่" พับได้ใต้กราฟ (10 ครั้ง/หน้า มีปุ่มแบ่งหน้า) · ค่า 0.00 = แสดงว่าง
- **ติดตามอาการ**: มี 2 เมนูหลัก (แท็บ 2 ระดับ) → **การรักษา** (มีทุกตัว) / **อาการประจำวัน** (รวมอาการอื่นๆ ทั้งหมด)
  - **การรักษา** = ปฏิทิน (จุด/กรอบสีทอง) · จิ้มวันมีการรักษา → กล่องรายละเอียดขึ้นข้างๆ (หมอ—แผนก+บันทึก แต่ละ entry) · ใต้ปฏิทินมีรายการย้อนหลังแบบกดขยาย
  - **อาการประจำวัน** = ปฏิทินเดียวรวมทุกอาการ · แต่ละวันมีจุดสีเล็กๆ ตามชนิด (ท้องเสีย=ส้ม #d98a3d / อาการทั่วไป=น้ำเงิน #5b8def / เลือดกำเดา=แดง #e85555 / อาเจียน=ม่วง #b06be8 · กำหนดใน `SYM_COLORS`) วันมีหลายอาการ=หลายจุด + legend · จิ้มวัน → กล่องรายละเอียดโชว์**ทุกอาการของวันนั้น** แยกการ์ดตามชนิด (เลือดกำเดาบอกรูจมูกซ้าย/ขวา) · ท้องเสีย/อาการทั่วไป/อาเจียน มีรูปกดดู lightbox
  - ทั้ง 2 ปฏิทิน: รายการย้อนหลังใต้ปฏิทิน**โชว์เฉพาะเดือนที่เลือก** (เปลี่ยนตามปุ่ม ‹ ›) · กล่องรายละเอียด**ตีกรอบ+เงา**แยกชัดจากประวัติ · จิ้มวันเดิมซ้ำ = **toggle ซ่อน** · ใช้ id แยกกัน (txCal* / dyCal*) ไม่ชนกัน
  - ฟังก์ชันหลัก: `renderTreatments`/`drawTxMonth`/`showTxDetail` · `renderDailyCalendar`/`drawDailyMonth`/`showDailyDetail` · daily มาจาก `display.tabs` ทุกตัวที่ source≠treatments
- **📅 นัดหมาย**: การ์ดเรียงตามวันที่ — นัดที่จะถึงโชว์ก่อน (กรอบทอง = ภายใน 7 วัน, กรอบแดง = วันนี้) badge "อีก X วัน/วันนี้/พรุ่งนี้" · นัดที่ผ่านมาพับใน `<details>`
- footer: Tammie Care · หน้าแรก · จัดการข้อมูล

## หน้า admin (admin.html)
- GitHub Token + เลือกสัตว์เลี้ยง = โชว์ตลอด · **ตัวเลือกสัตว์ดึงจาก pets.json อัตโนมัติ** (เพิ่มตัวใหม่ใน pets.json แล้วขึ้นเอง) · section อื่นเป็น **ยืด-หุบ (default หุบ)**:
  - เพิ่มบันทึก (แท็บ: เลือดกำเดา/ท้องเสีย/🤢 อาเจียน/อาการทั่วไป/🧪 ผลเลือด/ค่าตรวจ/การรักษา/📅 นัดหมาย) · ท้องเสีย+อาเจียน+อาการทั่วไปแนบรูปได้ · นัดหมาย = วันที่+หมอ/การตรวจ+หมายเหตุ (แก้/ลบได้ในเมนู "แก้ไข/ลบ รายการเดิม")
  - มี guard กันพังเมื่อสัตว์ตัวนั้นยังไม่มี structure (เช่น เฟ่อไม่มี vitals/nosebleed/liverTumor) — จะสร้างให้อัตโนมัติเมื่อบันทึก
  - ผลเลือด: เลือกหมวด→กรอกค่าตาม labConfig · เพิ่มหมวดใหม่ · เพิ่ม/ลบพารามิเตอร์ (key/ชื่อ/หน่วย/ช่วงปกติ)
  - ขนาดก้อนในตับ
  - 💊 ยาประจำ: เพิ่ม/แก้/ลบ ยา (ชื่อ/เช้า/เย็น/หมายเหตุ) — ทำงานแล้ว
  - แก้ไข/ลบ รายการเดิม: เลือกหมวด (รวมผลเลือด)→เลือกวันที่→แก้/ลบ (มียืนยัน)
  - เกณฑ์ฉีด Leuco Plus
  - ตั้งค่าหน้า Dashboard (ซ่อน/จัดลำดับ section)
- footer: Tammie Care · หน้าแรก
- ทุกการบันทึก commit ขึ้น GitHub ผ่าน Token → Pages rebuild ~1 นาที · error เด้ง popup ชัดเจน

## ค่าตั้งสำคัญ (admin.html CONFIG)
- password: `richie2407`  (รหัสเข้า admin — แก้ที่ CONFIG)
- owner: hommekid, repo: tammie-care, branch: main
- GitHub Token: กรอกเองตอนใช้ (ไม่ฝังในโค้ด) ต้องมีสิทธิ์ Contents: Read and write

## วิธีเพิ่มข้อมูล
- แก้ผ่าน admin.html (กรอก Token) → commit อัตโนมัติ → รอ Pages build ~1 นาที + hard refresh
- ผลเลือดใบใหม่: โยนรูป/PDF ให้ Claude อ่าน แล้วใส่เข้า labs ได้ หรือกรอกมือในแท็บผลเลือด
- เพิ่มสัตว์ใหม่: สร้าง `data/<id>.json` (โครงเหมือน frappe.json ใส่เฉพาะที่มี) + เพิ่ม entry ใน `data/pets.json`
- รูป: ไฟล์ jpg/png ใน `img/` (HEIC เปิดบนเว็บไม่ได้ ต้องแปลงเป็น jpg ก่อน)

## ข้อมูลผลเลือดที่ใส่แล้ว (เฟ่)
- CBC 8 ครั้ง (10/25 ม.ค., 3/16/24 ก.พ., 30 พ.ค., 14/20 มิ.ย.) · เคมี 5 ครั้ง (10 ม.ค., 24 ก.พ., 30 พ.ค., 14/20 มิ.ย.)
- Cardiac 2 (14 มิ.ย. Troponin 0.31 ผิดปกติ · 20 มิ.ย. Troponin 0.07 ปกติ) · Coagulation 1 (20 ม.ค.)
- ล่าสุด 20 มิ.ย.: WBC 3,310 (Leuco Plus 🔴), ซีดลง (RBC/HGB/HCT ต่ำ), ALP 450/ALT 73 สูง
- ยาประจำ 19 รายการ · นัดหมาย 6 รายการ

## ข้อมูลเฟ่อ (wafer) ที่ใส่แล้ว
- โปรไฟล์: Golden Retriever เกิด 6 ส.ค. 2015 · conditions: ก้อนตับ/ม้าม, Histiocytoma หน้าอก (ตัดแล้ว), สงสัยท่อน้ำเหลืองอักเสบ/โปรตีนต่ำ
- ยาประจำ 5 รายการ · CBC 4 ครั้ง + เคมี 4 ครั้ง (24 ก.พ. / 2 พ.ค. / 30 พ.ค. / 20 มิ.ย. 2026) — labConfig/labPanels ใช้ค่าอ้างอิง VetCal เหมือนเฟ่
- ล่าสุด 20 มิ.ย.: โปรตีนยังต่ำ (Albumin 2.0, Total Protein 4.5), WBC/LYM ต่ำ
- การรักษา 4 รายการ · อาเจียน 6 · ท้องเสีย 6 · นัดหมาย 5 รายการ · display.tabs = การรักษา/🤢 อาเจียน/ท้องเสีย (ไม่มีเลือดกำเดา/Leuco/ก้อนกราฟ)

## เรื่องที่ยังค้าง / อาจทำต่อ
- ย้าย Cloudflare Pages + Private repo + ซ่อน Token ผ่าน serverless
- เพิ่มสัตว์ตัวอื่น (Waffle/เฟิล, แมว) — เฟ่อ (Wafer) เพิ่มแล้ว
- ช่วงค่าปกติผลเลือดดึงจากใบ lab — ควรให้สัตวแพทย์ยืนยัน
- favicon บน Safari iOS ยังไม่ขึ้น (ใส่ `?v=2` cache-bust ไว้แล้ว ยังไม่จบ) — pending

## ข้อควรระวัง
- repo เป็น Public → ห้ามฝัง Token/รหัสในโค้ด
- ต้องเปิดผ่าน http/https (เช่น GitHub Pages) ไม่ใช่ double-click ไฟล์ (file://) เพราะใช้ fetch โหลด JSON

# Tammie Care — สรุปโปรเจกต์ (สำหรับเริ่มแชตใหม่)

## ภาพรวม
เว็บดูแลสุขภาพสัตว์เลี้ยง (static HTML/JS ล้วน ไม่มี backend) ใช้ JSON เป็น source of truth
- โฟลเดอร์: `~/Documents/TammieCare/tammie-care` (git repo)
- GitHub: `github.com/hommekid/tammie-care` (Public), branch `main`
- Deploy: GitHub Pages → https://hommekid.github.io/tammie-care/
- อนาคต: อาจย้าย Cloudflare Pages + Private repo (ซ่อน GitHub Token ผ่าน serverless function)

## โครงสร้างไฟล์
```
index.html        หน้าแรก: banner หัวเว็บ (img/header.jpg) + การ์ดสัตว์เลี้ยงกดเข้า dashboard
pet.html          dashboard ต่อตัวผ่าน ?id=  (แท็บใหญ่ สรุป/ผลเลือด/ติดตามอาการ)
admin.html        หน้าแก้ข้อมูล: รหัสผ่าน + ฟอร์ม (พับได้) + commit ขึ้น GitHub ผ่าน Token
site.webmanifest  ไอคอนแอปตอนเพิ่มลงโฮมสกรีน
PROJECT_CONTEXT.md ไฟล์นี้
data/pets.json    รายชื่อสัตว์ทั้งหมด
data/frappe.json  ข้อมูลเฟ่ทั้งหมด (1 ตัว = 1 ไฟล์)
img/              header.jpg, frappe.jpg, favicon-32/180/192/512.png, รูปอาการ/ผลเลือดที่อัปผ่าน admin
```

## โมเดลข้อมูล (data/<id>.json)
- `profile` : name, nickname, emoji, photo, species, breed, birthDate, conditions[], medications[]
- `meds`[] : ยาประจำ — {name, am (โดสเช้า), pm (โดสเย็น), note} · am/pm เป็น string ("1", "65mg", "" ได้)
- `vitals` : `latest` (ค่าตรวจหัวใจ/x-ray/ประสาท), `heartSize`[], `liverTumor`[] (date/size/note/alert)
- `labPanels`[] : นิยามหมวดผลเลือด {id, name} — ปัจจุบัน cbc, chem, cardiac, coag
- `labConfig`[] : นิยามค่าผลเลือดต่อหมวด {panel, key, label, unit, min, max} (min/max = ช่วงปกติ เว้นได้)
- `labs`[] : ผลตรวจแต่ละครั้ง {date, panel, values:{key:number}, note} (1 record = 1 ใบ/หมวด/วัน)
- `symptoms`: `nosebleed`[] (date/side/detail), `diarrhea`[] (date/detail/photos[]), `general`[] (date/detail/photos[])
- `treatments`[] : {date, entries:[{doctor, specialty, notes}]}
- `dangerSigns`, `watchList`
- `leucoPlus` : {alwaysBelow, withSymptomsBelow, wbcInThousands(=false ตอนนี้ WBC เก็บเป็นค่าดิบ), rules[]}
- `display` (optional ต่อตัว): `hidden`[] (section ที่ซ่อน — เฟ่ซ่อน "stats"), `order`[], `dashGroups`[], `calendar`{source,title}, `tabs`[], `stats`[]

## หน้า dashboard (pet.html)
- จัดเป็น **แท็บใหญ่ 4 แท็บ** (display.dashGroups): **สรุป** / **💊 ยา** / **ผลเลือด** / **ติดตามอาการ**
- section keys: stats, leuco, meds, labs, danger, watch, calendar, tumor, tabs (ซ่อน section ที่ไม่มีข้อมูลอัตโนมัติ)
- **สรุป**: leuco (ไฟเตือน Leuco Plus เทียบ WBC ดิบ 🔴<4000/🟡4000-4499/🟢≥4500), สัญญาณอันตราย, สิ่งที่ต้องติดตาม, **กราฟก้อนในตับ (ล่างสุด)** · (stats ถูกซ่อน)
- **💊 ยา**: ตารางยาประจำเต็ม (ยา/เช้า/เย็น/หมายเหตุ) โชว์หมด ไม่พับ
- **ผลเลือด**: แต่ละหมวด (CBC/เคมี/Cardiac/Coag) เป็นแถบพับได้ **default หุบหมด** หัวแถบโชว์ "⚠️ X ค่าผิดปกติ / ✓ ปกติ"; กางเห็นการ์ดค่าล่าสุด (แดงถ้าผิดปกติ + วงเล็บช่วงปกติ) + กราฟแนวโน้มเลือกค่าได้ · เฉพาะ CBC+เคมี มี "ตารางสรุปทุกวันที่" พับได้ใต้กราฟ (10 ครั้ง/หน้า มีปุ่มแบ่งหน้า) · ค่า 0.00 = แสดงว่าง
- **ติดตามอาการ**: แท็บย่อย การรักษา / ท้องเสีย / อาการทั่วไป / **เลือดกำเดา** · แท็บเลือดกำเดา = ปฏิทิน (คลิกวันมีจุดสี → กล่องรายละเอียดสีตามรูจมูกขึ้นข้างๆ) + รายการรายวันใต้ปฏิทิน · ท้องเสีย/อาการทั่วไปมีรูปกดดู lightbox
- footer: Tammie Care · หน้าแรก · จัดการข้อมูล

## หน้า admin (admin.html)
- GitHub Token + เลือกสัตว์เลี้ยง = โชว์ตลอด · section อื่นเป็น **ยืด-หุบ (default หุบ)**:
  - เพิ่มบันทึก (แท็บ: เลือดกำเดา/ท้องเสีย/อาการทั่วไป/🧪 ผลเลือด/ค่าตรวจ/การรักษา) · ท้องเสีย+อาการทั่วไปแนบรูปได้
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
- CBC 7 ครั้ง (10/25 ม.ค., 3/16/24 ก.พ., 30 พ.ค., 14 มิ.ย.) · เคมี 4 ครั้ง (10 ม.ค., 24 ก.พ., 30 พ.ค., 14 มิ.ย.)
- Cardiac 1 (14 มิ.ย. Troponin 0.31 ผิดปกติ) · Coagulation 1 (20 ม.ค.)
- ยาประจำ 19 รายการ

## เรื่องที่ยังค้าง / อาจทำต่อ
- ย้าย Cloudflare Pages + Private repo + ซ่อน Token ผ่าน serverless
- เพิ่มสัตว์ตัวอื่น (Wafer, Waffle, แมว) + ยาของ เฟ่อ/เฟิล
- ช่วงค่าปกติผลเลือดดึงจากใบ lab — ควรให้สัตวแพทย์ยืนยัน

## ข้อควรระวัง
- repo เป็น Public → ห้ามฝัง Token/รหัสในโค้ด
- ต้องเปิดผ่าน http/https (เช่น GitHub Pages) ไม่ใช่ double-click ไฟล์ (file://) เพราะใช้ fetch โหลด JSON

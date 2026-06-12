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
pet.html          dashboard ต่อตัวผ่าน ?id=  (สถานะ, กราฟก้อนในตับ, ปฏิทินเลือดกำเดา, แท็บ, lightbox รูป)
admin.html        หน้าแก้ข้อมูล: รหัสผ่าน + ฟอร์มเพิ่ม/แก้/ลบ + commit ขึ้น GitHub ผ่าน Token
site.webmanifest  ไอคอนแอปตอนเพิ่มลงโฮมสกรีน
data/pets.json    รายชื่อสัตว์ทั้งหมด
data/frappe.json  ข้อมูลเฟ่ทั้งหมด (1 ตัว = 1 ไฟล์)
img/              header.jpg, frappe.jpg, favicon-32/180/192/512.png, รูปอาการที่อัปผ่าน admin
```

## โมเดลข้อมูล (data/<id>.json)
- `profile` : name, nickname, emoji, photo, species, breed, birthDate, conditions[], medications[]
- `vitals`  : `latest` (ค่าตรวจล่าสุด เช่น wbc หน่วย ×10³), `heartSize`[], `liverTumor`[] (date/size/note)
- `symptoms`: `nosebleed`[] (date/side/detail), `diarrhea`[] (date/detail/photos[]), `general`[] (date/detail/photos[])
- `treatments`[] : {date, entries:[{doctor, specialty, notes}]}
- `dangerSigns`, `watchList`
- `leucoPlus` : {alwaysBelow:4000, withSymptomsBelow:4500, wbcInThousands:true, rules[]}
- `display` (optional, ตั้งค่าหน้าต่อตัว — ไม่มี = พฤติกรรมเดิมทุกอย่าง):
  - `order`[] : ลำดับ section จาก `stats, leuco, danger, watch, calendar, tumor, tabs` (key ที่ไม่ใส่จะต่อท้ายตามลำดับ default)
  - `hidden`[] : section ที่ซ่อนแม้มีข้อมูล
  - `calendar` : {source:"nosebleed", title:"ปฏิทินเลือดกำเดา"} — source ชี้ key ใน symptoms ตัวไหนก็ได้; ถ้า event ไม่มี field `side` ปฏิทินจะใช้จุดสีแดง "วันที่มีอาการ" แทน legend ซ้าย/ขวา
  - `tabs`[] : [{source:"treatments"|<key ใน symptoms>, label:"..."}] — กำหนดแท็บ+ชื่อเองต่อตัว
  - `stats`[] : [{key, label, note, color:"red|green|gold", check:true}] — override การ์ดค่าตรวจ (note ใส่ `{fieldName}` ดึงค่าจาก vitals.latest ได้, check=true แสดง ✓ + ค่าเป็น note)
- pet.html จะ "ซ่อน section ที่ไม่มีข้อมูลอัตโนมัติ" — ตัวใหม่ที่ข้อมูลไม่ครบก็ไม่พัง

## ฟีเจอร์ที่ทำเสร็จแล้ว
- หน้าแรก: banner รูป (Tammie Care + สโลแกนอยู่ในรูป), การ์ดเฟ่รูปวงกลม
- Dashboard: ไฟเตือน Leuco Plus เทียบ WBC อัตโนมัติ (🔴<4000 / 🟡 4000-4499 / 🟢≥4500),
  กราฟก้อนในตับ (อยู่ขวาของปฏิทิน ขนาดเท่ากัน), ปฏิทินเลือดกำเดาเลื่อนทีละเดือน,
  แท็บ การรักษา/ท้องเสีย/อาการทั่วไป (การรักษากดกางดูรายละเอียด), รูปในอาการกดดูเป็น lightbox
- Admin: เพิ่มบันทึก (เลือดกำเดา/ท้องเสีย/อาการทั่วไป/ค่าตรวจ/การรักษา/ก้อนในตับ/เกณฑ์ Leuco),
  แนบรูป (ย่ออัตโนมัติ อัปขึ้น GitHub), แก้ไข/ลบ รายการเดิม (เลือกหมวด→เลือกวันที่→แก้/ลบ มียืนยัน)
- favicon + เพิ่มลงโฮมสกรีนเป็นแอปได้
- ตั้งค่าหน้า dashboard ต่อตัวผ่าน `display` ใน data/<id>.json (ซ่อน/จัดลำดับ section, ปฏิทิน/แท็บ/การ์ดค่าตรวจ generic) + admin มี UI "ตั้งค่าหน้า Dashboard" (checkbox ซ่อน, ↑↓ จัดลำดับ, ชื่อ+source ปฏิทิน) — tabs/stats แก้ผ่าน JSON

## ค่าตั้งสำคัญ (admin.html CONFIG)
- password: `richie2407`  (รหัสเข้า admin — แก้ที่ CONFIG)
- owner: hommekid, repo: tammie-care, branch: main
- GitHub Token: กรอกเองตอนใช้ (ไม่ฝังในโค้ด) ต้องมีสิทธิ์ Contents: Read and write

## วิธีแก้ข้อมูล / เพิ่มสัตว์ใหม่
- แก้ผ่าน admin.html (กรอก Token) → commit ขึ้น GitHub เอง → Pages rebuild ~1 นาที
- เพิ่มสัตว์ใหม่: สร้าง `data/<id>.json` (โครงเหมือน frappe.json ใส่เฉพาะที่มี) + เพิ่ม entry ใน `data/pets.json`
- รูปโปรไฟล์/หัวเว็บ: ไฟล์ jpg ใน `img/` (เบราว์เซอร์เปิด HEIC ไม่ได้ ต้องแปลงเป็น jpg ก่อน)

## เรื่องที่ยังค้าง / อาจทำต่อ
- ย้าย Cloudflare Pages + Private repo + ซ่อน Token ผ่าน serverless (admin จะไม่ต้องกรอก Token)
- เพิ่มสัตว์ตัวอื่น (Wafer, Waffle, แมว)
- (เคยถาม) สลับ AI model ในแอป Cowork ยังไม่ได้แก้

## ข้อควรระวัง
- repo เป็น Public → ห้ามฝัง Token/รหัสในโค้ด
- ต้องเปิดผ่าน http/https (เช่น GitHub Pages) ไม่ใช่ double-click ไฟล์ (file://) เพราะใช้ fetch โหลด JSON

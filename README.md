# 🐾 Tammie Care

เว็บดูแลสุขภาพสัตว์เลี้ยง — dashboard ต่อตัว, กราฟผลเลือด, ปฏิทินอาการ/การรักษา และหน้าแก้ข้อมูลที่ commit ขึ้น GitHub ให้อัตโนมัติ

เป็น **static HTML/JS ล้วน ไม่มี backend** ใช้ไฟล์ JSON เป็น source of truth
🔗 https://hommekid.github.io/tammie-care/

## โครงสร้าง

```
tammie-care/
├── index.html          หน้าแรก: banner + การ์ดสัตว์เลี้ยง (เตือนนัดภายใน 7 วัน)
├── pet.html            dashboard ต่อตัว ผ่าน ?id=
├── admin.html          หน้าแก้ข้อมูล (มีรหัสผ่าน) → commit ขึ้น GitHub ผ่าน Token
├── site.webmanifest    ไอคอนตอนเพิ่มลงโฮมสกรีน
├── PROJECT_CONTEXT.md  สรุปโปรเจกต์แบบละเอียด (อ่านไฟล์นี้ก่อนเริ่มงาน)
├── DESIGN_SYSTEM.md    design system ธีมพาสเทล (สี/ฟอนต์/รัศมี/เงา)
├── data/
│   ├── pets.json       รายชื่อสัตว์ทั้งหมด
│   ├── frappe.json     ข้อมูลเฟ่ (เฟรปเป้)
│   └── wafer.json      ข้อมูลเฟ่อ (เวเฟอร์)
└── img/                banner, รูปสัตว์, favicon, รูปที่อัปผ่าน admin
```

## หน้า dashboard (pet.html)

แบ่งเป็นแท็บ: **📋 สรุป · 🌡️ อาการประจำวัน · 🏥 การรักษา · 🧪 ผลเลือด · 💊 ยา · 📅 นัดหมาย**
(section ที่ไม่มีข้อมูลจะถูกซ่อนอัตโนมัติ · ปรับได้ต่อตัวผ่าน `display` ใน JSON หรือหน้า admin)

## หน้า admin (admin.html)

แท็บเดียวกับ dashboard + **⚙️ ตั้งค่า** · ทุกหมวดเพิ่ม/แก้/ลบได้ในแท็บของตัวเอง
- อาการประจำวัน + การรักษา = **ปฏิทิน** จิ้มวันเพื่อจัดการรายการของวันนั้น
- แนบรูปได้ (ย่อขนาดให้อัตโนมัติ) · การรักษาแนบ **flowchart (Mermaid)** ได้
- ⚙️ ตั้งค่า: จัดการหมวดอาการประจำวันต่อโปรไฟล์ + ซ่อน/จัดลำดับ section บน dashboard

## ตั้งค่าก่อนใช้

1. แก้รหัสผ่านใน `admin.html` ที่ `CONFIG.password`
2. สร้าง GitHub Token (Settings → Developer settings → Personal access tokens → สิทธิ์ **Contents: Read and write**)
3. กรอก Token ในหน้า admin ทุกครั้งที่จะแก้ข้อมูล (ไม่ถูกบันทึกไว้)

> ⚠️ repo นี้เป็น Public — **ห้าม** commit Token หรือรหัสผ่านลงในโค้ด

## เพิ่มสัตว์เลี้ยงใหม่

1. เพิ่มรายการใน `data/pets.json`
2. สร้าง `data/<id>.json` ตามรูปแบบของ `frappe.json` (ใส่เฉพาะส่วนที่มีข้อมูล)

ตัวเลือกในหน้า admin ดึงจาก `pets.json` อัตโนมัติ ไม่ต้องแก้โค้ดเพิ่ม

## Deploy (GitHub Pages)

Settings → Pages → Source: Deploy from a branch → `main` → Save
หลัง push รอ build ~1 นาที แล้ว hard refresh

> ต้องเปิดผ่าน http/https เท่านั้น (เปิดไฟล์ตรง ๆ แบบ `file://` ไม่ได้ เพราะใช้ `fetch` โหลด JSON)

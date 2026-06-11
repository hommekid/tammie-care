# 🐾 Tammie Care

ระบบดูแลสุขภาพสัตว์เลี้ยง — dashboard, กราฟ, ปฏิทินอาการ และ AI chatbot

## โครงสร้าง

```
tammie-care/
├── index.html      หน้าแรก: รายชื่อสัตว์เลี้ยง
├── pet.html        dashboard (ใช้ร่วมทุกตัว ผ่าน ?id=)
├── admin.html      หน้าแก้ข้อมูล (มีรหัสผ่าน)
├── data/
│   ├── pets.json   รายชื่อสัตว์ทั้งหมด
│   └── frappe.json ข้อมูลเฟ่
└── archive/        backup ไฟล์ md เดิม
```

## การใช้งาน

- **ดูข้อมูล:** เปิด `index.html` → กดการ์ดสัตว์ → เข้า dashboard
- **แก้ข้อมูล:** เปิด `admin.html` → ใส่รหัสผ่าน → กรอกฟอร์ม → อัพขึ้น GitHub อัตโนมัติ

## ตั้งค่าก่อนใช้

1. แก้รหัสผ่านใน `admin.html` ที่ `CONFIG.password`
2. สร้าง GitHub Token (Settings → Developer settings → Personal access tokens → สิทธิ์ Contents: Read and write)
3. กรอก Token ในหน้า admin ทุกครั้งที่จะแก้ข้อมูล

## เพิ่มสัตว์เลี้ยงใหม่

1. เพิ่มรายการใน `data/pets.json`
2. สร้าง `data/[ชื่อ].json` ตามรูปแบบของ `frappe.json`
3. เพิ่ม `<option>` ใน `admin.html` ที่ `petSelect`

## Deploy (GitHub Pages)

Settings → Pages → Source: Deploy from a branch → main → Save

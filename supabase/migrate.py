#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tammie Care V2 — Migrate ข้อมูลจาก data/*.json → Supabase
------------------------------------------------------------------
ใช้ Python 3 ที่ติดมากับ macOS (3.9+) — ไม่ต้อง pip install อะไรเลย

วิธีรัน (จากรากโปรเจกต์):
  export SUPABASE_URL="https://xxxx.supabase.co"
  export SERVICE_KEY="sb_secret_..."        # Secret key — ห้าม commit
  export FAMILY_ID="1230a32a-..."
  python3 supabase/migrate.py --dry-run     # ลองดูก่อน ไม่เขียนอะไร
  python3 supabase/migrate.py               # migrate จริง

คุณสมบัติ:
 - idempotent: รันซ้ำได้ ทับของเดิมด้วย slug (frappe/wafer) ไม่เกิดข้อมูลซ้ำ
 - อัปรูปที่ JSON อ้างถึงเข้า Storage เป็น <pet_id>/<ไฟล์> แล้ว rewrite path ใน data
 - ไม่แตะไฟล์ JSON ในเครื่อง (เป็น backup)
 - จบด้วยการ verify: นับทุกหมวด + deep-compare กับต้นฉบับ
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
KEY = os.environ.get("SERVICE_KEY") or ""
FAMILY_ID = os.environ.get("FAMILY_ID") or ""
DRY = "--dry-run" in sys.argv
BUCKET = "pet-photos"
ROOT = Path(__file__).resolve().parent.parent

if not (URL and KEY and FAMILY_ID):
    sys.exit("❌ ต้องตั้ง env: SUPABASE_URL, SERVICE_KEY, FAMILY_ID")

AUTH = {"apikey": KEY, "Authorization": "Bearer " + KEY}


# ---------- helpers ----------
def http(url, method="GET", headers=None, body=None):
    req = urllib.request.Request(url, method=method, data=body)
    for k, v in dict(AUTH, **(headers or {})).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


def rest(pathname, method="GET", headers=None, payload=None):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    h = dict(headers or {})
    h["Content-Type"] = "application/json"
    status, text = http(URL + "/rest/v1/" + pathname, method, h, body)
    if status >= 300:
        sys.exit("❌ REST %s → %s: %s" % (pathname, status, text))
    return json.loads(text) if text.strip() else None


def upload_image(local_rel, storage_path):
    abs_path = ROOT / local_rel
    if not abs_path.exists():
        return False, "ไม่พบไฟล์ในเครื่อง"
    if DRY:
        return True, None
    ext = abs_path.suffix.lower()
    ctype = "image/png" if ext == ".png" else "image/webp" if ext == ".webp" else "image/jpeg"
    status, text = http(
        "%s/storage/v1/object/%s/%s" % (URL, BUCKET, storage_path),
        "POST",
        {"Content-Type": ctype, "x-upsert": "true"},
        abs_path.read_bytes(),
    )
    return (True, None) if status < 300 else (False, "%s %s" % (status, text))


def rewrite_paths(node, mapping):
    """เดินทั้ง object แล้วแทน string ที่ขึ้นต้นด้วย img/ ตาม mapping"""
    if isinstance(node, str):
        return mapping.get(node, node)
    if isinstance(node, list):
        return [rewrite_paths(n, mapping) for n in node]
    if isinstance(node, dict):
        return {k: rewrite_paths(v, mapping) for k, v in node.items()}
    return node


def collect_images(obj):
    found = set()

    def walk(n):
        if isinstance(n, str):
            if n.startswith("img/"):
                found.add(n)
        elif isinstance(n, list):
            for x in n:
                walk(x)
        elif isinstance(n, dict):
            for x in n.values():
                walk(x)

    walk(obj)
    return sorted(found)


def count_all(d):
    """นับจำนวน record ต่อหมวด — ใช้เทียบก่อน/หลัง migrate"""
    c = {}
    for k in ("meds", "labs", "labConfig", "labPanels", "treatments", "appointments", "watchList"):
        if isinstance(d.get(k), list):
            c[k] = len(d[k])
    for k, v in (d.get("symptoms") or {}).items():
        c["symptoms." + k] = len(v)
    vit = d.get("vitals") or {}
    for k in ("liverTumor", "heartSize"):
        if isinstance(vit.get(k), list):
            c["vitals." + k] = len(vit[k])
    return c


def canon(x):
    return json.dumps(x, ensure_ascii=False, sort_keys=True)


def eq(a, b):
    return canon(a) == canon(b)


# ---------- main ----------
pets_index = json.loads((ROOT / "data/pets.json").read_text(encoding="utf-8"))
print("\n🐾 Tammie Care — migrate %d ตัว %s\n" % (len(pets_index["pets"]), "(DRY RUN — ไม่เขียนจริง)" if DRY else ""))

report = []

for i, entry in enumerate(pets_index["pets"]):
    slug = entry["id"]
    raw = json.loads((ROOT / ("data/%s.json" % slug)).read_text(encoding="utf-8"))
    print("─── %s (%s)" % (entry["name"], slug))

    before = count_all(raw)
    print("   นับก่อน migrate: " + canon(before))

    # 1) สร้าง/อัปเดตแถวใน pets ก่อน เพื่อให้ได้ pet_id ไปตั้งชื่อโฟลเดอร์รูป
    if DRY:
        found = rest("pets?family_id=eq.%s&slug=eq.%s&select=id" % (FAMILY_ID, slug))
        pet_id = found[0]["id"] if found else "00000000-0000-0000-0000-000000000000"
    else:
        rows = rest(
            "pets?on_conflict=family_id,slug&select=id",
            "POST",
            {"Prefer": "resolution=merge-duplicates,return=representation"},
            [{"family_id": FAMILY_ID, "slug": slug, "name": entry["name"],
              "sort_order": i, "data": {}, "archived": False}],
        )
        pet_id = rows[0]["id"]
    print("   pet_id: " + pet_id)

    # 2) อัปรูปทั้งหมดที่ JSON อ้างถึง (รวมรูปโปรไฟล์จาก pets.json)
    images = collect_images({"pet": raw, "card": entry})
    mapping = {}
    ok_count = 0
    failed = []

    for rel in images:
        storage_path = "%s/%s" % (pet_id, os.path.basename(rel))
        ok, reason = upload_image(rel, storage_path)
        if ok:
            mapping[rel] = storage_path
            ok_count += 1
        else:
            failed.append("%s — %s" % (rel, reason))

    print("   รูป: อ้างถึง %d · อัปสำเร็จ %d%s" % (len(images), ok_count, (" · ล้มเหลว %d" % len(failed)) if failed else ""))
    for f in failed:
        print("     ⚠️  " + f)

    # 3) rewrite path + เก็บข้อมูลการ์ดจาก pets.json ไว้ใน data.card
    #    (status / statusNote / nickname / emoji อยู่ใน pets.json เท่านั้น — ต้องไม่ตกหล่น)
    migrated = rewrite_paths(raw, mapping)
    migrated["card"] = rewrite_paths(entry, mapping)

    # 4) เขียน data ก้อนเต็มลงแถวเดิม
    if not DRY:
        rest("pets?id=eq.%s" % pet_id, "PATCH", {"Prefer": "return=minimal"},
             {"data": migrated, "name": entry["name"], "sort_order": i})

    report.append({"slug": slug, "pet_id": pet_id, "entry": entry, "migrated": migrated,
                   "before": before, "images": len(images), "uploaded": ok_count, "failed": failed})
    print("")


# ---------- VERIFY ----------
print("═══ ตรวจสอบความครบถ้วน ═══\n")
all_pass = True

for r in report:
    print("─── %s" % r["entry"]["name"])
    if DRY:
        print("   (dry run — ข้ามการตรวจ)\n")
        continue

    row = rest("pets?id=eq.%s&select=name,slug,sort_order,archived,data" % r["pet_id"])[0]
    after = count_all(row["data"])

    # 1) จำนวน record ทุกหมวดต้องเท่าเดิม
    count_ok = eq(r["before"], after)
    print("   %s จำนวน record ทุกหมวดตรงกับต้นฉบับ" % ("✅" if count_ok else "❌"))
    if not count_ok:
        for k in sorted(set(list(r["before"].keys()) + list(after.keys()))):
            if r["before"].get(k) != after.get(k):
                print("      %s: ต้นฉบับ %s → ในฐานข้อมูล %s" % (k, r["before"].get(k), after.get(k)))

    # 2) deep-compare ทั้งก้อน (ไม่ใช่แค่นับ)
    deep_ok = eq(r["migrated"], row["data"])
    print("   %s เนื้อหาทุก key ตรงกันแบบ deep-compare" % ("✅" if deep_ok else "❌"))

    # 3) ไม่เหลือ path เก่า img/ ค้างอยู่
    leftover = collect_images(row["data"])
    print("   %s ไม่มี path img/ เดิมค้างใน data%s" % (
        "✅" if not leftover else "❌", (" (เหลือ %d)" % len(leftover)) if leftover else ""))

    # 4) รูปอยู่ใน Storage ครบ
    status, text = http("%s/storage/v1/object/list/%s" % (URL, BUCKET), "POST",
                        {"Content-Type": "application/json"},
                        json.dumps({"prefix": r["pet_id"] + "/", "limit": 1000}).encode("utf-8"))
    listing = json.loads(text) if status < 300 else []
    in_storage = len(listing) if isinstance(listing, list) else 0
    storage_ok = in_storage >= r["uploaded"] and not r["failed"]
    print("   %s รูปใน Storage %d ไฟล์ (อ้างถึงใน JSON %d)" % (
        "✅" if storage_ok else "❌", in_storage, r["images"]))

    # 5) ข้อมูลการ์ดจาก pets.json ไม่ตกหล่น
    card = row["data"].get("card") or {}
    card_ok = card.get("status") == r["entry"].get("status") and card.get("nickname") == r["entry"].get("nickname")
    print("   %s ข้อมูลการ์ดจาก pets.json (ชื่อเล่น/สถานะ) ครบ" % ("✅" if card_ok else "❌"))

    if not (count_ok and deep_ok and not leftover and storage_ok and card_ok):
        all_pass = False
    print("")

if DRY:
    print("🔍 DRY RUN จบ — ยังไม่มีอะไรถูกเขียน")
else:
    print("🎉 ผ่านครบทุกข้อ — ข้อมูลถูก migrate ครบถ้วน" if all_pass
          else "⚠️  มีข้อที่ไม่ผ่าน — ตรวจรายการข้างบนก่อนไป Step 4")

sys.exit(0 if (all_pass or DRY) else 1)

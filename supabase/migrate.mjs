#!/usr/bin/env node
/**
 * Tammie Care V2 — Migrate ข้อมูลจาก data/*.json → Supabase
 * ------------------------------------------------------------------
 * ใช้ Node 18+ เท่านั้น (ใช้ fetch ที่ติดมากับ Node ไม่ต้อง npm install อะไรเลย)
 *
 * วิธีรัน (จากรากโปรเจกต์):
 *   export SUPABASE_URL="https://xxxx.supabase.co"
 *   export SERVICE_KEY="sb_secret_..."        # Secret key — ห้าม commit
 *   export FAMILY_ID="1230a32a-..."
 *   node supabase/migrate.mjs            # migrate จริง
 *   node supabase/migrate.mjs --dry-run  # ลองดูก่อน ไม่เขียนอะไร
 *
 * คุณสมบัติ:
 *  - idempotent: รันซ้ำได้ ทับของเดิมด้วย slug (frappe/wafer) ไม่เกิดข้อมูลซ้ำ
 *  - อัปรูปที่ JSON อ้างถึงเข้า Storage เป็น <pet_id>/<ไฟล์> แล้ว rewrite path ใน data
 *  - ไม่แตะไฟล์ JSON ในเครื่อง (เป็น backup)
 *  - จบด้วยการ verify: นับทุกหมวด + deep-compare กับต้นฉบับ
 */

import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SERVICE_KEY;
const FAMILY_ID = process.env.FAMILY_ID;
const DRY = process.argv.includes('--dry-run');
const BUCKET = 'pet-photos';
const ROOT = path.resolve(import.meta.dirname, '..');

if (!URL_ || !KEY || !FAMILY_ID) {
  console.error('❌ ต้องตั้ง env: SUPABASE_URL, SERVICE_KEY, FAMILY_ID');
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const log = (...a) => console.log(...a);

// ---------- helpers ----------
async function rest(pathname, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${pathname}`, {
    ...opts,
    headers: { ...H, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`REST ${pathname} → ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function uploadImage(localRel, storagePath) {
  const abs = path.join(ROOT, localRel);
  if (!fs.existsSync(abs)) return { ok: false, reason: 'ไม่พบไฟล์ในเครื่อง' };
  if (DRY) return { ok: true, skipped: true };

  const body = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': type, 'x-upsert': 'true' },
    body,
  });
  if (!r.ok) return { ok: false, reason: `${r.status} ${await r.text()}` };
  return { ok: true };
}

// เดินทั้ง object แล้วแทนค่า string ที่ขึ้นต้นด้วย img/ ตาม map ที่ให้มา
function rewritePaths(node, map) {
  if (typeof node === 'string') return map.get(node) ?? node;
  if (Array.isArray(node)) return node.map((n) => rewritePaths(n, map));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rewritePaths(v, map)]));
  }
  return node;
}

function collectImages(obj) {
  const found = new Set();
  const walk = (n) => {
    if (typeof n === 'string') { if (/^img\//.test(n)) found.add(n); return; }
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') return Object.values(n).forEach(walk);
  };
  walk(obj);
  return [...found].sort();
}

// นับจำนวน record ต่อหมวด — ใช้เทียบก่อน/หลัง migrate
function countAll(d) {
  const c = {};
  for (const k of ['meds', 'labs', 'labConfig', 'labPanels', 'treatments', 'appointments', 'watchList']) {
    if (Array.isArray(d[k])) c[k] = d[k].length;
  }
  if (d.symptoms) for (const [k, v] of Object.entries(d.symptoms)) c[`symptoms.${k}`] = v.length;
  if (d.vitals?.liverTumor) c['vitals.liverTumor'] = d.vitals.liverTumor.length;
  if (d.vitals?.heartSize) c['vitals.heartSize'] = d.vitals.heartSize.length;
  return c;
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- main ----------
const petsIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pets.json'), 'utf8'));
log(`\n🐾 Tammie Care — migrate ${petsIndex.pets.length} ตัว ${DRY ? '(DRY RUN — ไม่เขียนจริง)' : ''}\n`);

const report = [];

for (const [i, entry] of petsIndex.pets.entries()) {
  const slug = entry.id;
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, `data/${slug}.json`), 'utf8'));
  log(`─── ${entry.name} (${slug})`);

  const before = countAll(raw);
  log('   นับก่อน migrate:', JSON.stringify(before));

  // 1) สร้าง/อัปเดตแถวใน pets ก่อน เพื่อให้ได้ pet_id ไปตั้งชื่อโฟลเดอร์รูป
  let petId;
  if (DRY) {
    const found = await rest(`pets?family_id=eq.${FAMILY_ID}&slug=eq.${slug}&select=id`);
    petId = found?.[0]?.id ?? '00000000-0000-0000-0000-000000000000';
  } else {
    const rows = await rest('pets?on_conflict=family_id,slug&select=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{
        family_id: FAMILY_ID, slug, name: entry.name,
        sort_order: i, data: {}, archived: false,
      }]),
    });
    petId = rows[0].id;
  }
  log(`   pet_id: ${petId}`);

  // 2) อัปรูปทั้งหมดที่ JSON อ้างถึง → <pet_id>/<ชื่อไฟล์>
  //    รวมรูปโปรไฟล์จาก pets.json ด้วย (entry.photo)
  const images = collectImages({ ...raw, __card: entry });
  const map = new Map();
  let okCount = 0;
  const failed = [];

  for (const rel of images) {
    const storagePath = `${petId}/${path.basename(rel)}`;
    const res = await uploadImage(rel, storagePath);
    if (res.ok) { map.set(rel, storagePath); okCount++; }
    else failed.push(`${rel} — ${res.reason}`);
  }
  log(`   รูป: อ้างถึง ${images.length} · อัปสำเร็จ ${okCount}${failed.length ? ` · ล้มเหลว ${failed.length}` : ''}`);
  failed.forEach((f) => log(`     ⚠️  ${f}`));

  // 3) rewrite path ใน data + เก็บข้อมูลการ์ดจาก pets.json ไว้ใน data.card
  //    (status / statusNote / nickname / emoji อยู่ใน pets.json เท่านั้น — ต้องไม่ตกหล่น)
  const migrated = rewritePaths(raw, map);
  migrated.card = rewritePaths(entry, map);

  // 4) เขียน data ก้อนเต็มลงแถวเดิม
  if (!DRY) {
    await rest(`pets?id=eq.${petId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ data: migrated, name: entry.name, sort_order: i }),
    });
  }

  report.push({ slug, petId, entry, raw, migrated, before, images: images.length, uploaded: okCount, failed });
  log('');
}

// ---------- VERIFY ----------
log('═══ ตรวจสอบความครบถ้วน ═══\n');
let allPass = true;

for (const r of report) {
  log(`─── ${r.entry.name}`);
  if (DRY) { log('   (dry run — ข้ามการตรวจ)\n'); continue; }

  const [row] = await rest(`pets?id=eq.${r.petId}&select=name,slug,sort_order,archived,data`);
  const after = countAll(row.data);

  // 1) จำนวน record ทุกหมวดต้องเท่าเดิม
  const countOK = eq(r.before, after);
  log(`   ${countOK ? '✅' : '❌'} จำนวน record ทุกหมวดตรงกับต้นฉบับ`);
  if (!countOK) {
    for (const k of new Set([...Object.keys(r.before), ...Object.keys(after)])) {
      if (r.before[k] !== after[k]) log(`      ${k}: ต้นฉบับ ${r.before[k]} → ในฐานข้อมูล ${after[k]}`);
    }
  }

  // 2) deep-compare ทั้งก้อนกับสิ่งที่ควรจะเป็น (ไม่ใช่แค่นับ)
  const deepOK = eq(r.migrated, row.data);
  log(`   ${deepOK ? '✅' : '❌'} เนื้อหาทุก key ตรงกันแบบ deep-compare`);

  // 3) ไม่เหลือ path เก่า img/ ค้างอยู่
  const leftover = collectImages(row.data);
  log(`   ${leftover.length === 0 ? '✅' : '❌'} ไม่มี path img/ เดิมค้างใน data${leftover.length ? ` (เหลือ ${leftover.length})` : ''}`);

  // 4) รูปอยู่ใน Storage ครบ
  const list = await fetch(`${URL_}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: `${r.petId}/`, limit: 1000 }),
  }).then((x) => x.json());
  const inStorage = Array.isArray(list) ? list.length : 0;
  const storageOK = inStorage >= r.uploaded && r.failed.length === 0;
  log(`   ${storageOK ? '✅' : '❌'} รูปใน Storage ${inStorage} ไฟล์ (อ้างถึงใน JSON ${r.images})`);

  // 5) ข้อมูลการ์ดจาก pets.json ไม่ตกหล่น
  const cardOK = eq(r.entry.status, row.data.card?.status) && eq(r.entry.nickname, row.data.card?.nickname);
  log(`   ${cardOK ? '✅' : '❌'} ข้อมูลการ์ดจาก pets.json (ชื่อเล่น/สถานะ) ครบ`);

  if (!(countOK && deepOK && leftover.length === 0 && storageOK && cardOK)) allPass = false;
  log('');
}

log(DRY ? '🔍 DRY RUN จบ — ยังไม่มีอะไรถูกเขียน'
       : allPass ? '🎉 ผ่านครบทุกข้อ — ข้อมูลถูก migrate ครบถ้วน'
                 : '⚠️  มีข้อที่ไม่ผ่าน — ตรวจรายการข้างบนก่อนไป Step 4');
process.exit(allPass || DRY ? 0 : 1);

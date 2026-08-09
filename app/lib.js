/* =========================================================
   Tammie Care V2 — ฟังก์ชันกลาง (auth / ข้อมูล / รูป)
   ต้องโหลดหลัง supabase-js CDN และ config.js
   ========================================================= */

const TC = (() => {
  const cfg = window.TC_CONFIG;

  // ตรวจค่า config ตั้งแต่ต้น — ผิดตรงนี้จะไปโผล่เป็น error ปลายทางที่อ่านไม่รู้เรื่อง
  (function checkConfig() {
    const k = cfg.SUPABASE_KEY || '';
    if (!k || /[^\x00-\xFF]/.test(k)) {
      // มีอักขระนอก Latin-1 (เช่นภาษาไทยจาก placeholder) → ใส่ใน HTTP header ไม่ได้
      alert('ยังไม่ได้ใส่ publishable key ใน app/config.js\n(ตอนนี้ยังเป็นข้อความ placeholder อยู่)');
      throw new Error('TC_CONFIG.SUPABASE_KEY ยังไม่ถูกตั้งค่า');
    }
    if (!/^(sb_publishable_|eyJ)/.test(k)) {
      console.warn('⚠️ SUPABASE_KEY หน้าตาไม่เหมือน publishable key — ตรวจว่าไม่ได้ใส่ secret key ผิดช่อง');
    }
  })();

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

  // ---------- auth ----------

  /** บังคับให้ล็อกอินก่อน — ไม่มี session = เด้งไปหน้า login */
  async function requireAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
      return null;
    }
    return session.user;
  }

  async function signOut() {
    await sb.auth.signOut();
    location.replace('login.html');
  }

  /**
   * สิทธิ์ของผู้ใช้ปัจจุบัน
   * คืน { role: 'parent'|'vet', permission: 'view'|'edit'|'admin', canEdit, isAdmin, familyIds[] }
   * หมายเหตุ: ใช้ควบคุมการ "แสดงปุ่ม" เท่านั้น — ความปลอดภัยจริงอยู่ที่ RLS
   */
  async function getMyRole() {
    let members, vets;
    try {
      [{ data: members }, { data: vets }] = await Promise.all([
        sb.from('family_members').select('family_id,permission'),
        sb.from('vet_access').select('family_id'),
      ]);
    } catch (_) {
      return { role: null, permission: null, canEdit: false, isAdmin: false, familyIds: [] };
    }
    if (members && members.length) {
      const best = members.reduce((a, m) =>
        ({ view: 0, edit: 1, admin: 2 }[m.permission] > { view: 0, edit: 1, admin: 2 }[a.permission] ? m : a));
      return {
        role: 'parent', permission: best.permission,
        canEdit: best.permission !== 'view', isAdmin: best.permission === 'admin',
        familyIds: members.map((m) => m.family_id),
      };
    }
    if (vets && vets.length) {
      return { role: 'vet', permission: 'view', canEdit: false, isAdmin: false, familyIds: vets.map((v) => v.family_id) };
    }
    return { role: null, permission: null, canEdit: false, isAdmin: false, familyIds: [] };
  }

  // ---------- ข้อมูลสัตว์ ----------
  // RLS กรองให้อยู่แล้วว่าเห็นตัวไหนได้บ้าง จึงไม่ต้องใส่เงื่อนไข family เอง

  async function listPets() {
    const { data, error } = await sb
      .from('pets').select('id,slug,name,data,sort_order')
      .eq('archived', false).order('sort_order');
    if (error) throw error;
    return data;
  }

  async function getPet(id) {
    const { data, error } = await sb.from('pets').select('id,slug,name,data').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  // ---------- เขียนข้อมูล ----------

  /**
   * แก้เฉพาะเส้นทางที่ระบุใน pets.data (ไม่ส่งก้อนเต็มกลับไป)
   * เช่น setPetPath(id, ['symptoms','diarrhea'], [...])
   * กันกรณีสองคนแก้คนละหมวดพร้อมกันแล้วทับกันเอง
   */
  async function setPetPath(petId, path, value) {
    const { data, error } = await sb.rpc('set_pet_path', {
      p_pet_id: petId, p_path: path, p_value: value,
    });
    if (error) throw new Error(saveErrorTH(error));
    return data;   // data ก้อนใหม่ทั้งหมด หลังบันทึก
  }

  function saveErrorTH(err) {
    const m = (err?.message || '');
    if (m.includes('ไม่มีสิทธิ์')) return m;                       // ข้อความจากฟังก์ชันเป็นไทยอยู่แล้ว
    if (/row-level security|permission denied/i.test(m)) return 'คุณไม่มีสิทธิ์แก้ข้อมูลนี้';
    if (/network|fetch/i.test(m)) return 'บันทึกไม่สำเร็จ — เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง';
    return 'บันทึกไม่สำเร็จ: ' + m;
  }

  // ---------- จัดการครอบครัว (เรียก RPC — สิทธิ์จริงเช็กใน DB) ----------

  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw new Error(saveErrorTH(error));
    return data;
  }

  const familyOverview = (fid) => rpc('family_overview', { fid });
  const addMember = (fid, email, permission) => rpc('add_member_by_email', { fid, p_email: email, p_permission: permission });
  const addVet = (fid, email) => rpc('add_vet_by_email', { fid, p_email: email });
  const setMemberPermission = (fid, userId, permission) => rpc('set_member_permission', { fid, p_user: userId, p_permission: permission });
  const removeMember = (fid, userId) => rpc('remove_member', { fid, p_user: userId });
  const removeVet = (fid, userId) => rpc('remove_vet', { fid, p_user: userId });
  const createPet = (fid, name) => rpc('create_pet', { fid, p_name: name });
  const setPetProfile = (petId, card, name) => rpc('set_pet_profile', { p_pet_id: petId, p_card: card, p_name: name });

  /** archive/unarchive สัตว์ (soft delete) — ผ่าน pets policy เดิม */
  async function setPetArchived(petId, archived) {
    const { error } = await sb.from('pets').update({ archived }).eq('id', petId);
    if (error) throw new Error(saveErrorTH(error));
  }

  /** ลบสัตว์ถาวร (admin เท่านั้น ตาม RLS) — ลบแล้วกู้คืนไม่ได้ */
  async function deletePet(petId) {
    const { error } = await sb.from('pets').delete().eq('id', petId);
    if (error) throw new Error(saveErrorTH(error));
  }

  /** โปรไฟล์ของฉัน (ชื่อเล่นที่ให้คนอื่นเห็น + อีเมล) */
  async function myProfile() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.from('profiles').select('name,email').eq('id', user.id).single();
    return data || { name: null, email: user.email };
  }

  /** แก้ชื่อเล่นของตัวเอง (RLS อนุญาตให้แก้ profile ตัวเองได้) */
  async function updateMyName(name) {
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('profiles').update({ name: name.trim() }).eq('id', user.id);
    if (error) throw new Error(saveErrorTH(error));
  }

  /** รายชื่อครอบครัวของฉัน (ไว้โชว์ในหน้าจัดการ) */
  async function myFamilies() {
    const { data, error } = await sb.from('families').select('id,name');
    if (error) throw error;
    return data;
  }

  // ---------- รูปใน Storage (bucket เป็น private ต้องใช้ signed URL) ----------

  /** ย่อรูปก่อนอัป — กันไฟล์จากกล้องมือถือขนาด 5–10MB กินโควตา free tier */
  function resizeImage(file, maxSide = 1400, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width: w, height: h } = img;
        if (Math.max(w, h) > maxSide) {
          const r = maxSide / Math.max(w, h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error('ย่อรูปไม่สำเร็จ'))), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปไม่ได้')); };
      img.src = url;
    });
  }

  /**
   * อัปรูปเข้า bucket ที่ path <petId>/<ชื่อไฟล์>
   * ชื่อไฟล์ตั้งตามรูปแบบเดิมของ V1 เพื่อให้ดูออกว่ามาจากอาการอะไร วันไหน
   * คืน path (ไม่ใช่ URL) เพราะ bucket เป็น private — ต้องขอ signed URL ตอนแสดงผล
   */
  async function uploadPhoto(petId, file, prefix = 'photo', dateISO = '') {
    const blob = await resizeImage(file);
    const name = `${prefix}-${dateISO || new Date().toISOString().slice(0, 10)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
    const path = `${petId}/${name}`;
    const { error } = await sb.storage.from(cfg.BUCKET).upload(path, blob, {
      contentType: 'image/jpeg', upsert: false,
    });
    if (error) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + error.message);
    return path;
  }


  const urlCache = new Map();

  async function signedUrl(path, expires = 3600) {
    if (!path) return null;
    if (urlCache.has(path)) return urlCache.get(path);
    const { data, error } = await sb.storage.from(cfg.BUCKET).createSignedUrl(path, expires);
    if (error) return null;
    urlCache.set(path, data.signedUrl);
    return data.signedUrl;
  }

  /** ใส่รูปลง <img> แบบไม่ต้องรอ (กันรูปแตกถ้าเปิดไม่ได้) */
  async function fillImg(imgEl, path) {
    const url = await signedUrl(path);
    if (url) imgEl.src = url;
    else imgEl.style.display = 'none';
  }

  // ---------- helpers ทั่วไป ----------

  const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  function calcAge(birthDate) {
    if (!birthDate) return null;
    const b = new Date(birthDate), now = new Date();
    let y = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) y--;
    return y;
  }

  /** อายุแบบข้อความ "X ปี Y เดือน" (เดือนน้อยกว่า 1 ปีก็บอกเป็นเดือน) */
  function ageText(birthDate) {
    if (!birthDate) return '';
    const b = new Date(birthDate), now = new Date();
    let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
    if (now.getDate() < b.getDate()) months--;   // ยังไม่ถึงวันเกิดในเดือนนี้
    if (months < 0) months = 0;
    const y = Math.floor(months / 12), m = months % 12;
    if (y === 0) return `${m} เดือน`;
    if (m === 0) return `${y} ปี`;
    return `${y} ปี ${m} เดือน`;
  }

  function thDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  }

  function thDateShort(iso) {
    const d = new Date(iso);
    return `${d.getDate()} ${TH_MONTHS[d.getMonth()]}`;
  }

  /** นัดที่ใกล้ที่สุดภายใน 7 วัน (เลยวันนัดแล้ว = ไม่เตือน) — logic เดียวกับ V1 */
  function nextAppt(petData) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let best = null;
    (petData.appointments || []).forEach((a) => {
      const d = new Date(a.date); d.setHours(0, 0, 0, 0);
      const diff = Math.round((d - today) / 86400000);
      if (diff >= 0 && diff <= 7 && (!best || diff < best.diff)) best = { ...a, d, diff };
    });
    return best;
  }

  /** แปลง error ของ Supabase เป็นภาษาคน */
  function authErrorTH(err) {
    const m = (err?.message || '').toLowerCase();
    if (m.includes('invalid login')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (m.includes('email not confirmed')) return 'อีเมลนี้ยังไม่ได้ยืนยัน';
    if (m.includes('rate limit') || m.includes('too many')) return 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่';
    if (m.includes('network') || m.includes('fetch')) return 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต';
    if (m.includes('password') && m.includes('6')) return 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร';
    return 'เกิดข้อผิดพลาด: ' + (err?.message || 'ไม่ทราบสาเหตุ');
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  return { sb, requireAuth, signOut, getMyRole, listPets, getPet, signedUrl, fillImg,
           setPetPath, uploadPhoto, resizeImage,
           familyOverview, addMember, addVet, setMemberPermission, removeMember, removeVet,
           createPet, setPetProfile, setPetArchived, deletePet, myFamilies, myProfile, updateMyName,
           calcAge, ageText, thDate, thDateShort, nextAppt, authErrorTH, esc, TH_MONTHS };
})();

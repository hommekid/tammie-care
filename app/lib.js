/* =========================================================
   Tammie Care V2 — ฟังก์ชันกลาง (auth / ข้อมูล / รูป)
   ต้องโหลดหลัง supabase-js CDN และ config.js
   ========================================================= */

const TC = (() => {
  const cfg = window.TC_CONFIG;

  // ---------- กล่อง dialog ของเราเอง หัวเป็น "🐾 Tammie says" ----------
  // ทำไมต้องทำเอง: alert()/confirm()/prompt() ของเบราว์เซอร์บังคับหัวข้อเป็นชื่อโดเมน
  //   ("tammie-care.hommekidgo.workers.dev says") — เปลี่ยนจาก JS ไม่ได้เลย
  // - window.alert ถูกทับ (ทุก alert() เดิมได้กล่องใหม่ทันที ไม่ต้องแก้ call site) · มีคิวในตัว · ไม่บล็อก
  // - TC.confirm / TC.prompt คืน Promise → call site ต้อง `await` (ต่างจาก confirm/prompt เดิมที่บล็อก)
  //   ⚠️ เพิ่มที่เรียก confirm/prompt ใหม่ ต้องเป็น async + await เสมอ ไม่งั้น Promise = truthy ตลอด
  const TCModal = (function setupModal() {
    // ---- alert: คิว ไม่บล็อก ----
    const aQueue = [];
    let aEl = null, aTxt = null, aOk = null, aOpen = false;
    const aClose = () => aShow();
    function aEnsure() {
      if (aEl) return;
      aEl = document.createElement('div');
      aEl.className = 'tc-alert'; aEl.style.display = 'none';
      aEl.innerHTML =
        '<div class="tc-alert-box" role="alertdialog" aria-modal="true">' +
          '<div class="bar"></div><h3>🐾 Tammie says</h3><div class="body"></div>' +
          '<div class="foot"><button type="button" class="btn">ตกลง</button></div></div>';
      aTxt = aEl.querySelector('.body'); aOk = aEl.querySelector('.btn');
      aOk.onclick = aClose;
      aEl.onclick = (e) => { if (e.target === aEl) aClose(); };
      document.addEventListener('keydown', (e) => {
        if (!aOpen) return;
        if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); aClose(); }
      });
      (document.body || document.documentElement).appendChild(aEl);
    }
    function aShow() {
      if (!aQueue.length) { aOpen = false; if (aEl) aEl.style.display = 'none'; return; }
      aEnsure(); aTxt.textContent = aQueue.shift(); aEl.style.display = 'flex'; aOpen = true; aOk.focus();
    }
    window.alert = (msg) => { aQueue.push(String(msg ?? '')); if (!aOpen) aShow(); };

    // ---- confirm / prompt: คืน Promise (ครั้งละกล่อง — call site await กันอยู่แล้ว) ----
    function ask(message, { prompt = false, defaultVal = '', okLabel = 'ตกลง', danger = false } = {}) {
      return new Promise((resolve) => {
        const el = document.createElement('div');
        el.className = 'tc-alert';
        el.innerHTML =
          '<div class="tc-alert-box" role="alertdialog" aria-modal="true">' +
            '<div class="bar"></div><h3>🐾 Tammie says</h3>' +
            '<div class="body"></div>' +
            (prompt ? '<div style="padding:0 20px 4px"><input type="text" class="tc-ask-input"></div>' : '') +
            '<div class="foot" style="gap:10px">' +
              '<button type="button" class="btn-ghost tc-cancel">ยกเลิก</button>' +
              '<button type="button" class="btn tc-ok"' + (danger ? ' style="background:var(--red)"' : '') + '></button>' +
            '</div></div>';
        el.querySelector('.body').textContent = message;
        el.querySelector('.tc-ok').textContent = okLabel;
        const input = el.querySelector('.tc-ask-input');
        if (input) input.value = defaultVal ?? '';
        (document.body || document.documentElement).appendChild(el);

        let done = false;
        const finish = (val) => { if (done) return; done = true; el.remove(); resolve(val); };
        const ok = () => finish(prompt ? (input ? input.value : '') : true);
        const cancel = () => finish(prompt ? null : false);

        el.querySelector('.tc-ok').onclick = ok;
        el.querySelector('.tc-cancel').onclick = cancel;
        el.onclick = (e) => { if (e.target === el) cancel(); };
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          if (e.key === 'Enter' && (input || document.activeElement.classList.contains('tc-ok'))) { e.preventDefault(); ok(); }
        });
        el.style.display = 'flex';
        (input || el.querySelector('.tc-ok')).focus();
      });
    }
    return {
      confirm: (msg, opts) => ask(String(msg ?? ''), { ...opts }),
      prompt: (msg, defaultVal) => ask(String(msg ?? ''), { prompt: true, defaultVal }),
    };
  })();

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

  /** ลบสัตว์ถาวร (admin เท่านั้น) — ลบรูปทั้งหมดใน Storage แล้วลบแถวข้อมูล */
  async function deletePet(petId) {
    // 1) ลบรูปทุกใบในโฟลเดอร์ <petId>/ ออกจาก bucket
    try {
      const { data: files } = await sb.storage.from(cfg.BUCKET).list(petId, { limit: 1000 });
      if (files && files.length) {
        const paths = files.map((f) => `${petId}/${f.name}`);
        await sb.storage.from(cfg.BUCKET).remove(paths);
      }
    } catch (_) { /* ลบรูปพลาดก็ยังลบแถวต่อ (รูปกลายเป็นกำพร้าอย่างมากสุด) */ }

    // 2) ลบแถวข้อมูลสัตว์ (RLS ตรวจ admin)
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

  /** แก้ชื่อครอบครัว (admin เท่านั้น ตาม RLS families_update) */
  async function renameFamily(fid, name) {
    const { error } = await sb.from('families').update({ name: name.trim() }).eq('id', fid);
    if (error) throw new Error(saveErrorTH(error));
  }

  /** ตั้งรูปครอบครัว (data URL ย่อแล้ว) — admin เท่านั้น · ส่ง null เพื่อลบรูป */
  async function setFamilyPhoto(fid, dataUrl) {
    const { error } = await sb.from('families').update({ photo: dataUrl }).eq('id', fid);
    if (error) throw new Error(saveErrorTH(error));
  }

  /** ย่อรูปเป็น data URL (jpeg) — ใช้กับรูปครอบครัวที่เก็บใน DB ตรงๆ ไม่ผ่าน Storage */
  function resizeToDataUrl(file, maxSide = 256, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width: w, height: h } = img;
        if (Math.max(w, h) > maxSide) { const r = maxSide / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปไม่ได้')); };
      img.src = url;
    });
  }

  /** ครอปรูปเป็นสี่เหลี่ยมจัตุรัส (เลื่อน/ซูม, canvas ล้วน) — ใช้ร่วมกันทั้งโปรไฟล์สัตว์ + รูปครอบครัว
   *  opts: { out=ขนาดผลลัพธ์, quality, asDataUrl } · คืน Blob (default) หรือ data URL (asDataUrl:true)
   *  ใช้ CSS .cropper/.crop-* ใน theme.css · reject('cancel') ถ้ากดยกเลิก */
  function cropSquare(file, { out = 600, quality = 0.9, asDataUrl = false } = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objURL = URL.createObjectURL(file);
      img.onload = () => {
        const V = Math.min(300, window.innerWidth - 80);
        const minScale = V / Math.min(img.naturalWidth, img.naturalHeight);
        let scale = minScale; const maxScale = minScale * 4;
        let left = (V - img.naturalWidth * scale) / 2;
        let top = (V - img.naturalHeight * scale) / 2;

        const ov = document.createElement('div');
        ov.className = 'cropper';
        ov.innerHTML =
          '<div class="crop-panel"><div class="crop-title">เลื่อน/ซูมให้พอดีกรอบ</div>' +
          `<div class="crop-view" style="width:${V}px;height:${V}px"><img class="crop-img" draggable="false"><div class="crop-ring"></div></div>` +
          '<input type="range" class="crop-zoom" min="1" max="4" step="0.01" value="1">' +
          '<div class="crop-btns"><button class="btn crop-ok">ใช้รูปนี้</button><button class="btn-ghost crop-cancel">ยกเลิก</button></div></div>';
        document.body.appendChild(ov);

        const imgEl = ov.querySelector('.crop-img');
        imgEl.src = objURL;
        const clamp = () => {
          const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
          left = Math.min(0, Math.max(V - w, left));
          top = Math.min(0, Math.max(V - h, top));
        };
        const apply = () => {
          clamp();
          imgEl.style.width = img.naturalWidth * scale + 'px';
          imgEl.style.height = img.naturalHeight * scale + 'px';
          imgEl.style.left = left + 'px'; imgEl.style.top = top + 'px';
        };
        apply();

        let dragging = false, px = 0, py = 0;
        const view = ov.querySelector('.crop-view');
        view.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; py = e.clientY; view.setPointerCapture(e.pointerId); });
        view.addEventListener('pointermove', (e) => { if (!dragging) return; left += e.clientX - px; top += e.clientY - py; px = e.clientX; py = e.clientY; apply(); });
        view.addEventListener('pointerup', () => { dragging = false; });
        ov.querySelector('.crop-zoom').oninput = (e) => {
          const cx = (V / 2 - left) / scale, cy = (V / 2 - top) / scale;
          scale = Math.min(maxScale, Math.max(minScale, minScale * Number(e.target.value)));
          left = V / 2 - cx * scale; top = V / 2 - cy * scale; apply();
        };
        const cleanup = () => { URL.revokeObjectURL(objURL); ov.remove(); };
        ov.querySelector('.crop-cancel').onclick = () => { cleanup(); reject(new Error('cancel')); };
        ov.querySelector('.crop-ok').onclick = () => {
          const sx = -left / scale, sy = -top / scale, sSize = V / scale;
          const cv = document.createElement('canvas');
          cv.width = out; cv.height = out;
          cv.getContext('2d').drawImage(img, sx, sy, sSize, sSize, 0, 0, out, out);
          if (asDataUrl) { cleanup(); resolve(cv.toDataURL('image/jpeg', quality)); }
          else cv.toBlob((b) => { cleanup(); b ? resolve(b) : reject(new Error('crop fail')); }, 'image/jpeg', quality);
        };
      };
      img.onerror = () => { URL.revokeObjectURL(objURL); reject(new Error('เปิดรูปไม่ได้')); };
      img.src = objURL;
    });
  }

  /** รายชื่อครอบครัวของฉัน (+ รูป) ไว้โชว์ในหน้าจัดการ/หน้าแรก */
  async function myFamilies() {
    const { data, error } = await sb.from('families').select('id,name,photo');
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

  // ---------- tooltip กดค้าง (มือถือ) — อ่านจาก attribute title ----------
  (function setupTouchTip() {
    let tipEl, timer, shown, sx, sy;
    const ensure = () => {
      if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'm-tip'; document.body.appendChild(tipEl); }
      return tipEl;
    };
    const show = (el) => {
      const text = el.getAttribute('title') || el.dataset.tip;
      if (!text) return;
      const t = ensure();
      t.textContent = text;
      t.style.display = 'block';
      const r = el.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - 8 - t.offsetWidth, r.left + window.scrollX));
      let top = r.top + window.scrollY - t.offsetHeight - 8;
      if (top < window.scrollY + 4) top = r.bottom + window.scrollY + 8;   // ไม่พอด้านบน → ไปด้านล่าง
      t.style.left = left + 'px'; t.style.top = top + 'px';
      shown = true;
    };
    const hide = () => { if (tipEl) tipEl.style.display = 'none'; shown = false; };

    document.addEventListener('touchstart', (e) => {
      const el = e.target.closest('[title],[data-tip]');
      if (!el) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      timer = setTimeout(() => show(el), 350);   // กดค้าง ~0.35 วิ
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8) clearTimeout(timer);
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      clearTimeout(timer);
      if (shown) { e.preventDefault(); hide(); }   // แสดง tooltip แล้ว ไม่ให้ click ทำงาน
    }, { passive: false });
    document.addEventListener('touchcancel', () => { clearTimeout(timer); hide(); });
  })();

  return { sb, requireAuth, signOut, getMyRole, listPets, getPet, signedUrl, fillImg,
           setPetPath, uploadPhoto, resizeImage,
           familyOverview, addMember, addVet, setMemberPermission, removeMember, removeVet,
           createPet, setPetProfile, setPetArchived, deletePet, myFamilies, renameFamily, setFamilyPhoto, resizeToDataUrl, cropSquare, myProfile, updateMyName,
           calcAge, ageText, thDate, thDateShort, nextAppt, authErrorTH, esc, TH_MONTHS,
           confirm: TCModal.confirm, prompt: TCModal.prompt };
})();

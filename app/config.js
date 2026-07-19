// Tammie Care V2 — ค่าเชื่อมต่อ Supabase
//
// ⚠️ ใส่ได้เฉพาะ "publishable key" (sb_publishable_... หรือ anon key เดิม) เท่านั้น
//    คีย์นี้ออกแบบมาให้เปิดเผยใน frontend ได้ เพราะ RLS เป็นตัวคุมสิทธิ์จริง
//    ห้ามใส่ Secret key (sb_secret_...) ในไฟล์นี้เด็ดขาด — repo ยัง public

window.TC_CONFIG = {
  SUPABASE_URL: 'https://fvsdtkjzrvxqntybyfhg.supabase.co',
  SUPABASE_KEY: 'sb_publishable_o0l8yBQ1MbZaulgWHDiD7A_wkePXIGW',
  BUCKET: 'pet-photos',
};

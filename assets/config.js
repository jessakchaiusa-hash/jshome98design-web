// ===== ตั้งค่าการเชื่อมต่อ Supabase =====
// หาได้จาก Supabase Dashboard → Settings → API
// ใช้ "anon public" key เท่านั้น (ไม่ใช่ service_role — key นั้นห้ามใส่ในเว็บฝั่ง client เด็ดขาด)

const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";

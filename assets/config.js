// ===== ตั้งค่าการเชื่อมต่อ Supabase =====
// หาได้จาก Supabase Dashboard → Settings → API
// ใช้ "anon public" key เท่านั้น (ไม่ใช่ service_role — key นั้นห้ามใส่ในเว็บฝั่ง client เด็ดขาด)

const SUPABASE_URL = "https://jpjbxyujgtaeeyhzdjqb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_aak6n97qseJS0oONzUTyRg_O4MOpecW";

// ===== ลิงก์ LINE OA ของ JS Home (เติมเมื่อได้ลิงก์จริง เช่น "https://lin.ee/xxxx") =====
// ปุ่มบนเว็บที่มี data-line="buyer" / "seller" จะใช้ลิงก์จากตรงนี้ — ถ้ายังว่าง ปุ่มจะแจ้งว่า "เร็วๆ นี้"
const JSH_LINE = {
  buyer: "",   // แชทกับผู้ซื้อ: สอบถามทรัพย์ JS Home Exclusive · ติดต่อแอดมิน · บริการรับประมูลทรัพย์บังคับคดี
  seller: "",  // บันทึกทรัพย์ลงพอร์ต: ฝากขาย · เสนอขายทรัพย์
};

// ===== ฟีดทรัพย์ JS Home Exclusive (Apps Script ของระบบลิสติ้ง → ลิงก์ Web app + "?view=listings") =====
const LISTINGS_FEED_URL = "";

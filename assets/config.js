// ===== ตั้งค่าการเชื่อมต่อ Supabase =====
// หาได้จาก Supabase Dashboard → Settings → API
// ใช้ "anon public" key เท่านั้น (ไม่ใช่ service_role — key นั้นห้ามใส่ในเว็บฝั่ง client เด็ดขาด)

const SUPABASE_URL = "https://jpjbxyujgtaeeyhzdjqb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_aak6n97qseJS0oONzUTyRg_O4MOpecW";

// ===== ลิงก์ LINE OA ของ JS Home =====
// ปุ่มบนเว็บที่มี data-line="buyer" / "seller" จะใช้ลิงก์จากตรงนี้ — ถ้ายังว่าง ปุ่มจะแจ้งว่า "เร็วๆ นี้"
const JSH_LINE = {
  buyer: "https://lin.ee/NPR8MyY",   // @jshome — แชทลูกค้า · ติดต่อแอดมิน · สนใจซื้อบ้าน (JS Home Exclusive)
  seller: "https://lin.ee/tocqQvv",  // @314rvvmo — บันทึกทรัพย์ · ฝากขาย · เสนอขาย · บริการรับประมูลทรัพย์บังคับคดี
};

// ===== ฟีดทรัพย์ JS Home Exclusive (Apps Script ของระบบลิสติ้ง → ลิงก์ Web app + "?view=listings") =====
const LISTINGS_FEED_URL = "";

// ===== ตัวช่วยเรียก Supabase REST API (PostgREST) แบบไม่ต้องใช้ library เพิ่ม =====

const REST_URL = `${SUPABASE_URL}/rest/v1/properties`;

function baseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

// ===== การตั้งค่าโซน (เปิด/ปิดจังหวัดที่ให้แสดงบนเว็บ) =====
// อ่านจากตาราง zone_settings ใน Supabase — Captain ปรับได้เองผ่าน Table Editor
// โดยไม่ต้องแก้โค้ดเลย แค่ติ๊ก enabled = true/false รายจังหวัด
// ถ้ายังไม่ได้สร้างตารางนี้ ระบบจะถือว่า "ไม่จำกัดโซน" (แสดงทุกจังหวัดตามปกติ)
let _cachedEnabledProvinces = null;

async function getEnabledProvinces() {
  if (_cachedEnabledProvinces !== null) return _cachedEnabledProvinces;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/zone_settings?select=province&enabled=eq.true&order=province.asc`,
      { headers: baseHeaders() }
    );
    if (!res.ok) throw new Error("zone_settings table not found");
    const rows = await res.json();
    _cachedEnabledProvinces = rows.map((r) => r.province);
  } catch (e) {
    console.warn("โหลดการตั้งค่าโซนไม่สำเร็จ ใช้ค่าเริ่มต้น (แสดงทุกจังหวัด):", e);
    _cachedEnabledProvinces = [];
  }
  return _cachedEnabledProvinces;
}

// นับจำนวนทรัพย์ทั้งหมด (หรือกรองตามเงื่อนไข) — ใช้ HEAD request + Prefer count=exact เร็วและเบา
async function fetchPropertyCount(filters = {}) {
  const enabled = await getEnabledProvinces();
  const params = buildFilterParams(filters, enabled);
  const res = await fetch(`${REST_URL}?select=id&${params}`, {
    method: "HEAD",
    headers: baseHeaders({ Prefer: "count=exact" }),
  });
  const range = res.headers.get("content-range"); // เช่น "0-24/26480"
  if (!range) return 0;
  const total = range.split("/")[1];
  return parseInt(total, 10) || 0;
}

// ดึงรายการทรัพย์ พร้อม filter + pagination
async function fetchProperties({ filters = {}, page = 1, pageSize = 24 } = {}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const enabled = await getEnabledProvinces();
  const params = buildFilterParams(filters, enabled);

  const res = await fetch(
    `${REST_URL}?select=*&order=synced_at.desc&${params}`,
    {
      headers: baseHeaders({
        Range: `${from}-${to}`,
        Prefer: "count=exact",
      }),
    }
  );

  const range = res.headers.get("content-range");
  const total = range ? parseInt(range.split("/")[1], 10) || 0 : 0;
  const data = await res.json();
  return { data, total };
}

// ดึงพิกัดทรัพย์สำหรับแสดงบนแผนที่ (เฉพาะที่มี lat/lng จริง)
// ดึงแบบแบ่งหน้าอัตโนมัติ (ทีละ 1000 แถว) เพื่อไม่ให้ติดขีดจำกัด "Max Rows" ของ Supabase
async function fetchPropertiesForMap({ filters = {}, limit = 20000 } = {}) {
  const enabled = await getEnabledProvinces();
  const params = buildFilterParams(filters, enabled);
  const extra = "lat=neq.&lng=neq.";
  const query = params ? `${params}&${extra}` : extra;

  const PAGE_SIZE = 1000; // เท่ากับ (หรือน้อยกว่า) ค่า Max Rows ของ Supabase
  let allRows = [];
  let from = 0;

  while (allRows.length < limit) {
    const to = Math.min(from + PAGE_SIZE - 1, limit - 1);
    const res = await fetch(
      `${REST_URL}?select=ghb_link,name,type,project,province,district,lat,lng&${query}`,
      { headers: baseHeaders({ Range: `${from}-${to}` }) }
    );
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;

    allRows = allRows.concat(rows);
    if (rows.length < PAGE_SIZE) break; // หมดข้อมูลแล้ว
    from += PAGE_SIZE;
  }

  return allRows;
}

// ดึงรายชื่อจังหวัดที่ "เปิดใช้งาน" ไว้ให้แสดงบนเว็บ (ใช้กับ dropdown filter และ pills หน้าแรก)
// ถ้ายังไม่ได้สร้างตาราง zone_settings จะ fallback ไปดึงจากทรัพย์ทั้งหมดแทนอัตโนมัติ
async function fetchProvinceList() {
  const enabled = await getEnabledProvinces();
  if (enabled.length > 0) return enabled;

  const res = await fetch(
    `${REST_URL}?select=province&order=province.asc`,
    { headers: baseHeaders() }
  );
  const rows = await res.json();
  const set = new Set(rows.map((r) => r.province).filter(Boolean));
  return Array.from(set).sort();
}

function buildFilterParams(filters, enabledProvinces = []) {
  const parts = [];
  if (filters.province) {
    parts.push(`province=eq.${encodeURIComponent(filters.province)}`);
  } else if (enabledProvinces.length > 0) {
    // ผู้ใช้ไม่ได้เลือกจังหวัดเจาะจง → จำกัดตามรายชื่อจังหวัดที่ "เปิดใช้งาน" ไว้เท่านั้น
    const list = enabledProvinces.map((p) => encodeURIComponent(p)).join(",");
    parts.push(`province=in.(${list})`);
  }
  if (filters.district) parts.push(`district=eq.${encodeURIComponent(filters.district)}`);
  if (filters.type) parts.push(`type=eq.${encodeURIComponent(filters.type)}`);
  if (filters.search) {
    const q = encodeURIComponent(`%${filters.search}%`);
    parts.push(`or=(name.ilike.${q},project.ilike.${q},address_full.ilike.${q})`);
  }
  return parts.join("&");
}

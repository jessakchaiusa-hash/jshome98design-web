// ===== ตัวช่วยเรียก Supabase REST API (PostgREST) แบบไม่ต้องใช้ library เพิ่ม =====

const REST_URL = `${SUPABASE_URL}/rest/v1/properties`;

function baseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

// นับจำนวนทรัพย์ทั้งหมด (หรือกรองตามเงื่อนไข) — ใช้ HEAD request + Prefer count=exact เร็วและเบา
async function fetchPropertyCount(filters = {}) {
  const params = buildFilterParams(filters);
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
  const params = buildFilterParams(filters);

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

// ดึงรายชื่อจังหวัดที่มีทรัพย์อยู่จริง พร้อมจำนวน (ใช้ RPC ฝั่ง Postgres จะเร็วกว่า
// แต่ทำแบบง่ายด้วย distinct query ผ่าน REST ได้เช่นกันสำหรับจำนวนจังหวัดที่ไม่เยอะมาก)
async function fetchProvinceList() {
  const res = await fetch(
    `${REST_URL}?select=province&order=province.asc`,
    { headers: baseHeaders() }
  );
  const rows = await res.json();
  const set = new Set(rows.map((r) => r.province).filter(Boolean));
  return Array.from(set).sort();
}

// ดึงพิกัดทรัพย์สำหรับแสดงบนแผนที่ (เฉพาะที่มี lat/lng จริง)
// จำกัดจำนวนไว้กันโหลดหนักเกินไป — ถ้ากรองแคบลง (เลือกจังหวัด/อำเภอ) จะได้ครบมากขึ้น
async function fetchPropertiesForMap({ filters = {}, limit = 3000 } = {}) {
  const params = buildFilterParams(filters);
  const extra = "lat=neq.&lng=neq.";
  const query = params ? `${params}&${extra}` : extra;

  const res = await fetch(
    `${REST_URL}?select=ghb_link,name,type,project,province,district,lat,lng&${query}`,
    {
      headers: baseHeaders({ Range: `0-${limit - 1}` }),
    }
  );
  return res.json();
}

function buildFilterParams(filters) {
  const parts = [];
  if (filters.province) parts.push(`province=eq.${encodeURIComponent(filters.province)}`);
  if (filters.district) parts.push(`district=eq.${encodeURIComponent(filters.district)}`);
  if (filters.type) parts.push(`type=eq.${encodeURIComponent(filters.type)}`);
  if (filters.search) {
    // ค้นหาจากชื่อประกาศ, โครงการ, หรือที่อยู่
    const q = encodeURIComponent(`%${filters.search}%`);
    parts.push(`or=(name.ilike.${q},project.ilike.${q},address_full.ilike.${q})`);
  }
  return parts.join("&");
}

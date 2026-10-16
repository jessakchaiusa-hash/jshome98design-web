// ===== ทรัพย์ขายทอดตลาด กรมบังคับคดี (ตาราง led_assets — เติมข้อมูลด้วยส่วนขยาย Chrome) =====
// ใช้ SUPABASE_URL / SUPABASE_ANON_KEY จาก config.js และ baseHeaders() จาก supabase-client.js

const LED_REST_URL = `${SUPABASE_URL}/rest/v1/led_assets`;

const LED_SORT_ORDERS = {
  "": "next_bid_date.asc.nullslast,id.asc",
  price_asc: "appraisal_price.asc.nullslast,id.asc",
  price_desc: "appraisal_price.desc.nullslast,id.asc",
  newest: "first_seen.desc,id.asc",
};

// ประเภทตามที่กรมบังคับคดีใช้
const LED_TYPES = ["ห้องชุด", "ที่ดินพร้อมสิ่งปลูกสร้าง", "ที่ดินว่างเปล่า", "สิ่งปลูกสร้าง"];

function ledFilterParams(f = {}) {
  const p = [];
  if (f.upcoming !== false) p.push("next_bid_date=not.is.null");
  if (f.province) p.push(`province=eq.${encodeURIComponent(f.province)}`);
  if (f.amphoe) p.push(`amphoe=eq.${encodeURIComponent(f.amphoe)}`);
  if (f.type) p.push(`asset_type=eq.${encodeURIComponent(f.type)}`);
  if (f.minPrice) p.push(`appraisal_price=gte.${parseInt(f.minPrice, 10)}`);
  if (f.maxPrice) p.push(`appraisal_price=lte.${parseInt(f.maxPrice, 10)}`);
  if (f.search) {
    const q = encodeURIComponent(`*${f.search}*`);
    p.push(`or=(tambon.ilike.${q},amphoe.ilike.${q},deed_no.ilike.${q},case_no.ilike.${q},remark.ilike.${q})`);
  }
  return p.join("&");
}

async function fetchLedAssets({ filters = {}, page = 1, pageSize = 24 } = {}) {
  const from = (page - 1) * pageSize;
  const order = LED_SORT_ORDERS[filters.sort] || LED_SORT_ORDERS[""];
  const res = await fetch(`${LED_REST_URL}?select=*&order=${order}&${ledFilterParams(filters)}`, {
    headers: baseHeaders({ Range: `${from}-${from + pageSize - 1}`, Prefer: "count=exact" }),
  });
  const range = res.headers.get("content-range");
  return { data: await res.json(), total: range ? parseInt(range.split("/")[1], 10) || 0 : 0 };
}

async function fetchLedForMap({ filters = {}, limit = 20000 } = {}) {
  const q = [ledFilterParams(filters), "lat=not.is.null"].filter(Boolean).join("&");
  const cols = "id,asset_type,tambon,amphoe,province,appraisal_price,next_bid_date,area_rai,area_ngan,area_wa,lot_count,lat,lng,geo_level,image_url";
  let all = [], from = 0;
  while (all.length < limit) {
    const res = await fetch(`${LED_REST_URL}?select=${cols}&${q}`, {
      headers: baseHeaders({ Range: `${from}-${from + 999}` }),
    });
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) break;
    all = all.concat(rows);
    if (rows.length < 1000) break;
    from += 1000;
  }
  return all;
}

// จังหวัด / อำเภอ ที่มีทรัพย์ LED จริง
async function fetchLedDistinct(col, filters = {}) {
  const extra = filters.province && col === "amphoe" ? `&province=eq.${encodeURIComponent(filters.province)}` : "";
  // Supabase ส่งได้ครั้งละไม่เกิน 1,000 แถว → ไล่ทีละช่วงจนครบ
  const set = new Set();
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${LED_REST_URL}?select=${col}&next_bid_date=not.is.null${extra}&order=${col}.asc,id.asc`, {
      headers: baseHeaders({ Range: `${from}-${from + 999}` }),
    });
    const rows = await res.json();
    if (!Array.isArray(rows)) break;
    rows.forEach((r) => r[col] && set.add(r[col]));
    if (rows.length < 1000) break;
  }
  return [...set].sort((a, b) => a.localeCompare(b, "th"));
}

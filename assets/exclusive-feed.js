// ===== JS Home Exclusive — ฟีดลิสติ้ง + การ์ดทรัพย์ (ใช้ร่วมกัน: exclusive.html และหน้าแรก) =====
// ฟีดมาจาก Apps Script (LISTINGS_FEED_URL ใน config.js) ซึ่งอ่านชีตลิสติ้งสดๆ
// ทรัพย์แนะนำบนหน้าแรก = ตาราง featured_listings ใน Supabase (กรอกรหัสทรัพย์เอง)

window.JSHExclusive = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const img = (id, w = 800) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
  const isSold = (s) => /ขายแล้ว|ปิดการเช่า/.test(s || "");
  const money = (v) => typeof v === "number" ? `฿${v.toLocaleString("th-TH")}` : v ? esc(v) : "";
  const FEED_CACHE_KEY = "jsh_exclusive_feed";

  function statusTag(s) {
    if (isSold(s)) return `<span class="excl-status sold">ขายแล้ว</span>`;
    if (/จอง/.test(s || "")) return `<span class="excl-status booked">ติดจอง</span>`;
    return s ? `<span class="excl-status">${esc(s.replace(/^❌/, ""))}</span>` : "";
  }
  function priceLine(p) {
    if (isSold(p.status)) return `<div class="property-price muted">ขายแล้ว</div>`;
    const parts = [];
    if (p.price) parts.push(`<div class="property-price">${money(p.price)}</div>`);
    if (p.rent) parts.push(`<div class="excl-rent">เช่า ${money(p.rent)}${typeof p.rent === "number" ? " /เดือน" : ""}</div>`);
    return parts.join("") || `<div class="property-price muted">สอบถามราคา</div>`;
  }
  function specs(p) {
    return [p.land && `📐 ${esc(p.land)} ตร.ว.`, p.usable && `🏠 ${esc(p.usable)} ตร.ม.`, p.beds && `🛏 ${esc(p.beds)} นอน`,
            p.baths && `🛁 ${esc(p.baths)} น้ำ`, p.floors && `🏢 ${esc(p.floors)} ชั้น`].filter(Boolean);
  }

  // base = หน้าที่เปิดรายละเอียด ("" = หน้าเดียวกัน, "exclusive.html" = จากหน้าแรก)
  // featured = แสดงป้าย "⭐ แนะนำ" (ทรัพย์ในตาราง featured_listings)
  function card(p, base = "", featured = false) {
    const ph = (p.photos || [])[0];
    return `
      <a class="property-card excl-card${isSold(p.status) ? " is-sold" : ""}" href="${base}?c=${encodeURIComponent(p.code)}" data-code="${esc(p.code)}">
        <div class="property-thumb${ph ? "" : " no-img"}">
          <span class="property-type-tag">${esc(p.type || "ทรัพย์")}</span>
          ${statusTag(p.status)}
          ${featured ? `<span class="excl-featured">⭐ แนะนำ</span>` : ""}
          ${ph ? `<img src="${img(ph, 640)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.style.display='none'" />` : ""}
        </div>
        <div class="property-body">
          ${priceLine(p)}
          <h4>${esc(p.name || p.type || "ทรัพย์")}</h4>
          ${p.location ? `<div class="property-loc">📍 ${esc(p.location)}</div>` : ""}
          <div class="property-meta">${specs(p).map((s) => `<span>${s}</span>`).join("")}</div>
          <div class="excl-code">รหัส ${esc(p.code)}</div>
          <div class="property-cta">ดูรายละเอียด →</div>
        </div>
      </a>`;
  }

  // ฟีดตอบช้า (หลายวินาที) → onItems(ชุดที่จำไว้ในเครื่อง, true) ก่อน แล้ว onItems(ชุดสด, false) เมื่อฟีดมาถึง
  // คืนค่า true ถ้าได้ข้อมูลอย่างน้อยหนึ่งชุด
  async function load(onItems) {
    const feedUrl = typeof LISTINGS_FEED_URL !== "undefined" ? LISTINGS_FEED_URL : "";
    let shown = false;
    try {
      const cached = JSON.parse(localStorage.getItem(FEED_CACHE_KEY) || "null");
      if (cached && Array.isArray(cached.items)) { onItems(cached.items, true); shown = true; }
    } catch (e) { /* ข้าม */ }
    if (!feedUrl) return shown;
    try {
      const data = await (await fetch(feedUrl)).json();
      if (!data.ok) throw new Error(data.error || "feed");
      onItems(data.items, false);
      try { localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ at: Date.now(), items: data.items })); } catch (e) { /* ข้าม */ }
      return true;
    } catch (e) {
      console.error("โหลดฟีด JS Home Exclusive ไม่สำเร็จ:", e);
      return shown;
    }
  }

  // รหัสทรัพย์แนะนำจาก Supabase (เรียงตาม sort_order) — ต้องมี SUPABASE_URL / SUPABASE_ANON_KEY จาก config.js
  async function featuredCodes() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/featured_listings?select=code&order=sort_order.asc,created_at.asc`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) throw new Error(`featured_listings ${res.status}`);
    return (await res.json()).map((r) => String(r.code || "").trim()).filter(Boolean);
  }

  return { esc, img, isSold, money, statusTag, priceLine, specs, card, load, featuredCodes, FEED_CACHE_KEY };
})();

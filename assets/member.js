// ===== สมาชิก JS Home (PDPA) =====
// ดูรายการ/แผนที่ได้ฟรี แต่กดลิงก์ไปหน้ารายละเอียดทรัพย์ (ธอส. / กรมบังคับคดี) ต้องสมัครสมาชิกก่อน
// บันทึกผ่านฟังก์ชัน member_signup ใน Supabase เท่านั้น — เว็บอ่านตาราง members ไม่ได้
// ความยินยอมการตลาดเป็นตัวเลือกแยก ไม่ติ๊กไว้ก่อน และไม่ใช่เงื่อนไขในการใช้เว็บ

const MEMBER_POLICY_VERSION = "1.0-draft-2026-10-16";
const MEMBER_STORE_KEY = "jsh_member";
const MEMBER_GATED_HOSTS = ["ghbhomecenter.com", "led.go.th"];

const memberStore = {
  _mem: null,
  get() {
    try {
      const raw = localStorage.getItem(MEMBER_STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* โหมดส่วนตัว / บล็อก storage → ใช้ค่าในหน่วยความจำแทน */ }
    return this._mem;
  },
  set(v) {
    this._mem = v;
    try { localStorage.setItem(MEMBER_STORE_KEY, JSON.stringify(v)); } catch (e) { /* ข้าม */ }
  },
};

async function memberRpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}`);
  return res.json();
}

const MEMBER_ERRORS = {
  invalid_name: "กรุณากรอกชื่อ (อย่างน้อย 2 ตัวอักษร)",
  invalid_phone: "เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)",
  invalid_email: "อีเมลไม่ถูกต้อง",
  terms_required: "กรุณายอมรับข้อตกลงและนโยบายความเป็นส่วนตัว",
  rate_limited: "ส่งข้อมูลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
};

function isGatedLink(href) {
  try {
    const host = new URL(href, location.href).hostname;
    return MEMBER_GATED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch (e) {
    return false;
  }
}

let memberModal = null;
let memberPendingHref = null;

function buildMemberModal() {
  const wrap = document.createElement("div");
  wrap.className = "member-overlay";
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="member-modal" role="dialog" aria-modal="true" aria-labelledby="memberTitle">
      <button type="button" class="member-close" aria-label="ปิด">×</button>
      <div class="member-step" data-step="form">
        <h3 id="memberTitle">สมัครสมาชิกฟรี เพื่อดูรายละเอียดทรัพย์</h3>
        <p class="member-sub">ใช้เวลาไม่ถึง 1 นาที · ไม่มีค่าใช้จ่าย</p>
        <form class="member-form" novalidate>
          <label>ชื่อ-นามสกุล
            <input name="name" autocomplete="name" required maxlength="100" />
          </label>
          <label>เบอร์โทรศัพท์
            <input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" placeholder="08X-XXX-XXXX" />
          </label>
          <label>อีเมล
            <input name="email" type="email" autocomplete="email" required maxlength="254" />
          </label>
          <input name="website" class="member-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />

          <label class="member-check">
            <input type="checkbox" name="terms" required />
            <span>ข้าพเจ้ายอมรับ<a href="privacy.html" target="_blank" rel="noopener">ข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว</a> <b class="member-req">(จำเป็น)</b></span>
          </label>
          <label class="member-check">
            <input type="checkbox" name="marketing" />
            <span>ยินยอมให้ JS Home ติดต่อเสนอข่าวสาร ทรัพย์ และสินค้า/บริการ ทางโทรศัพท์ SMS อีเมล และโฆษณาออนไลน์
              ซึ่งรวมถึงการส่งเบอร์โทร/อีเมลแบบเข้ารหัส (hash) ให้ Meta และ Google เพื่อแสดงโฆษณาให้ตรงกับท่าน
              <span class="member-opt">(ไม่บังคับ — ไม่ติ๊กก็ใช้งานเว็บได้ตามปกติ และถอนความยินยอมได้ทุกเมื่อ)</span></span>
          </label>

          <div class="member-error" role="alert"></div>
          <button type="submit" class="btn btn-primary member-submit">สมัครสมาชิก</button>
        </form>
      </div>
      <div class="member-step" data-step="done" hidden>
        <h3>สมัครเรียบร้อย ขอบคุณครับ</h3>
        <p class="member-sub member-done-msg"></p>
        <a class="btn btn-primary member-go" href="#" target="_blank" rel="noopener">ไปดูรายละเอียดทรัพย์ →</a>
        <button type="button" class="btn btn-ghost member-close-2">กลับไปดูรายการ</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const close = () => closeMemberModal();
  wrap.querySelector(".member-close").addEventListener("click", close);
  wrap.querySelector(".member-close-2").addEventListener("click", close);
  wrap.querySelector(".member-go").addEventListener("click", () => setTimeout(close, 0));
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !wrap.hidden) close();
  });
  wrap.querySelector(".member-form").addEventListener("submit", submitMemberForm);
  return wrap;
}

function openMemberModal(href) {
  if (!memberModal) memberModal = buildMemberModal();
  memberPendingHref = href || null;
  memberModal.querySelector('[data-step="form"]').hidden = false;
  memberModal.querySelector('[data-step="done"]').hidden = true;
  memberModal.querySelector(".member-error").textContent = "";
  memberModal.hidden = false;
  document.body.classList.add("member-lock");
  memberModal.querySelector('input[name="name"]').focus();
}

function closeMemberModal() {
  if (!memberModal) return;
  memberModal.hidden = true;
  document.body.classList.remove("member-lock");
}

async function submitMemberForm(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const errBox = form.querySelector(".member-error");
  const btn = form.querySelector(".member-submit");
  const f = form.elements;
  errBox.textContent = "";

  if (f.name.value.trim().length < 2) return (errBox.textContent = MEMBER_ERRORS.invalid_name);
  if (!/^(\+?66|0)[0-9\s-]{8,12}$/.test(f.phone.value.trim())) return (errBox.textContent = MEMBER_ERRORS.invalid_phone);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) return (errBox.textContent = MEMBER_ERRORS.invalid_email);
  if (!f.terms.checked) return (errBox.textContent = MEMBER_ERRORS.terms_required);

  btn.disabled = true;
  btn.textContent = "กำลังบันทึก…";
  try {
    const r = await memberRpc("member_signup", {
      p_name: f.name.value,
      p_phone: f.phone.value,
      p_email: f.email.value,
      p_accept_terms: f.terms.checked,
      p_marketing_consent: f.marketing.checked,
      p_policy_version: MEMBER_POLICY_VERSION,
      p_source: location.pathname.split("/").pop() || "index.html",
      p_website: f.website.value,
    });
    if (!r.ok) {
      errBox.textContent = MEMBER_ERRORS[r.error] || "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      return;
    }
    memberStore.set({
      at: new Date().toISOString(),
      v: MEMBER_POLICY_VERSION,
      token: r.token || null,
      marketing: r.status === "exists" ? null : f.marketing.checked,
    });
    showMemberDone(r.status);
    form.reset();
  } catch (err) {
    console.error(err);
    errBox.textContent = "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  } finally {
    btn.disabled = false;
    btn.textContent = "สมัครสมาชิก";
  }
}

function showMemberDone(status) {
  const msg = {
    created: "ตอนนี้กดดูรายละเอียดทรัพย์ได้ทุกรายการแล้ว",
    updated: "อัปเดตข้อมูลการรับข่าวสารของท่านแล้ว",
    exists: "เบอร์โทรหรืออีเมลนี้เป็นสมาชิกอยู่แล้ว ใช้งานต่อได้เลย",
  }[status] || "";
  memberModal.querySelector(".member-done-msg").textContent = msg;
  const go = memberModal.querySelector(".member-go");
  if (memberPendingHref) {
    go.href = memberPendingHref;
    go.hidden = false;
  } else {
    go.hidden = true;
  }
  memberModal.querySelector('[data-step="form"]').hidden = true;
  memberModal.querySelector('[data-step="done"]').hidden = false;
  (go.hidden ? memberModal.querySelector(".member-close-2") : go).focus();
}

// ดักคลิกลิงก์ไปหน้ารายละเอียดทรัพย์ (ทั้งในการ์ดและป๊อปอัปแผนที่ที่สร้างทีหลัง)
document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-member-signup]");
  if (opener) {
    e.preventDefault();
    openMemberModal(null);
    return;
  }
  const a = e.target.closest("a[href]");
  if (!a || a.closest(".member-overlay")) return;
  if (!isGatedLink(a.href) || memberStore.get()) return;
  e.preventDefault();
  e.stopPropagation();
  openMemberModal(a.href);
}, true);

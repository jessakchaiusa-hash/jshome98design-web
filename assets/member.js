// ===== สมาชิก JS Home (PDPA) =====
// ดูรายการ/แผนที่ได้ฟรี แต่ดูรายละเอียดทรัพย์ (หน้า ธอส. / หน้ารายละเอียด LED ของเรา) และบันทึกทรัพย์ ต้องสมัครสมาชิกก่อน
// บันทึกผ่านฟังก์ชันใน Supabase เท่านั้น — เว็บอ่านตาราง members / member_saved ไม่ได้
// ความยินยอมการตลาดเป็นตัวเลือกแยก ไม่ติ๊กไว้ก่อน และไม่ใช่เงื่อนไขในการใช้เว็บ
// บัญชี = เบอร์โทร + รหัสผ่าน (bcrypt ใน Supabase) → ล็อกอินแล้วได้ access key เก็บในเบราว์เซอร์

const MEMBER_POLICY_VERSION = "1.1-draft-2026-10-16";
const MEMBER_STORE_KEY = "jsh_member";
const MEMBER_GATED_HOSTS = ["ghbhomecenter.com", "led.go.th"];
const MEMBER_GATED_PAGES = ["led-asset.html", "led-asset"];

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
  invalid_password: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  invalid: "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง",
  locked: "ใส่รหัสผิดหลายครั้ง บัญชีถูกล็อกชั่วคราว 15 นาที",
  wrong_old_password: "รหัสผ่านเดิมไม่ถูกต้อง",
};

function isGatedLink(href) {
  try {
    const u = new URL(href, location.href);
    if (u.origin === location.origin) {
      const page = u.pathname.split("/").pop();
      return MEMBER_GATED_PAGES.includes(page);
    }
    return MEMBER_GATED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch (e) {
    return false;
  }
}

function memberToast(text) {
  let t = document.querySelector(".member-toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "member-toast";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2600);
}

let memberModal = null;
let memberPendingHref = null;
let memberAfterSignup = null;
let memberModalCloseHref = null;

function buildMemberModal() {
  const wrap = document.createElement("div");
  wrap.className = "member-overlay";
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="member-modal" role="dialog" aria-modal="true" aria-labelledby="memberTitle">
      <button type="button" class="member-close" aria-label="ปิด">×</button>
      <div class="member-tabs" role="tablist">
        <button type="button" class="member-tab is-active" data-tab="signup" role="tab">สมัครสมาชิก</button>
        <button type="button" class="member-tab" data-tab="login" role="tab">เข้าสู่ระบบ</button>
      </div>
      <div class="member-step" data-step="login" hidden>
        <h3>เข้าสู่ระบบสมาชิก</h3>
        <p class="member-sub">ใช้เบอร์โทรและรหัสผ่านที่ตั้งไว้ตอนสมัคร</p>
        <form class="member-login" novalidate>
          <label>เบอร์โทรศัพท์
            <input name="phone" type="tel" inputmode="tel" autocomplete="username" required maxlength="20" placeholder="08X-XXX-XXXX" />
          </label>
          <label>รหัสผ่าน
            <input name="password" type="password" autocomplete="current-password" required maxlength="72" />
          </label>
          <div class="member-error" role="alert"></div>
          <button type="submit" class="btn btn-primary member-submit">เข้าสู่ระบบ</button>
          <p class="member-sub member-forgot">ลืมรหัสผ่าน? ติดต่อ JS Home ที่
            <a href="mailto:jessakchaiusa@gmail.com?subject=${encodeURIComponent("ขอรีเซ็ตรหัสผ่านสมาชิก JS Home")}">jessakchaiusa@gmail.com</a>
            พร้อมแจ้งเบอร์โทรและอีเมลที่ใช้สมัคร</p>
        </form>
      </div>
      <div class="member-step" data-step="form">
        <h3 id="memberTitle">สมัครสมาชิกฟรี เพื่อดูรายละเอียดทรัพย์</h3>
        <p class="member-sub">ใช้เวลาไม่ถึง 1 นาที · ไม่มีค่าใช้จ่าย · บันทึกทรัพย์ที่สนใจไว้ดูภายหลังได้</p>
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
          <label>ตั้งรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
            <input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="72" />
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
        <h3 class="member-done-title">สมัครเรียบร้อย ขอบคุณครับ</h3>
        <p class="member-sub member-done-msg"></p>
        <a class="btn btn-primary member-go" href="#" rel="noopener">ไปดูรายละเอียดทรัพย์ →</a>
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
  wrap.querySelector(".member-login").addEventListener("submit", submitLoginForm);
  wrap.querySelectorAll(".member-tab").forEach((t) => t.addEventListener("click", () => showMemberTab(t.dataset.tab)));
  return wrap;
}

// สลับแท็บ สมัครสมาชิก / เข้าสู่ระบบ
function showMemberTab(tab, message = "") {
  const login = tab === "login";
  memberModal.querySelectorAll(".member-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tab));
  memberModal.querySelector(".member-tabs").hidden = false;
  memberModal.querySelector('[data-step="form"]').hidden = login;
  memberModal.querySelector('[data-step="login"]').hidden = !login;
  memberModal.querySelector('[data-step="done"]').hidden = true;
  memberModal.querySelectorAll(".member-error").forEach((el) => { el.textContent = ""; });
  if (message) memberModal.querySelector(`[data-step="${login ? "login" : "form"}"] .member-error`).textContent = message;
  memberModal.querySelector(login ? '.member-login input[name="phone"]' : 'input[name="name"]').focus();
}

// href: ลิงก์ที่จะไปต่อหลังสมัคร/ล็อกอิน · opts.after: ทำต่อเมื่อสำเร็จ · opts.closeHref: ปิดโดยไม่สมัคร → ไปหน้านี้
// opts.mode: "signup" (ค่าเริ่มต้น) หรือ "login"
function openMemberModal(href, opts = {}) {
  if (!memberModal) memberModal = buildMemberModal();
  memberPendingHref = href || null;
  memberAfterSignup = opts.after || null;
  memberModalCloseHref = opts.closeHref || null;
  memberModal.hidden = false;
  document.body.classList.add("member-lock");
  showMemberTab(opts.mode === "login" ? "login" : "signup");
}

function closeMemberModal() {
  if (!memberModal) return;
  memberModal.hidden = true;
  document.body.classList.remove("member-lock");
  if (memberModalCloseHref && !memberStore.get()) location.href = memberModalCloseHref;
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
  if (f.password.value.length < 8) return (errBox.textContent = MEMBER_ERRORS.invalid_password);
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
      p_password: f.password.value,
    });
    if (!r.ok) {
      errBox.textContent = MEMBER_ERRORS[r.error] || "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      return;
    }
    // เป็นสมาชิกอยู่แล้ว → ให้ล็อกอินด้วยรหัสผ่านแทน
    if (r.status === "has_password" || r.status === "exists") {
      const phone = f.phone.value;
      form.reset();
      showMemberTab("login", r.status === "has_password"
        ? "เบอร์นี้เป็นสมาชิกแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่าน"
        : "เบอร์โทรหรืออีเมลนี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบ (ลืมรหัสผ่านติดต่อแอดมินด้านล่าง)");
      memberModal.querySelector('.member-login input[name="phone"]').value = phone;
      memberModal.querySelector('.member-login input[name="password"]').focus();
      return;
    }
    memberSignedIn(r, r.status, f.marketing.checked);
    form.reset();
  } catch (err) {
    console.error(err);
    errBox.textContent = "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  } finally {
    btn.disabled = false;
    btn.textContent = "สมัครสมาชิก";
  }
}

// สมัคร/ล็อกอินสำเร็จ → เก็บกุญแจบัญชีในเครื่อง แสดงหน้าสำเร็จ แล้วทำงานที่ค้างไว้ (เช่น กด ♥)
function memberSignedIn(r, status, marketing = null) {
  const prev = memberStore.get() || {};
  memberStore.set({
    at: new Date().toISOString(),
    v: MEMBER_POLICY_VERSION,
    token: r.token || prev.token || null,
    key: r.key || prev.key || null,
    name: r.name || prev.name || null,
    marketing: marketing ?? prev.marketing ?? null,
  });
  savedState.loaded = null; // บัญชีอาจเปลี่ยน → โหลดรายการบันทึกใหม่
  showMemberDone(status);
  renderAccountButton();
  if (memberAfterSignup) {
    const fn = memberAfterSignup;
    memberAfterSignup = null;
    fn();
  } else {
    loadSaved(true).then(() => refreshSaveButtons());
  }
}

async function submitLoginForm(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const errBox = form.querySelector(".member-error");
  const btn = form.querySelector(".member-submit");
  const f = form.elements;
  errBox.textContent = "";
  if (!/^(\+?66|0)[0-9\s-]{8,12}$/.test(f.phone.value.trim())) return (errBox.textContent = MEMBER_ERRORS.invalid_phone);
  if (!f.password.value) return (errBox.textContent = MEMBER_ERRORS.invalid);
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ…";
  try {
    const r = await memberRpc("member_login", { p_phone: f.phone.value, p_password: f.password.value });
    if (!r.ok) {
      errBox.textContent = MEMBER_ERRORS[r.error] || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
      return;
    }
    form.reset();
    memberSignedIn(r, "login");
  } catch (err) {
    console.error(err);
    errBox.textContent = "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  } finally {
    btn.disabled = false;
    btn.textContent = "เข้าสู่ระบบ";
  }
}

function memberLogout() {
  try { localStorage.removeItem(MEMBER_STORE_KEY); } catch (e) { /* ข้าม */ }
  memberStore._mem = null;
  savedState.loaded = null;
  savedState.set = new Set();
  savedState.items = [];
  memberToast("ออกจากระบบแล้ว");
  setTimeout(() => location.reload(), 600);
}

// ปุ่มบัญชีบนหัวเว็บ: ยังไม่ล็อกอิน = "เข้าสู่ระบบ" · ล็อกอินแล้ว = ชื่อ + ออกจากระบบ
function renderAccountButton() {
  const head = document.querySelector(".site-header .container");
  if (!head) return;
  let box = head.querySelector(".member-account");
  if (!box) {
    box = document.createElement("div");
    box.className = "member-account";
    const lastBtn = head.querySelector(":scope > .btn");
    head.insertBefore(box, lastBtn || null);
  }
  const m = memberStore.get();
  const safe = (x) => String(x).replace(/[&<>"']/g, "");
  if (m && m.key) {
    const first = String(m.name || "สมาชิก").split(" ")[0];
    box.innerHTML = `<a href="saved.html" class="member-hello" title="ทรัพย์ที่บันทึก">👤 ${safe(first)}</a>
      <button type="button" class="member-logout">ออกจากระบบ</button>`;
    box.querySelector(".member-logout").addEventListener("click", memberLogout);
  } else {
    box.innerHTML = `<button type="button" class="member-login-btn">เข้าสู่ระบบ</button>`;
    box.querySelector(".member-login-btn").addEventListener("click", () => openMemberModal(null, { mode: "login" }));
  }
}

function showMemberDone(status) {
  const msg = {
    created: "ตอนนี้ดูรายละเอียดและบันทึกทรัพย์ได้ทุกรายการแล้ว ครั้งหน้าเข้าสู่ระบบด้วยเบอร์โทร + รหัสผ่านได้เลย",
    updated: "ยินดีต้อนรับกลับ ตั้งรหัสผ่านเรียบร้อย ครั้งหน้าเข้าสู่ระบบด้วยเบอร์โทร + รหัสผ่านได้เลย",
    login: "เข้าสู่ระบบเรียบร้อย",
  }[status] || "";
  memberModal.querySelector(".member-done-title").textContent = status === "login" ? "ยินดีต้อนรับกลับครับ" : "สมัครเรียบร้อย ขอบคุณครับ";
  memberModal.querySelector(".member-tabs").hidden = true;
  memberModal.querySelector('[data-step="login"]').hidden = true;
  memberModal.querySelector(".member-done-msg").textContent = msg;
  memberModalCloseHref = null;
  const go = memberModal.querySelector(".member-go");
  if (memberPendingHref) {
    go.href = memberPendingHref;
    go.target = new URL(memberPendingHref, location.href).origin === location.origin ? "_self" : "_blank";
    go.hidden = false;
  } else {
    go.hidden = true;
  }
  memberModal.querySelector('[data-step="form"]').hidden = true;
  memberModal.querySelector('[data-step="done"]').hidden = false;
  (go.hidden ? memberModal.querySelector(".member-close-2") : go).focus();
}

// ===== ทรัพย์ที่บันทึกไว้ =====
const savedState = { loaded: null, set: new Set(), items: [] };
const savedId = (kind, ref) => `${kind}:${ref}`;

// คืน access key ของเครื่องนี้ (สมาชิกเก่าที่มีแต่ token → ขอ key อัตโนมัติ)
async function memberKey() {
  const m = memberStore.get();
  if (!m) return null;
  if (m.key) return m.key;
  if (m.token) {
    try {
      const r = await memberRpc("member_claim_key", { p_token: m.token });
      if (r.ok && r.key) {
        memberStore.set({ ...m, key: r.key });
        return r.key;
      }
    } catch (e) { console.error(e); }
  }
  return null;
}

async function loadSaved(force = false) {
  if (savedState.loaded && !force) return savedState.loaded;
  savedState.loaded = (async () => {
    const key = await memberKey();
    if (!key) return savedState;
    try {
      const r = await memberRpc("member_saved_list", { p_key: key });
      if (r.ok) {
        savedState.items = r.items || [];
        savedState.set = new Set(savedState.items.map((i) => savedId(i.kind, i.ref)));
      }
    } catch (e) { console.error(e); }
    return savedState;
  })();
  return savedState.loaded;
}

// ปุ่มหัวใจ: <button class="save-btn" data-save-kind="led" data-save-ref="..." data-save-snap='{"title":..}'>
function saveButtonHtml(kind, ref, snap, extraClass = "") {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const on = savedState.set.has(savedId(kind, String(ref)));
  return `<button type="button" class="save-btn${on ? " is-saved" : ""} ${extraClass}" aria-pressed="${on}"
    aria-label="บันทึกทรัพย์" title="บันทึกทรัพย์ที่สนใจ"
    data-save-kind="${esc(kind)}" data-save-ref="${esc(ref)}" data-save-snap="${esc(JSON.stringify(snap || {}))}">
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>
  </button>`;
}

function refreshSaveButtons(root = document) {
  root.querySelectorAll("[data-save-kind]").forEach((b) => {
    const on = savedState.set.has(savedId(b.dataset.saveKind, b.dataset.saveRef));
    b.classList.toggle("is-saved", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

async function toggleSaved(btn) {
  const kind = btn.dataset.saveKind, ref = btn.dataset.saveRef;
  if (!memberStore.get()) {
    openMemberModal(null, { after: () => toggleSaved(btn) });
    return;
  }
  const key = await memberKey();
  if (!key) {
    memberToast("กรุณาเข้าสู่ระบบด้วยเบอร์โทร + รหัสผ่าน เพื่อบันทึกทรัพย์");
    openMemberModal(null, { mode: "login", after: () => toggleSaved(btn) });
    return;
  }
  await loadSaved();
  const id = savedId(kind, ref);
  const save = !savedState.set.has(id);
  let snap = null;
  try { snap = JSON.parse(btn.dataset.saveSnap || "null"); } catch (e) { /* ข้าม */ }
  btn.disabled = true;
  try {
    const r = await memberRpc("member_saved_set", { p_key: key, p_kind: kind, p_ref: ref, p_save: save, p_snapshot: snap });
    if (!r.ok) {
      memberToast(r.error === "limit" ? "บันทึกได้สูงสุด 500 รายการ" :
                  r.error === "rate_limited" ? MEMBER_ERRORS.rate_limited : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }
    if (r.saved) {
      savedState.set.add(id);
      savedState.items.unshift({ kind, ref, snapshot: snap, created_at: new Date().toISOString() });
    } else {
      savedState.set.delete(id);
      savedState.items = savedState.items.filter((i) => savedId(i.kind, i.ref) !== id);
    }
    refreshSaveButtons();
    memberToast(r.saved ? "บันทึกแล้ว ♥ ดูได้ที่เมนู 'ทรัพย์ที่บันทึก'" : "นำออกจากรายการที่บันทึกแล้ว");
    document.dispatchEvent(new CustomEvent("member-saved-change", { detail: { kind, ref, saved: r.saved } }));
  } catch (e) {
    console.error(e);
    memberToast("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
  } finally {
    btn.disabled = false;
  }
}

// ===== ค้นหาล่าสุด (เก็บในเครื่องเท่านั้น) =====
const recentSearches = {
  key: (scope) => `jsh_recent_${scope}`,
  list(scope) {
    try { return JSON.parse(localStorage.getItem(this.key(scope)) || "[]"); } catch (e) { return []; }
  },
  add(scope, filters, label) {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    if (!label) return;
    const sig = JSON.stringify(clean);
    const list = this.list(scope).filter((x) => JSON.stringify(x.filters) !== sig);
    list.unshift({ filters: clean, label, at: Date.now() });
    try { localStorage.setItem(this.key(scope), JSON.stringify(list.slice(0, 8))); } catch (e) { /* ข้าม */ }
  },
  clear(scope) {
    try { localStorage.removeItem(this.key(scope)); } catch (e) { /* ข้าม */ }
  },
};

// วาดแถบ "ค้นหาล่าสุด" ลงใน container — onPick(filters) เมื่อกดเลือก
function renderRecentSearches(container, scope, onPick) {
  if (!container) return;
  const list = recentSearches.list(scope);
  if (!list.length) { container.hidden = true; container.innerHTML = ""; return; }
  container.hidden = false;
  container.innerHTML = `<span class="recent-label">🕘 ค้นหาล่าสุด</span>`;
  list.forEach((x) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "recent-chip";
    b.textContent = x.label;
    b.addEventListener("click", () => onPick(x.filters));
    container.appendChild(b);
  });
  const clr = document.createElement("button");
  clr.type = "button";
  clr.className = "recent-clear";
  clr.textContent = "ล้าง";
  clr.addEventListener("click", () => { recentSearches.clear(scope); renderRecentSearches(container, scope, onPick); });
  container.appendChild(clr);
}

// ===== ดักคลิก =====
document.addEventListener("click", (e) => {
  const saveBtn = e.target.closest("[data-save-kind]");
  if (saveBtn) {
    e.preventDefault();
    e.stopPropagation();
    toggleSaved(saveBtn);
    return;
  }
  const opener = e.target.closest("[data-member-signup]");
  if (opener) {
    e.preventDefault();
    openMemberModal(null);
    return;
  }
  // ลิงก์ไปหน้ารายละเอียดทรัพย์ (ทั้งในการ์ดและป๊อปอัปแผนที่ที่สร้างทีหลัง)
  const a = e.target.closest("a[href]");
  if (!a || a.closest(".member-overlay")) return;
  if (!isGatedLink(a.href) || memberStore.get()) return;
  e.preventDefault();
  e.stopPropagation();
  openMemberModal(a.href);
}, true);

// สมาชิก → โหลดรายการที่บันทึกไว้ แล้วอัปเดตหัวใจบนหน้า
if (memberStore.get()) loadSaved().then(() => refreshSaveButtons());
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderAccountButton);
else renderAccountButton();

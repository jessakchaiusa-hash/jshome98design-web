// ===== เมนู 3 ขีดสำหรับมือถือ =====
// สร้างปุ่ม ☰ ในหัวเว็บทุกหน้า + แผงเมนูเต็ม (เมนูชุดเดียวกันทุกหน้า แก้ที่นี่ที่เดียว)
// จอกว้าง (> 860px) ใช้เมนูเดิมในหัวเว็บ ปุ่ม ☰ ถูกซ่อนด้วย CSS

(() => {
  const MAIN = [
    { href: "exclusive.html", icon: "⭐", label: "ทรัพย์พร้อมขาย", sub: "JS Home Exclusive" },
    { href: "properties.html", icon: "🏠", label: "ทรัพย์ NPA ธอส.", sub: "บ้านมือสองธนาคารอาคารสงเคราะห์" },
    { href: "led.html", icon: "⚖️", label: "ทรัพย์กรมบังคับคดี", sub: "ทรัพย์ขายทอดตลาด (NPL)" },
  ];
  const MORE = [
    { href: "index.html", label: "หน้าแรก" },
    { href: "consign.html", label: "ฝากขายทรัพย์" },
    { href: "saved.html", label: "♥ ทรัพย์ที่บันทึก" },
    { href: "privacy.html", label: "นโยบายความเป็นส่วนตัว" },
  ];

  const header = document.querySelector(".site-header .container");
  if (!header) return;

  // หน้าปัจจุบัน (Cloudflare Pages ตัด .html ออกจาก URL ได้ → เทียบชื่อไม่มีนามสกุล)
  const here = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  const isHere = (href) => href.replace(/\.html$/, "") === here;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "nav-toggle";
  btn.setAttribute("aria-label", "เปิดเมนู");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "mobileNav");
  btn.innerHTML = "<span></span><span></span><span></span>";
  header.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "mobileNav";
  panel.className = "mobile-nav";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="mobile-nav-backdrop" data-close></div>
    <nav class="mobile-nav-sheet" aria-label="เมนูหลัก">
      <div class="mobile-nav-head">
        <span>เมนู</span>
        <button type="button" class="mobile-nav-close" data-close aria-label="ปิดเมนู">✕</button>
      </div>
      <div class="mobile-nav-main">
        ${MAIN.map((m) => `
          <a href="${m.href}" class="mobile-nav-main-item${isHere(m.href) ? " current" : ""}">
            <span class="mobile-nav-icon">${m.icon}</span>
            <span><b>${m.label}</b><small>${m.sub}</small></span>
          </a>`).join("")}
      </div>
      <div class="mobile-nav-more">
        ${MORE.map((m) => `<a href="${m.href}"${isHere(m.href) ? ' class="current"' : ""}>${m.label}</a>`).join("")}
      </div>
    </nav>`;
  document.body.appendChild(panel);

  const open = (yes) => {
    panel.hidden = !yes;
    btn.setAttribute("aria-expanded", String(yes));
    btn.setAttribute("aria-label", yes ? "ปิดเมนู" : "เปิดเมนู");
    document.documentElement.classList.toggle("nav-open", yes);
  };
  btn.addEventListener("click", () => open(panel.hidden));
  panel.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) open(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) open(false); });
  // กลับมาจอกว้าง → ปิดแผงที่ค้างไว้
  matchMedia("(min-width: 861px)").addEventListener("change", (e) => e.matches && open(false));
})();

"use strict";
const $ = s => document.querySelector(s);
const fa = s => String(s).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPES = { "عمومی": "پزشکان عمومی", "دندانپزشک": "دندان‌پزشکان", "متخصص": "پزشکان متخصص" };

const CACHE_KEY = "mh_full_cache_v3";

const S = {
  doctors: [],
  days: [],
  slotsMap: {},
  doc: null,
  date: null,
  time: null,
  type: null,
  email: "",
  form: {},
  after: null,
  res: null,
  stack: [],
  view: null,
  loaded: false,
  err: "",
  guest: {},
  user: JSON.parse(localStorage.getItem("mh_user") || "null")
};

/* ---------- ابزارهای ورودی: ارقام فارسی/عربی/انگلیسی یکسان‌اند ---------- */
const DIG = s => String(s ?? "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const cleanNum = s => DIG(s).replace(/[\s\u200c\u200e\u200f\-]/g, "");
const validNid = v => /^\d{10}$/.test(v);
const validMob = v => /^09\d{9}$/.test(v);
const fld = (id, label, ph, val, attrs = "") => `<div class="fld"><label for="${id}">${label}</label><input id="${id}" placeholder="${ph}" value="${esc(val)}" ${attrs}></div>`;
const readGuest = () => { if ($("#gName")) S.guest = { name: $("#gName").value, mob: $("#gMobile").value, nid: $("#gNid").value }; };

function applyFullData(d, saveToLocal = true) {
  if (!d || !Array.isArray(d.doctors)) return false;
  S.doctors = d.doctors;
  S.days = d.days || [];
  if (d.slots) S.slotsMap = { ...S.slotsMap, ...d.slots };
  S.loaded = true;
  S.err = "";
  if (saveToLocal) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        doctors: S.doctors,
        days: S.days,
        slots: S.slotsMap,
        ts: Date.now()
      }));
    } catch (e) {}
  }
  renderDoctors();
  if (window.onDoctorsReady) window.onDoctorsReady();
  if (wz && wz.open && (S.view === "doc" || S.view === "day" || S.view === "time")) {
    render();
  }
  return true;
}

(function loadFromLocalCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Array.isArray(cached.doctors) && cached.doctors.length) {
      S.doctors = cached.doctors;
      S.days = cached.days || [];
      S.slotsMap = cached.slots || {};
      S.loaded = true;
    }
  } catch (e) {}
})();

async function api(a, data = {}, post = false, retries = 2) {
  if (!API_URL || API_URL.startsWith("PASTE")) throw new Error("آدرس API در js/config.js تنظیم نشده است.");
  const body = { a, ...data };
  for (let i = 0; i <= retries; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const r = post
        ? await fetch(API_URL, { method: "POST", body: JSON.stringify(body), signal: ctrl.signal })
        : await fetch(API_URL + "?" + new URLSearchParams(body), { signal: ctrl.signal });
      clearTimeout(timer);
      const j = await r.json();
      if (j.error) {
        if (j.error.includes("نشست")) logout("expired");
        throw new Error(j.error);
      }
      return j;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(res => setTimeout(res, 500));
    }
  }
}

const docById = id => S.doctors.find(d => d.id === id) || { name: "" };
const dayObj = () => S.days.find(x => x.iso === S.date) || { day: "", j: "" };
const AVATAR = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="11" fill="currentColor"/><path d="M10 64c0-13 9.500-22 22-22s22 9 22 22z" fill="currentColor"/></svg>';
const avatar = d => d.photo ? `<img src="${esc(d.photo)}" alt="" loading="lazy">` : AVATAR;
const chip = (label, attrs, on, dis, cls = "", tip = "") => `<button type="button" class="chip${on ? " on" : ""}${cls ? " " + cls : ""}" ${dis ? "disabled" : ""}${tip ? ` title="${tip}"` : ""} ${attrs}>${label}</button>`;

function weekHtml(d) {
  if (!d.week || !d.week.length) return "<span>برنامه بر اساس تاریخ</span>";
  const order = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"], by = {};
  d.week.forEach(w => (by[w[0]] = by[w[0]] || []).push(fa(w[1]) + "–" + fa(w[2])));
  return order.filter(k => by[k]).map(k => `<span><b>${k}</b> ${by[k].join(" و ")}</span>`).join("");
}

function renderDoctors() {
  const box = $("#doctorList");
  if (!box) return;
  box.innerHTML = Object.keys(TYPES).map(t => {
    const list = S.doctors.filter(d => d.type === t);
    if (!list.length) return "";
    return `<h3 class="grp">${TYPES[t]}</h3><div class="doc-grid">` + list.map(d => `
      <article class="doc-card rv"><div class="av" data-prof="${esc(d.id)}" aria-hidden="true">${avatar(d)}</div><h4 data-prof="${esc(d.id)}" role="link" tabindex="0">${esc(d.name)}</h4>
      ${d.specialty ? `<span class="tag">${esc(d.specialty)}</span>` : ""}
      <div class="doc-rt">${ratingHtml(d)}</div>
      <button type="button" class="doc-link" data-prof="${esc(d.id)}">پروفایل و نظرات کاربران</button>
      <button type="button" class="doc-btn" data-doc="${esc(d.id)}">برنامه و دریافت نوبت ←</button></article>`).join("") + `</div>`;
  }).join("") || "<p>فهرست پزشکان به‌زودی اضافه می‌شود.</p>";
  reveal();
}

const wz = $("#wz"), body = $("#wzBody");
const TITLES = { doc: "انتخاب پزشک", day: "انتخاب روز", time: "انتخاب ساعت حضور", auth: "ورود یا ثبت‌نام", guest: "ثبت نوبت", code: "کد تأیید", confirm: "تأیید نهایی", done: "رسید نوبت", mine: "نوبت‌های من" };
const STEP = { doc: 1, day: 2, time: 3, auth: 4, code: 4, confirm: 4, guest: 4 };

function openWz(v) {
  S.stack = []; S.view = null; S.date = null; S.time = null;
  if (v === "doc") S.doc = null;
  S.after = null;
  if (v === "mine" && !S.user) { S.after = "mine"; v = "auth"; }
  if (v === "login") { if (S.user) return; S.after = "close"; v = "auth"; }
  if (!wz.open) wz.showModal();
  go(v, false);
}
function go(v, push = true) { if (push && S.view) S.stack.push(S.view); S.view = v; render(); }
function back() { const v = S.stack.pop(); if (!v) return closeWz(); S.view = v; render(); }
function closeWz() { if (wz.open) wz.close(); }

function render() {
  const v = S.view;
  $("#wzTitle").textContent = TITLES[v];
  $("#wzBack").hidden = !S.stack.length || v === "done";
  $("#wzProg").innerHTML = STEP[v] && ((v !== "auth" && v !== "code") || S.after === "confirm") ? [1, 2, 3, 4].map(i => `<i class="${i <= STEP[v] ? "on" : ""}"></i>`).join("") : "";
  body.className = "wz-body"; void body.offsetWidth; body.className = "wz-body vin" + (v === "guest" ? " gst" : ""); body.scrollTop = 0;
  VIEWS[v]();
}

const row = d => `<button type="button" class="dc" data-a="pickDoc" data-id="${esc(d.id)}"><span class="av sm" aria-hidden="true">${avatar(d)}</span><span class="dc-t"><b>${esc(d.name)}</b>${d.specialty ? `<small>${esc(d.specialty)}</small>` : ""}<span class="wk">${weekHtml(d)}</span></span><span class="arr" aria-hidden="true">‹</span></button>`;

const VIEWS = {
  doc() {
    if (!S.loaded) {
      body.innerHTML = S.err ? `<p class="err">${esc(S.err)}</p>` : '<p class="ld">در حال آماده‌سازی فهرست پزشکان…</p>';
      return;
    }
    const list = S.doctors.filter(d => !S.type || d.type === S.type);
    body.innerHTML = !list.length ? "<p>پزشکی ثبت نشده است.</p>" : S.type ? list.map(row).join("") :
      Object.keys(TYPES).map(t => { const l = list.filter(d => d.type === t); return l.length ? `<h4 class="grp">${TYPES[t]}</h4>` + l.map(row).join("") : ""; }).join("");
  },
  day() {
    const d = docById(S.doc), list = S.days.filter(x => x.docs[S.doc] !== undefined);
    body.innerHTML = `<p class="wz-sub">${esc(d.name)}</p>` + (list.length ? `<div class="chips">` + list.map(x => chip(`${x.day}<br>${fa(x.j.slice(5))}<br><em>${x.off && x.off[S.doc] ? "غیرفعال" : x.docs[S.doc] ? fa(x.docs[S.doc]) + " نوبت خالی" : "تکمیل"}</em>`, `data-a="pickDay" data-iso="${x.iso}"`, false, !x.docs[S.doc], x.off && x.off[S.doc] ? "off" : "")).join("") + `</div>` : "<p>در روزهای آینده برنامه‌ای ثبت نشده است.</p>");
  },
  async time() {
    const x = dayObj();
    const cacheKey = `${S.doc}_${S.date}`;
    const renderSlotsHtml = (slots) => {
      const tm = $("#tm");
      if (!tm) return;
      tm.innerHTML = slots.map(s => chip(fa(s.time), `data-a="pickTime" data-t="${s.time}"`, false, !s.free, s.blocked ? "off" : "", s.blocked ? "غیرفعال شده توسط درمانگاه" : "")).join("") || "<small>زمانی وجود ندارد.</small>";
      if (slots.some(s => s.blocked) && !body.querySelector(".legend")) {
        tm.insertAdjacentHTML("afterend", `<p class="legend"><i></i> ساعت‌های قرمز توسط درمانگاه غیرفعال شده‌اند.</p>`);
      }
    };

    body.innerHTML = `<p class="wz-sub">${esc(docById(S.doc).name)} | ${x.day} ${fa(x.j)}</p><div class="chips" id="tm"></div><div id="msg" class="err" role="alert"></div>`;

    if (S.slotsMap[cacheKey]) {
      renderSlotsHtml(S.slotsMap[cacheKey]);
    } else {
      $("#tm").innerHTML = '<small class="ld">در حال دریافت ساعت‌ها…</small>';
    }

    try {
      const { slots } = await api("slots", { doctor: S.doc, date: S.date }, false, 1);
      S.slotsMap[cacheKey] = slots;
      if (S.view === "time") renderSlotsHtml(slots);
    } catch (e) {
      if (!S.slotsMap[cacheKey]) {
        $("#tm").innerHTML = "";
        $("#msg").textContent = e.message;
      }
    }
  },
  auth() {
    const f = S.form, opt = S.after === "confirm";
    body.innerHTML = `<p class="wz-sub">${opt ? "ثبت‌نام اختیاری است. کد ورود به ایمیل شما ارسال می‌شود." : "کد ورود به ایمیل شما ارسال می‌شود."}</p><div class="form-grid">
      ${fld("fName", "نام و نام خانوادگی", "نام و نام خانوادگی", f.name, 'autocomplete="name"')}
      ${fld("fMobile", "شماره موبایل", "مثلاً ۰۹۱۲۳۴۵۶۷۸۹", f.mob, 'inputmode="numeric" maxlength="11" pattern="[0-9]*" autocomplete="tel" data-len="11"')}
      ${fld("fNid", "کد ملی (۱۰ رقم)", "کد ملی ۱۰ رقمی", f.nid, 'inputmode="numeric" maxlength="10" pattern="[0-9]*" autocomplete="off" data-len="10"')}
      ${fld("fEmail", "ایمیل", "ایمیل", f.email, 'type="email" dir="ltr" autocomplete="email"')}</div>
      <button type="button" class="primary-button wide" data-a="sendCode">ارسال کد ورود</button>
      ${opt ? '<div class="alt-row"><button type="button" class="dl-btn wide" data-a="toGuest">ادامه بدون ثبت‌نام</button></div>' : ""}
      <div id="authMsg" class="err" role="alert"></div>`;
  },
  guest() {
    const x = dayObj(), g = S.guest;
    body.innerHTML = `<div class="sum"><div><span>پزشک</span><b>${esc(docById(S.doc).name)}</b></div><div><span>روز</span><b>${x.day} ${fa(x.j)}</b></div><div><span>ساعت حضور</span><b>${fa(S.time)}</b></div></div>
      <div class="form-grid">
        ${fld("gName", "نام و نام خانوادگی", "نام و نام خانوادگی", g.name || "", 'autocomplete="name"')}
        ${fld("gMobile", "شماره تماس (موبایل)", "مثلاً ۰۹۱۲۳۴۵۶۷۸۹", g.mob || "", 'inputmode="numeric" maxlength="11" pattern="[0-9]*" autocomplete="tel" data-len="11"')}
        ${fld("gNid", "کد ملی (۱۰ رقم)", "کد ملی ۱۰ رقمی", g.nid || "", 'inputmode="numeric" maxlength="10" pattern="[0-9]*" autocomplete="off" data-len="10"')}
      </div>
      <button type="button" class="primary-button wide" data-a="gbook">ثبت نوبت</button><div id="msg" class="err" role="alert"></div>
      <p class="alt-row">می‌خواهید حساب کاربری بسازید؟ <button type="button" class="link-btn" data-a="toAuth">ورود / ثبت‌نام</button> (اختیاری)</p>`;
  },
  code() {
    body.innerHTML = `<p class="wz-sub">کد ۶ رقمی به <b dir="ltr">${esc(S.email)}</b> ارسال شد (پوشهٔ اسپم را هم ببینید).</p>
      <div class="form-grid"><input id="fCode" placeholder="کد ۶ رقمی" inputmode="numeric" dir="ltr" autocomplete="one-time-code"></div>
      <button type="button" class="primary-button wide" data-a="verify">ورود</button><div id="authMsg" class="err" role="alert"></div>`;
  },
  confirm() {
    const x = dayObj();
    body.innerHTML = `<div class="sum"><div><span>پزشک</span><b>${esc(docById(S.doc).name)}</b></div><div><span>روز</span><b>${x.day} ${fa(x.j)}</b></div><div><span>ساعت حضور</span><b>${fa(S.time)}</b></div><div><span>نام</span><b>${esc(S.user.name)}</b></div></div>
      ${S.user.hasNid ? "" : `<div class="form-grid">${fld("cNid", "کد ملی (۱۰ رقم)", "کد ملی ۱۰ رقمی", "", 'inputmode="numeric" maxlength="10" pattern="[0-9]*" autocomplete="off" data-len="10"')}</div>`}
      <button type="button" class="primary-button wide" data-a="book">تأیید و ثبت نوبت</button><div id="msg" class="err" role="alert"></div>`;
  },
  done() {
    const r = receiptData();
    body.classList.add("rc");
    body.innerHTML = `<p class="rc-ok">نوبت رزرو شما با موفقیت ثبت شد.</p>
      <div class="rc-list">${r.rows.map(([k, v, dir]) => `<div><span>${k}</span><b${dir ? ` dir="${dir}"` : ""}>${esc(v)}</b></div>`).join("")}</div>
      <p class="rc-note">${rcNotes().join(" ")}</p>
      <div class="dl-row">
        <button type="button" class="dl-btn" data-a="dlPng">${DL_ICO}ذخیره تصویر</button>
        <button type="button" class="dl-btn" data-a="dlPdf">${DL_ICO}ذخیره PDF</button>
      </div>
      <button type="button" class="primary-button wide" data-a="close">بستن</button>`;
  },
  async mine() {
    body.innerHTML = '<p class="ld">در حال دریافت نوبت‌های شما…</p>';
    try {
      const { list } = await api("my", { token: S.user.token }, true);
      if (S.view !== "mine") return;
      body.innerHTML = list.length ? list.map(n => `<div class="mine-row"><span>${esc(n.doctor)}<br>${esc(n.day)} ${fa(n.j)} | ${fa(n.time)}<br><small>${fa(esc(n.code))}</small></span><button type="button" data-a="cancel" data-c="${esc(n.code)}">لغو</button></div>`).join("") : "<p>نوبت فعالی ندارید.</p>";
    } catch (e) { body.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
};

/* ---------- رسید نوبت: داده، رسم روی بوم، دانلود تصویر و PDF ---------- */
const TYPE_ONE = { "عمومی": "پزشک عمومی", "دندانپزشک": "دندان‌پزشک", "متخصص": "پزشک متخصص" };
const RC_GUEST = "برای لغو یا تغییر نوبت، با درمانگاه تماس بگیرید.";
const RC_NOTES = [
  "این رسید، تأییدیهٔ ثبت درخواست نوبت شماست و منشی درمانگاه برای هماهنگی نهایی با شما تماس می‌گیرد.",
  "لطفاً کد پیگیری را تا زمان مراجعه همراه داشته باشید."
];
const DL_ICO = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.500 10.500 12 15l4.500-4.500M5 19h14"/></svg>';

const rcNotes = () => S.res && S.res.guest ? [...RC_NOTES, RC_GUEST] : RC_NOTES;

function receiptData() {
  const r = S.res, d = docById(S.doc), u = S.user || {}, mob = r.mobile || u.mobile || "";
  let issued = "";
  try { issued = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(r.issued || Date.now())).replace(",", "،"); } catch (e) {}
  return {
    rows: [
      ["کد پیگیری", fa(r.code), "ltr"],
      ["نام بیمار / رزروکننده", r.name || u.name],
      ["شماره موبایل", mob && fa(mob)],
      ["پزشک / تخصص", [r.doctor, r.spec || d.specialty || TYPE_ONE[d.type]].filter(Boolean).join(" – ")],
      ["زمان نوبت", `${r.day} ${fa(r.j)}، ساعت ${fa(r.time)}`],
      ["تاریخ صدور رسید", issued]
    ].filter(x => x[1])
  };
}

function wrapText(ctx, text, maxW) {
  const lines = []; let cur = "";
  for (const w of String(text).split(" ")) {
    const t = cur ? cur + " " + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

async function drawReceipt() {
  const rec = receiptData(), W = 800, P = 44, SC = 2, LW = 250, F = "Vazirmatn, Tahoma, sans-serif";
  try { await Promise.all(["500", "700", "800"].map(w => document.fonts.load(`${w} 24px Vazirmatn`))); } catch (e) {}
  const VW = W - 2 * P - LW - 10, NW = W - 2 * P - 48;
  const m = document.createElement("canvas").getContext("2d"); m.direction = "rtl";
  m.font = `700 26px ${F}`;
  const rows = rec.rows.map(([k, v, dir]) => { const lines = dir === "ltr" ? [v] : wrapText(m, v, VW); return { k, lines, dir, h: lines.length * 40 + 28 }; });
  m.font = `500 23px ${F}`;
  const notes = rcNotes().flatMap(n => wrapText(m, n, NW));
  const noteH = notes.length * 38 + 36;
  const rowsH = rows.reduce((a, r) => a + r.h, 0);
  const H = 178 + 24 + rowsH + 24 + noteH + 36 + 120;

  const c = document.createElement("canvas"); c.width = W * SC; c.height = H * SC;
  const x = c.getContext("2d"); x.scale(SC, SC); x.textBaseline = "alphabetic";
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);

  // سربرگ
  let g = x.createLinearGradient(0, 0, W, 170); g.addColorStop(0, "#30a8c0"); g.addColorStop(1, "#0d6c80");
  x.fillStyle = g; x.fillRect(0, 0, W, 170);
  g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "#30a8c0"); g.addColorStop(.6, "#1a96ae"); g.addColorStop(1, "#c0553d");
  x.fillStyle = g; x.fillRect(0, 170, W, 8);
  x.direction = "rtl"; x.textAlign = "center";
  x.fillStyle = "#fff"; x.font = `800 44px ${F}`; x.fillText("درمانگاه فرهنگیان مهریز", W / 2, 84);
  x.fillStyle = "#d9f3f8"; x.font = `500 26px ${F}`; x.fillText("رسید نوبت‌دهی آنلاین", W / 2, 130);

  let y = 178 + 24;

  // ردیف‌ها
  x.textAlign = "right";
  rows.forEach((r, i) => {
    x.direction = "rtl"; x.fillStyle = "#4a6c75"; x.font = `500 24px ${F}`; x.fillText(r.k, W - P, y + 40);
    x.direction = r.dir === "ltr" ? "ltr" : "rtl"; x.fillStyle = "#0c3340"; x.font = `700 26px ${F}`;
    r.lines.forEach((l, j) => x.fillText(l, W - P - LW, y + 40 + j * 40));
    y += r.h;
    if (i < rows.length - 1) { x.setLineDash([6, 6]); x.strokeStyle = "#a9dae5"; x.lineWidth = 2; x.beginPath(); x.moveTo(P, y); x.lineTo(W - P, y); x.stroke(); x.setLineDash([]); }
  });

  // توضیحات
  y += 24; x.fillStyle = "#fbeae5"; rrect(x, P, y, W - 2 * P, noteH, 20); x.fill();
  x.direction = "rtl"; x.fillStyle = "#8c3623"; x.font = `500 23px ${F}`;
  notes.forEach((l, i) => x.fillText(l, W - P - 24, y + 42 + i * 38));
  y += noteH + 36;

  // پاورقی
  x.strokeStyle = "#cfe9ef"; x.lineWidth = 2; x.beginPath(); x.moveTo(P, y); x.lineTo(W - P, y); x.stroke();
  x.textAlign = "center"; x.fillStyle = "#0d6c80"; x.font = `700 26px ${F}`; x.fillText("درمانگاه فرهنگیان مهریز", W / 2, y + 44);
  x.fillStyle = "#4a6c75"; x.font = `500 22px ${F}`; x.fillText("تلفن هماهنگی: " + fa("03532529560") + " | " + fa("03532531410"), W / 2, y + 82);
  g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "#30a8c0"); g.addColorStop(.6, "#1a96ae"); g.addColorStop(1, "#c0553d");
  x.fillStyle = g; x.fillRect(0, H - 10, W, 10);
  return c;
}

function makePdf(canvas) {
  const w = canvas.width, h = canvas.height, bin = atob(canvas.toDataURL("image/jpeg", .92).split(",")[1]);
  const img = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) img[i] = bin.charCodeAt(i);
  const PW = 595, PH = 842, M = 40; let pw = PW - 2 * M, ph = pw * h / w;
  if (ph > PH - 2 * M) { ph = PH - 2 * M; pw = ph * w / h; }
  const enc = new TextEncoder(), parts = [], off = []; let n = 0;
  const add = b => { if (typeof b === "string") b = enc.encode(b); parts.push(b); n += b.length; };
  const obj = (i, head, stream) => { off[i] = n; add(`${i} 0 obj\n${head}\n`); if (stream) { add("stream\n"); add(stream); add("\nendstream\n"); } add("endobj\n"); };
  add("%PDF-1.4\n");
  obj(1, "<</Type/Catalog/Pages 2 0 R>>");
  obj(2, "<</Type/Pages/Kids[3 0 R]/Count 1>>");
  obj(3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PW} ${PH}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`);
  obj(4, `<</Type/XObject/Subtype/Image/Width ${w}/Height ${h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${img.length}>>`, img);
  const cs = `q ${pw.toFixed(2)} 0 0 ${ph.toFixed(2)} ${((PW - pw) / 2).toFixed(2)} ${(PH - M - ph).toFixed(2)} cm /Im0 Do Q`;
  obj(5, `<</Length ${cs.length}>>`, cs);
  const xr = n;
  add("xref\n0 6\n0000000000 65535 f \n" + [1, 2, 3, 4, 5].map(i => String(off[i]).padStart(10, "0") + " 00000 n \n").join(""));
  add(`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xr}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}

function saveBlob(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function downloadReceipt(btn, kind) {
  setBusy(btn, true);
  try {
    const [c] = await Promise.all([drawReceipt(), new Promise(r => setTimeout(r, 600))]);
    const base = "nobat-" + String(S.res.code).replace(/[^\w-]/g, "");
    if (kind === "pdf") saveBlob(makePdf(c), base + ".pdf");
    else saveBlob(await new Promise(r => c.toBlob(r, "image/png")), base + ".png");
    showMsg("ok", "رسید ذخیره شد", "فایل رسید دانلود شد. اگر آن را نمی‌بینید، پوشهٔ دانلودها را بررسی کنید.", 2800);
  } catch (e) {
    showMsg("warn", "ذخیرهٔ رسید انجام نشد", "لطفاً دوباره تلاش کنید یا از صفحه عکس بگیرید.");
  } finally { setBusy(btn, false); }
}

const showErr = (id, t) => { const m = $(id); if (m) m.textContent = t; };

/* ---------- حالت «در حال انجام» برای دکمه‌ها (تغییر رنگ + اسپینر) ---------- */
const setBusy = (b, on) => {
  if (!b) return;
  b.classList.toggle("busy", on);
  if (on) b.setAttribute("aria-busy", "true"); else b.removeAttribute("aria-busy");
};

/* ---------- پنجرهٔ پیام (هماهنگ با قالب سایت) ---------- */
const msgBox = $("#msgBox");
let msgTimer;
const MSG_ICO = {
  ok: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>',
  out: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M16 8l4 4-4 4M20 12H10"/></svg>',
  warn: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.500v5M12 16.500h.01"/></svg>'
};
function closeMsg() { clearTimeout(msgTimer); if (msgBox.open) msgBox.close(); }
function showMsg(kind, title, text, ms = 3200) {
  clearTimeout(msgTimer);
  msgBox.dataset.kind = kind;
  $("#msgIco").innerHTML = MSG_ICO[kind] || MSG_ICO.ok;
  $("#msgTitle").textContent = title;
  $("#msgText").textContent = text;
  const bar = msgBox.querySelector(".msgbox-timer i");
  bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = `drain ${ms}ms linear forwards`;
  if (!msgBox.open) msgBox.showModal();
  msgTimer = setTimeout(closeMsg, ms);
}
$("#msgOk").onclick = closeMsg;
msgBox.addEventListener("click", e => { if (e.target === msgBox) closeMsg(); });

/* ---------- پنجرهٔ تأیید (جایگزین confirm مرورگر) ---------- */
const cfBox = $("#cfBox");
let cfResolve = null;
function askConfirm(title, text, yesLabel = "بله") {
  $("#cfTitle").textContent = title;
  $("#cfText").textContent = text;
  $("#cfYes").textContent = yesLabel;
  return new Promise(res => {
    cfResolve = res;
    cfBox.showModal();
    $("#cfNo").focus();
  });
}
function cfDone(v) { const r = cfResolve; cfResolve = null; if (cfBox.open) cfBox.close(); if (r) r(v); }
$("#cfYes").onclick = () => cfDone(true);
$("#cfNo").onclick = () => cfDone(false);
cfBox.addEventListener("cancel", () => { cfResolve && cfDone(false); });
cfBox.addEventListener("click", e => { if (e.target === cfBox) cfDone(false); });
const ACT = {
  pickDoc(d) { S.doc = d.id; S.date = null; S.time = null; go("day"); },
  pickDay(d) { S.date = d.iso; S.time = null; go("time"); },
  pickTime(d) { S.time = d.t; S.after = "confirm"; go(S.user ? "confirm" : "guest"); },
  toAuth() { readGuest(); const g = S.guest; S.form = { ...S.form, name: g.name || S.form.name, mob: g.mob || S.form.mob, nid: g.nid || S.form.nid }; go("auth"); },
  toGuest() { S.guest = { name: $("#fName").value, mob: $("#fMobile").value, nid: $("#fNid").value }; back(); },
  close: closeWz,
  dlPng(d, btn) { return downloadReceipt(btn, "png"); },
  dlPdf(d, btn) { return downloadReceipt(btn, "pdf"); },
  async sendCode(d, btn) {
    const email = $("#fEmail").value.trim(), name = $("#fName").value.trim(), mob = cleanNum($("#fMobile").value), nid = cleanNum($("#fNid").value); S.form = { name, mob, nid, email };
    if (name.length < 3) return showErr("#authMsg", "نام و نام خانوادگی را وارد کنید.");
    if (!validMob(mob)) return showErr("#authMsg", "شمارهٔ موبایل باید دقیقاً ۱۱ رقم و به شکل ۰۹۱۲۳۴۵۶۷۸۹ باشد.");
    if (!validNid(nid)) return showErr("#authMsg", "کد ملی باید دقیقاً ۱۰ رقم باشد.");
    showErr("#authMsg", "");
    setBusy(btn, true);
    try { await api("code", { email }, true); S.email = email; go("code"); } catch (e) { showErr("#authMsg", e.message); } finally { setBusy(btn, false); }
  },
  async verify(d, btn) {
    showErr("#authMsg", "");
    setBusy(btn, true);
    try {
      const r = await api("verify", { email: S.email, code: $("#fCode").value, name: S.form.name, mobile: S.form.mob, nid: S.form.nid }, true);
      S.user = { token: r.token, name: r.name, email: r.email, mobile: S.form.mob || "", hasNid: true }; localStorage.setItem("mh_user", JSON.stringify(S.user)); syncUser();
      S.stack = S.stack.filter(v => v !== "auth" && v !== "code" && v !== "guest"); S.form.nid = "";
      const welcome = () => showMsg("ok", "ورود موفق", `${S.user.name} عزیز، با موفقیت وارد حساب خود شدید.`);
      if (S.after === "close") { S.after = null; closeWz(); welcome(); return; }
      S.view = S.after || "confirm"; render(); welcome();
    } catch (e) { showErr("#authMsg", e.message); } finally { setBusy(btn, false); }
  },
  async book(d, btn) {
    showErr("#msg", "");
    let nid;
    if (!S.user.hasNid) { nid = cleanNum($("#cNid")?.value); if (!validNid(nid)) return showErr("#msg", "کد ملی باید دقیقاً ۱۰ رقم باشد."); }
    setBusy(btn, true);
    try {
      S.res = await api("book", { token: S.user.token, doctor: S.doc, date: S.date, time: S.time, nid }, true);
      if (nid) { S.user.hasNid = true; localStorage.setItem("mh_user", JSON.stringify(S.user)); }
      { const dd = docById(S.doc); S.res.issued = Date.now(); S.res.spec = dd.specialty || TYPE_ONE[dd.type] || ""; } S.stack = []; go("done", false); refresh();
    } catch (e) { showErr("#msg", e.message); refresh(); } finally { setBusy(btn, false); }
  },
  async gbook(d, btn) {
    readGuest(); const g = S.guest, name = (g.name || "").trim(), mob = cleanNum(g.mob), nid = cleanNum(g.nid);
    if (name.length < 3) return showErr("#msg", "نام و نام خانوادگی را وارد کنید.");
    if (!validMob(mob)) return showErr("#msg", "شمارهٔ موبایل باید دقیقاً ۱۱ رقم و به شکل ۰۹۱۲۳۴۵۶۷۸۹ باشد.");
    if (!validNid(nid)) return showErr("#msg", "کد ملی باید دقیقاً ۱۰ رقم باشد.");
    showErr("#msg", "");
    setBusy(btn, true);
    try {
      S.res = await api("gbook", { name, mobile: mob, nid, doctor: S.doc, date: S.date, time: S.time }, true, 0);
      { const dd = docById(S.doc); S.res.issued = Date.now(); S.res.spec = dd.specialty || TYPE_ONE[dd.type] || ""; S.res.guest = true; }
      S.guest = {}; S.stack = []; go("done", false); refresh();
    } catch (e) { showErr("#msg", e.message); refresh(); } finally { setBusy(btn, false); }
  },
  async cancel(d, btn) {
    if (!await askConfirm("لغو نوبت", "آیا مطمئن هستید که این نوبت لغو شود؟", "بله، لغو شود")) return;
    setBusy(btn, true);
    try {
      await api("cancel", { token: S.user.token, code: d.c }, true);
      refresh(); render();
    } catch (e) { showMsg("warn", "لغو انجام نشد", e.message); } finally { setBusy(btn, false); }
  }
};

body.addEventListener("input", e => {
  const t = e.target, n = +t.dataset?.len; if (!n) return;
  const v = DIG(t.value).replace(/\D/g, "").slice(0, n);
  if (t.value !== v) t.value = v;
  markTick(t);
});

/* ---------- تیک سبز کنار کد ملی / موبایل، وقتی عدد کامل و معتبر شد ---------- */
const tickCtx = document.createElement("canvas").getContext("2d");
function markTick(t) {
  const v = cleanNum(t.value), ok = (t.dataset.len === "11" ? validMob : validNid)(v);
  let k = t.parentElement.querySelector(".tick");
  if (!ok) { if (k) k.hidden = true; return; }
  if (!k) {
    k = document.createElement("span"); k.className = "tick";
    k.setAttribute("role", "img"); k.setAttribute("aria-label", "کامل شد");
    t.after(k);
  }
  k.hidden = false;
  const cs = getComputedStyle(t);   // محل تیک: درست بعد از آخرین رقم
  tickCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  k.style.right = parseFloat(cs.borderRightWidth) + parseFloat(cs.paddingRight) + tickCtx.measureText(t.value).width + 10 + "px";
  k.style.bottom = (t.offsetHeight - k.offsetHeight) / 2 + "px";
}
/* برای فیلدهایی که از قبل مقدار دارند (مثلاً بعد از برگشت به فرم) */
new MutationObserver(() => requestAnimationFrame(() => body.querySelectorAll("input[data-len]").forEach(markTick))).observe(body, { childList: true, subtree: true });
document.fonts?.addEventListener("loadingdone", () => body.querySelectorAll("input[data-len]").forEach(markTick));
body.addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b && !b.disabled && !b.classList.contains("busy")) ACT[b.dataset.a](b.dataset, b); });
body.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") body.querySelector(".primary-button")?.click(); });
wz.addEventListener("close", () => { S.guest = {}; S.form.nid = ""; });
$("#wzBack").onclick = back; $("#wzClose").onclick = closeWz; wz.addEventListener("click", e => { if (e.target === wz) closeWz(); });
document.addEventListener("click", e => {
  const o = e.target.closest("[data-open]");
  if (o) { e.preventDefault(); S.type = o.dataset.type || null; openWz(o.dataset.open); return; }
  const d = e.target.closest("[data-doc]");
  if (d) { e.preventDefault(); S.type = null; openWz("doc"); ACT.pickDoc({ id: d.dataset.doc }); }
});

function syncUser() { const on = !!S.user; $("#mineBtn").hidden = !on; $("#navLogin").hidden = on; $("#navLogout").hidden = !on;
  $("#topUser").hidden = !on; document.body.classList.toggle("logged", on);
  const nu = $("#navUser"); if (nu) { if (on) delete nu.dataset.open; else nu.dataset.open = "login"; nu.classList.toggle("in", on); nu.setAttribute("aria-label", on ? "نوبت‌های من" : "ورود / ثبت‌نام"); } if (on) $("#topUserName").textContent = S.user.name; }
function logout(reason) {
  const wasIn = !!S.user;
  S.user = null; localStorage.removeItem("mh_user"); syncUser();
  if (!wasIn) return;
  if (reason === "expired") showMsg("warn", "نشست شما منقضی شد", "برای ادامه، لطفاً دوباره وارد شوید.");
  else showMsg("out", "خروج انجام شد", "با موفقیت از حساب خود خارج شدید.");
}
function onLogoutClick(e) {
  const b = e.currentTarget;
  if (b.classList.contains("busy")) return;
  setBusy(b, true);
  setTimeout(() => { setBusy(b, false); logout(); }, 700);
}

async function refresh() {
  const staticFetch = fetch("./data.json?t=" + Math.floor(Date.now() / 60000))
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d && d.doctors) applyFullData(d, false); })
    .catch(() => {});

  const liveFetch = api("full")
    .catch(() => api("init"))
    .then(d => {
      if (d && d.doctors) applyFullData(d, true);
      return d;
    });

  await Promise.race([staticFetch, liveFetch]);
  return liveFetch;
}

document.addEventListener("DOMContentLoaded", async () => {
  $("#navLogout").onclick = onLogoutClick;
  syncUser();
  if (S.loaded) {
    renderDoctors();
  }
  try {
    await refresh();
  } catch (e) {
    if (!S.loaded) {
      S.err = e.message;
      $("#doctorList").innerHTML = `<p class="err">${esc(e.message)}</p>`;
    }
  }
});

function reveal() {
  const io = window.__io || (window.__io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 }));
  document.querySelectorAll(".rv:not(.in)").forEach(el => io.observe(el));
}
document.addEventListener("DOMContentLoaded", reveal);
addEventListener("scroll", () => document.querySelector(".site-header").classList.toggle("sc", scrollY > 10), { passive: true });

/* در iOS Safari برای کار کردن :active باید یک شنوندهٔ لمس وجود داشته باشد */
document.addEventListener("touchstart", () => {}, { passive: true });


/* کیبورد موبایل (برای همهٔ پنجره‌ها): ارتفاع قابل‌دیدِ واقعی را اعمال کن و فیلد فعال را در دید نگه دار */
(function () {
  const vv = window.visualViewport, root = document.documentElement;
  const fit = () => {
    const h = vv ? vv.height : innerHeight;
    root.style.setProperty("--vvh", h + "px");
    root.classList.toggle("kb", !!vv && innerHeight - h > 120);
  };
  const reveal = el => setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {} }, 280);
  if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); }
  addEventListener("orientationchange", () => setTimeout(fit, 300));
  fit();
  document.addEventListener("focusin", e => { if (e.target.matches("input:not([type=checkbox]):not([type=radio]),textarea,select")) { fit(); reveal(e.target); } });
  document.addEventListener("focusout", () => setTimeout(fit, 150));
})();


/* لینک کانال ایتا: روی موبایل مستقیم اپ ایتا باز می‌شود، در غیر این صورت نسخهٔ وب */
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-eitaa]"); if (!a) return;
  const ua = navigator.userAgent, id = a.dataset.eitaa, web = a.href;
  const android = /Android/i.test(ua), ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!android && !ios) return;                       // دسکتاپ: لینک عادی (ایتا وب)
  e.preventDefault();
  if (android) {
    location.href = `intent://eitaa.com/${id}#Intent;scheme=https;package=ir.eitaa.messenger;S.browser_fallback_url=${encodeURIComponent(web)};end`;
    return;
  }
  const t = Date.now();
  location.href = `eitaa://resolve?domain=${id}`;
  setTimeout(() => { if (!document.hidden && Date.now() - t < 2500) location.href = web; }, 1400);
});

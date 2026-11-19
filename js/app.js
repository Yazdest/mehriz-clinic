"use strict";
const $ = s => document.querySelector(s);
const fa = s => String(s).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPES = { "عمومی": "پزشکان عمومی", "دندانپزشک": "دندان‌پزشکان", "متخصص": "پزشکان متخصص" };

const CACHE_KEY = "mh_full_cache_v2";

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
  user: JSON.parse(localStorage.getItem("mh_user") || "null")
};

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
        if (j.error.includes("نشست")) logout();
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
      <article class="doc-card rv"><div class="av" aria-hidden="true">${avatar(d)}</div><h4>${esc(d.name)}</h4>
      ${d.specialty ? `<span class="tag">${esc(d.specialty)}</span>` : ""}
      <button type="button" class="doc-btn" data-doc="${esc(d.id)}">برنامه و دریافت نوبت ←</button></article>`).join("") + `</div>`;
  }).join("") || "<p>فهرست پزشکان به‌زودی اضافه می‌شود.</p>";
  reveal();
}

const wz = $("#wz"), body = $("#wzBody");
const TITLES = { doc: "انتخاب پزشک", day: "انتخاب روز", time: "انتخاب ساعت حضور", auth: "ورود یا ثبت‌نام", code: "کد تأیید", confirm: "تأیید نهایی", done: "نوبت شما ثبت شد", mine: "نوبت‌های من" };
const STEP = { doc: 1, day: 2, time: 3, auth: 4, code: 4, confirm: 4 };

function openWz(v) {
  S.stack = []; S.view = null; S.date = null; S.time = null;
  if (v === "doc") S.doc = null;
  S.after = null;
  if (v === "mine" && !S.user) { S.after = "mine"; v = "auth"; }
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
  $("#wzProg").innerHTML = STEP[v] ? [1, 2, 3, 4].map(i => `<i class="${i <= STEP[v] ? "on" : ""}"></i>`).join("") : "";
  body.className = "wz-body"; void body.offsetWidth; body.className = "wz-body vin"; body.scrollTop = 0;
  VIEWS[v]();
}

const row = d => `<button type="button" class="dc" data-a="pickDoc" data-id="${esc(d.id)}"><span class="av sm" aria-hidden="true">${avatar(d)}</span><span class="dc-t"><b>${esc(d.name)}</b>${d.specialty ? `<small>${esc(d.specialty)}</small>` : ""}<span class="wk">${weekHtml(d)}</span></span><span class="arr" aria-hidden="true">‹</span></button>`;

const VIEWS = {
  doc() {
    if (!S.loaded) {
      body.innerHTML = `<p class="${S.err ? "err" : ""}">${esc(S.err || "در حال آماده‌سازی فهرست پزشکان…")}</p>`;
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
      $("#tm").innerHTML = "<small>در حال دریافت ساعت‌ها…</small>";
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
    const f = S.form;
    body.innerHTML = `<p class="wz-sub">کد ورود به ایمیل شما ارسال می‌شود.</p><div class="form-grid">
      <input id="fName" placeholder="نام و نام خانوادگی" autocomplete="name" value="${esc(f.name)}">
      <input id="fMobile" placeholder="موبایل (مثلاً 09123456789)" inputmode="numeric" autocomplete="tel" value="${esc(f.mob)}">
      <input id="fEmail" type="email" placeholder="ایمیل" dir="ltr" autocomplete="email" value="${esc(f.email)}"></div>
      <button type="button" class="primary-button wide" data-a="sendCode">ارسال کد ورود</button><div id="authMsg" class="err" role="alert"></div>`;
  },
  code() {
    body.innerHTML = `<p class="wz-sub">کد ۶ رقمی به <b dir="ltr">${esc(S.email)}</b> ارسال شد (پوشهٔ اسپم را هم ببینید).</p>
      <div class="form-grid"><input id="fCode" placeholder="کد ۶ رقمی" inputmode="numeric" dir="ltr" autocomplete="one-time-code"></div>
      <button type="button" class="primary-button wide" data-a="verify">ورود</button><div id="authMsg" class="err" role="alert"></div>`;
  },
  confirm() {
    const x = dayObj();
    body.innerHTML = `<div class="sum"><div><span>پزشک</span><b>${esc(docById(S.doc).name)}</b></div><div><span>روز</span><b>${x.day} ${fa(x.j)}</b></div><div><span>ساعت حضور</span><b>${fa(S.time)}</b></div><div><span>نام</span><b>${esc(S.user.name)}</b></div></div>
      <button type="button" class="primary-button wide" data-a="book">تأیید و ثبت نوبت</button><div id="msg" class="err" role="alert"></div>`;
  },
  done() {
    const r = S.res;
    body.innerHTML = `<div class="center"><div class="okbig">✓</div><p>کد پیگیری</p><h3 dir="ltr">${esc(r.code)}</h3></div>
      <div class="sum"><div><span>پزشک</span><b>${esc(r.doctor)}</b></div><div><span>روز</span><b>${esc(r.day)} ${fa(r.j)}</b></div><div><span>ساعت حضور</span><b>${fa(r.time)}</b></div></div>
      <p class="wz-sub">تأیید به ایمیل شما ارسال شد و منشی برای هماهنگی تماس می‌گیرد.</p><button type="button" class="primary-button wide" data-a="close">بستن</button>`;
  },
  async mine() {
    body.innerHTML = "<small>در حال دریافت نوبت‌های شما…</small>";
    try {
      const { list } = await api("my", { token: S.user.token }, true);
      if (S.view !== "mine") return;
      body.innerHTML = list.length ? list.map(n => `<div class="mine-row"><span>${esc(n.doctor)}<br>${esc(n.day)} ${fa(n.j)} | ${fa(n.time)}<br><small>${esc(n.code)}</small></span><button type="button" data-a="cancel" data-c="${esc(n.code)}">لغو</button></div>`).join("") : "<p>نوبت فعالی ندارید.</p>";
    } catch (e) { body.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
};

const showErr = (id, t) => { const m = $(id); if (m) m.textContent = t; };
const ACT = {
  pickDoc(d) { S.doc = d.id; S.date = null; S.time = null; go("day"); },
  pickDay(d) { S.date = d.iso; S.time = null; go("time"); },
  pickTime(d) { S.time = d.t; S.after = "confirm"; go(S.user ? "confirm" : "auth"); },
  close: closeWz,
  async sendCode() {
    const email = $("#fEmail").value.trim(), name = $("#fName").value.trim(), mob = $("#fMobile").value.trim(); S.form = { name, mob, email };
    if (name.length < 3) return showErr("#authMsg", "نام و نام خانوادگی را وارد کنید.");
    if (!/^(09|۰۹)[\d۰-۹]{9}$/.test(mob)) return showErr("#authMsg", "شمارهٔ موبایل را به شکل 09123456789 وارد کنید.");
    try { await api("code", { email }, true); S.email = email; go("code"); } catch (e) { showErr("#authMsg", e.message); }
  },
  async verify() {
    try {
      const r = await api("verify", { email: S.email, code: $("#fCode").value, name: S.form.name, mobile: S.form.mob }, true);
      S.user = { token: r.token, name: r.name, email: r.email }; localStorage.setItem("mh_user", JSON.stringify(S.user)); syncUser();
      S.stack = S.stack.filter(v => v !== "auth" && v !== "code"); S.view = S.after || "confirm"; render();
    } catch (e) { showErr("#authMsg", e.message); }
  },
  async book() {
    const b = body.querySelector("[data-a=book]"); b.disabled = true;
    try {
      S.res = await api("book", { token: S.user.token, doctor: S.doc, date: S.date, time: S.time }, true);
      S.stack = []; go("done", false); refresh();
    } catch (e) { showErr("#msg", e.message); b.disabled = false; refresh(); }
  },
  async cancel(d) {
    if (!confirm("نوبت لغو شود؟")) return;
    try {
      await api("cancel", { token: S.user.token, code: d.c }, true);
      refresh(); render();
    } catch (e) { alert(e.message); }
  }
};

body.addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b && !b.disabled) ACT[b.dataset.a](b.dataset); });
body.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") body.querySelector(".primary-button")?.click(); });
$("#wzBack").onclick = back; $("#wzClose").onclick = closeWz; wz.addEventListener("click", e => { if (e.target === wz) closeWz(); });
document.addEventListener("click", e => {
  const o = e.target.closest("[data-open]");
  if (o) { e.preventDefault(); S.type = o.dataset.type || null; openWz(o.dataset.open); return; }
  const d = e.target.closest("[data-doc]");
  if (d) { e.preventDefault(); S.type = null; openWz("doc"); ACT.pickDoc({ id: d.dataset.doc }); }
});

function syncUser() { const on = !!S.user; $("#mineBtn").hidden = !on; $("#userLine").hidden = !on; if (on) $("#hello").textContent = "ورود با " + S.user.email; }
function logout() { S.user = null; localStorage.removeItem("mh_user"); syncUser(); }

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
  $("#logout").onclick = logout;
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

(function () {
  const k = "mh_fs", r = document.documentElement, b = document.getElementById("fsz"); let z = +localStorage.getItem(k) || 17;
  const set = () => { r.style.setProperty("--fs", z + "px"); b.textContent = z > 17 ? "A−" : "A+"; }; set();
  b.onclick = () => { z = z > 17 ? 17 : 21; localStorage.setItem(k, z); set(); };
})();

function reveal() {
  const io = window.__io || (window.__io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 }));
  document.querySelectorAll(".rv:not(.in)").forEach(el => io.observe(el));
}
document.addEventListener("DOMContentLoaded", reveal);
addEventListener("scroll", () => document.querySelector(".site-header").classList.toggle("sc", scrollY > 10), { passive: true });

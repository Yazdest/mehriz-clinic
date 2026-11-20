/* پروفایل پزشک، نظرات، جست‌وجو و منوی سایت — بعد از app.js بارگذاری می‌شود */
const STAR = '<svg class="st" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
const PIN = '<svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.400-6.500 11-6.500 11z"/><circle cx="12" cy="10" r="2.300"/></svg>';
const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5.500" r="2.500"/><circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="18.500" r="2.500"/><path d="M8.300 10.800l7.400-4M8.300 13.200l7.400 4"/></svg>';
const f1 = n => fa(Number(n).toFixed(1)).replace(".", "٫");
const ratingHtml = d => d.rc ? `<span class="rt">${STAR}<b>${f1(d.rate)}</b><small>(${fa(d.rc)} نظر)</small></span>` : `<span class="rt none">هنوز نظری ثبت نشده</span>`;

/* ---------- منو و جست‌وجو ---------- */
const menu = $("#menu"), srch = $("#srch"), prof = $("#prof"), pBody = $("#profBody");
$("#navMenu").onclick = () => menu.showModal();
const umenu = $("#umenu");
$("#navUser").addEventListener("click", () => { if (S.user) { $("#umName").textContent = S.user.name; umenu.showModal(); } });
umenu.addEventListener("click", e => { if (e.target === umenu || e.target.closest("button:not(#umOut)")) umenu.close(); });
$("#umOut").onclick = e => { onLogoutClick(e); setTimeout(() => umenu.close(), 760); };
menu.addEventListener("click", e => { if (e.target === menu || e.target.closest("a,button")) menu.close(); });
const nz = s => String(s || "").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").toLowerCase();
function drawSearch() {
  const q = nz($("#srchIn").value).trim();
  const list = S.doctors.filter(d => !q || nz(d.name + " " + d.specialty + " " + (TYPE_ONE[d.type] || "")).includes(q));
  $("#srchRes").innerHTML = list.length
    ? list.map(d => `<button type="button" class="sr-i" data-prof="${esc(d.id)}"><span class="av sm" aria-hidden="true">${avatar(d)}</span><span class="sr-t"><b>${esc(d.name)}</b><small>${esc(d.specialty || TYPE_ONE[d.type] || "")}</small></span>${ratingHtml(d)}</button>`).join("")
    : `<p class="mut ctr">پزشکی با این مشخصات پیدا نشد.</p>`;
}
$("#navSearch").onclick = () => { srch.showModal(); $("#srchIn").value = ""; drawSearch(); setTimeout(() => $("#srchIn").focus(), 60); };
$("#srchIn").addEventListener("input", drawSearch);
$("#srchX").onclick = () => srch.close();
srch.addEventListener("click", e => { if (e.target === srch || e.target.closest("[data-prof]")) srch.close(); });

/* ---------- پروفایل پزشک ---------- */
let PD = null, PT = "bk", PS = 0, pend = /^#dr\//.test(location.hash);
const PTABS = [["bk", "نوبت\u200cدهی"], ["in", "معرفی"], ["ct", "اطلاعات تماس"], ["rv", "نظرات"]];

function openProf(id, tab) {
  const d = S.doctors.find(x => x.id === id); if (!d) return;
  PD = d; PT = tab || "bk"; PS = 0; renderProf();
  if (!prof.open) prof.showModal();
  prof.scrollTop = 0;
  history.replaceState(null, "", "#dr/" + encodeURIComponent(id));
}
prof.addEventListener("close", () => { PD = null; if (location.hash.startsWith("#dr/")) history.replaceState(null, "", location.pathname + location.search); });
prof.addEventListener("click", e => { if (e.target === prof) prof.close(); });
function fromHash() { const m = location.hash.match(/^#dr\/(.+)$/); if (m) openProf(decodeURIComponent(m[1])); }
addEventListener("hashchange", fromHash);
window.onDoctorsReady = () => {
  if (pend && S.doctors.length) { pend = false; fromHash(); }
  else if (PD) { const n = S.doctors.find(x => x.id === PD.id); if (n) { PD = n; if (PT !== "rv") renderProf(); } }
};
if (pend && S.loaded) window.onDoctorsReady();

/* ---------- اولین نوبت خالی (بدون ورود به ویزارد) ---------- */
function tehranNow() {
  const p = {};
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return { iso: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
const isoPlus = (iso, n) => { const a = iso.split("-").map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2] + n)).toISOString().slice(0, 10); };
function nextFree(d) {
  const now = tehranNow();
  for (const x of S.days) {
    if (x.iso < now.iso || !x.docs || !x.docs[d.id] || (x.off && x.off[d.id])) continue;
    const sl = S.slotsMap[d.id + "_" + x.iso];
    if (!sl) return { x, time: "" };   // ساعت‌ها هنوز نرسیده‌اند؛ دست‌کم روز را نشان بده
    const s = sl.find(s => s.free && (x.iso !== now.iso || +s.time.slice(0, 2) * 60 + +s.time.slice(3) > now.min));
    if (s) return { x, time: s.time };
  }
  return null;
}
function nextFreeHtml(d) {
  const n = nextFree(d);
  if (!n) return `<div class="pf-next none"><small>اولین نوبت خالی</small><b>فعلاً نوبت خالی ثبت نشده است</b></div>`;
  const now = tehranNow().iso, x = n.x;
  const day = x.iso === now ? "امروز" : x.iso === isoPlus(now, 1) ? "فردا" : `${x.day} ${fa(x.j.slice(5))}`;
  return `<div class="pf-next"><small>اولین نوبت خالی</small><b>${day}${n.time ? "، ساعت " + fa(n.time) : ""}</b></div>`;
}

function renderProf() {
  const d = PD;
  pBody.innerHTML = `<div class="pf-top"><button type="button" class="pf-ib" data-p="close" aria-label="بستن">✕</button><button type="button" class="pf-ib" data-p="share" aria-label="اشتراک‌گذاری">${SHARE}</button></div>
  <div class="pf-hero"><div class="av xl">${avatar(d)}</div><h2>${esc(d.name)}</h2><p>${esc(d.specialty || TYPE_ONE[d.type] || "")}</p>
    <div class="pf-meta">${ratingHtml(d)}<i></i><span class="loc">${PIN} مهریز</span></div>${nextFreeHtml(d)}</div>
  <div class="pf-tabs" role="tablist">${PTABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === PT}" class="${k === PT ? "on" : ""}" data-p="tab" data-k="${k}">${l}</button>`).join("")}</div>
  <div class="pf-panel" id="pfPanel"></div>`;
  panel();
}
function panel() {
  const d = PD, el = $("#pfPanel");
  if (PT === "bk") el.innerHTML = `<div class="pf-card"><h3>برنامه حضور پزشک</h3><div class="pf-week">${weekHtml(d)}</div>${d.fee ? `<div class="pf-fee"><small>هزینهٔ ویزیت</small><b>${esc(d.fee)}</b></div>` : ""}<button type="button" class="primary-button wide" data-p="book">دریافت نوبت <span>←</span></button></div>`;
  else if (PT === "in") el.innerHTML = `<div class="pf-card"><h3>دربارهٔ ${esc(d.name)}</h3>${d.bio ? `<p class="pre">${esc(d.bio)}</p>` : `<p class="mut">معرفی این پزشک به‌زودی تکمیل می‌شود.</p>`}</div>${d.exp ? `<div class="pf-card"><h3>سوابق و تحصیلات</h3><p class="pre">${esc(d.exp)}</p></div>` : ""}${d.lic ? `<div class="pf-card"><h3>شمارهٔ نظام پزشکی</h3><p>${fa(esc(d.lic))}</p></div>` : ""}`;
  else if (PT === "ct") { const tel = d.tel || "03532529560"; el.innerHTML = `<div class="pf-card"><h3>اطلاعات تماس</h3><ul class="pf-ct"><li><b>محل مطب</b><span>درمانگاه فرهنگیان مهریز</span></li>${d.addr ? `<li><b>نشانی</b><span>${esc(d.addr)}</span></li>` : ""}<li><b>تلفن</b><a dir="ltr" href="tel:${esc(tel)}">${fa(esc(tel))}</a></li></ul></div>`; }
  else loadReviews();
}
async function loadReviews() {
  const el = $("#pfPanel"), id = PD.id; el.innerHTML = `<p class="ld">در حال دریافت نظرات…</p>`;
  let list = [], err = "";
  try { list = (await api("reviews", { doctor: id })).list || []; } catch (e) { err = e.message; }
  if (!PD || PD.id !== id || PT !== "rv") return;
  const form = S.user
    ? `<div class="stars" role="radiogroup" aria-label="امتیاز شما">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${fa(n)} ستاره" data-p="star" data-n="${n}">${STAR}</button>`).join("")}</div>
       <textarea id="rvText" rows="4" maxlength="600" placeholder="تجربهٔ خود را از ویزیت بنویسید…"></textarea><div class="fmsg" id="rvMsg" role="alert"></div>
       <button type="button" class="primary-button wide" data-p="send">ثبت نظر</button><small class="mut">نظر شما پس از بررسی منشی منتشر می‌شود.</small>`
    : `<p class="mut">برای ثبت نظر ابتدا وارد شوید.</p><button type="button" class="primary-button wide" data-p="login">ورود / ثبت‌نام</button>`;
  el.innerHTML = `<div class="pf-card"><h3>نظر شما</h3>${form}</div><div class="pf-card"><h3>نظرات کاربران</h3>${err ? `<p class="fmsg">${esc(err)}</p>` : list.length
    ? list.map(r => `<article class="rvi"><header><b>${esc(r.n)}</b><span class="rt">${STAR}${fa(r.s)}</span><time>${fa(esc(r.d))}</time></header><p class="pre">${esc(r.t)}</p></article>`).join("")
    : `<p class="mut">هنوز نظری منتشر نشده؛ اولین نفر باشید.</p>`}</div>`;
}
const PACT = {
  close: () => prof.close(),
  tab: b => { PT = b.dataset.k; PS = 0; renderProf(); },
  book: () => { const id = PD.id; prof.close(); S.type = null; openWz("doc"); ACT.pickDoc({ id }); },
  login: () => { prof.close(); S.type = null; openWz("login"); },
  star: b => { PS = +b.dataset.n; pBody.querySelectorAll(".stars button").forEach((x, i) => { x.classList.toggle("on", i < PS); x.setAttribute("aria-checked", i + 1 === PS); }); },
  async share() {
    const url = location.origin + location.pathname + "#dr/" + encodeURIComponent(PD.id), title = PD.name + " | درمانگاه فرهنگیان مهریز";
    try { if (navigator.share) await navigator.share({ title, url }); else { await navigator.clipboard.writeText(url); showMsg("ok", "لینک کپی شد", "لینک پروفایل پزشک در حافظه کپی شد.", 2200); } } catch (e) {}
  },
  async send(b) {
    const t = $("#rvText").value.trim();
    if (!PS) return showErr("#rvMsg", "امتیاز را انتخاب کنید.");
    if (t.length < 5) return showErr("#rvMsg", "متن نظر را کمی کامل‌تر بنویسید.");
    showErr("#rvMsg", ""); setBusy(b, true);
    try { await api("review", { token: S.user.token, doctor: PD.id, rate: PS, text: t }, true); PS = 0; showMsg("ok", "نظر شما ثبت شد", "پس از تأیید، در صفحهٔ پزشک نمایش داده می‌شود.", 3600); loadReviews(); }
    catch (e) { showErr("#rvMsg", e.message); } finally { setBusy(b, false); }
  }
};
pBody.addEventListener("click", e => { const b = e.target.closest("[data-p]"); if (b && !b.disabled && !b.classList.contains("busy")) PACT[b.dataset.p](b); });
document.addEventListener("click", e => { const o = e.target.closest("[data-prof]"); if (o) { e.preventDefault(); openProf(o.dataset.prof); } });
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("h4[data-prof]")) openProf(e.target.dataset.prof); });

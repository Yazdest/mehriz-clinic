"use strict";
const $ = s => document.querySelector(s);
const fa = s => String(s).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TYPES = {"عمومی":"پزشکان عمومی","دندانپزشک":"دندان‌پزشکان","متخصص":"پزشکان متخصص"};
const S = {doctors:[], days:[], doc:null, date:null, time:null, email:"", user:JSON.parse(localStorage.getItem("mh_user") || "null")};

async function api(a, data = {}, post = false){
    if (!API_URL || API_URL.startsWith("PASTE")) throw new Error("آدرس API در js/config.js تنظیم نشده است.");
    const body = {a, ...data};
    const r = post ? await fetch(API_URL, {method:"POST", body:JSON.stringify(body)})
                   : await fetch(API_URL + "?" + new URLSearchParams(body));
    const j = await r.json();
    if (j.error){ if (j.error.includes("نشست")) logout(false); throw new Error(j.error); }
    return j;
}
const msg = (t, ok) => { const m = $("#msg"); m.textContent = t; m.className = ok ? "ok" : "err"; };
const authMsg = (t, ok) => { const m = $("#authMsg"); m.textContent = t; m.className = ok ? "ok" : "err"; };

/* ---- پزشکان ---- */
function weekText(d){
    if (!d.week.length) return "برنامه بر اساس تاریخ؛ زمان‌ها در بخش نوبت‌دهی دیده می‌شود";
    const order = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"], by = {};
    d.week.forEach(w => (by[w[0]] = by[w[0]] || []).push(fa(w[1]) + "–" + fa(w[2])));
    return order.filter(k => by[k]).map(k => `<li><b>${k}</b> ${by[k].join(" و ")}</li>`).join("");
}
function renderDoctors(){
    const box = $("#doctorList");
    box.innerHTML = Object.keys(TYPES).map(t => {
        const list = S.doctors.filter(d => d.type === t); if (!list.length) return "";
        return `<h3 class="grp">${TYPES[t]}</h3><div class="doc-grid">` + list.map(d => `
            <article class="doc-card"><h4>${esc(d.name)}</h4>
            ${d.specialty ? `<span class="tag">${esc(d.specialty)}</span>` : ""}
            <ul>${weekText(d)}</ul>
            <a href="#booking" class="doc-btn" data-doc="${esc(d.id)}">دریافت نوبت ←</a></article>`).join("") + `</div>`;
    }).join("") || "<p>فهرست پزشکان به‌زودی اضافه می‌شود.</p>";
    box.querySelectorAll("[data-doc]").forEach(a => a.addEventListener("click", () => pickDoc(a.dataset.doc)));
}

/* ---- انتخاب پزشک / روز / ساعت ---- */
const chip = (label, attrs, on, dis) => `<button type="button" class="chip${on ? " on" : ""}" ${dis ? "disabled" : ""} ${attrs}>${label}</button>`;
function renderDocs(){
    $("#pickDoc").innerHTML = S.doctors.map(d => chip(esc(d.name), `data-id="${esc(d.id)}"`, S.doc === d.id)).join("");
    $("#pickDoc").querySelectorAll(".chip").forEach(b => b.onclick = () => pickDoc(b.dataset.id));
}
function pickDoc(id){
    S.doc = id; S.date = null; S.time = null; renderDocs(); renderDays(); $("#pickTime").innerHTML = "";
}
function renderDays(){
    const list = S.days.filter(d => d.docs[S.doc] !== undefined);
    $("#pickDay").innerHTML = !S.doc ? "<small>ابتدا پزشک را انتخاب کنید.</small>" : !list.length
        ? "<small>در روزهای آینده برنامه‌ای ثبت نشده است.</small>"
        : list.map(d => chip(`${d.day}<br>${fa(d.j.slice(5))}${d.docs[S.doc] ? "" : "<br><em>تکمیل</em>"}`,
            `data-iso="${d.iso}"`, S.date === d.iso, !d.docs[S.doc])).join("");
    $("#pickDay").querySelectorAll(".chip").forEach(b => b.onclick = () => pickDay(b.dataset.iso));
}
async function pickDay(iso){
    S.date = iso; S.time = null; renderDays(); $("#pickTime").innerHTML = "<small>در حال بارگذاری…</small>";
    try {
        const {slots} = await api("slots", {doctor:S.doc, date:iso});
        $("#pickTime").innerHTML = slots.map(s => chip(fa(s.time), `data-t="${s.time}"`, false, !s.free)).join("") || "<small>زمانی وجود ندارد.</small>";
        $("#pickTime").querySelectorAll(".chip").forEach(b => b.onclick = () => {
            S.time = b.dataset.t;
            $("#pickTime").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === b));
        });
    } catch (e){ msg(e.message); }
}
async function confirmBooking(){
    if (!S.doc || !S.date || !S.time) return msg("پزشک، روز و ساعت را انتخاب کنید.");
    const btn = $("#confirm"); btn.disabled = true;
    try {
        const r = await api("book", {token:S.user.token, doctor:S.doc, date:S.date, time:S.time}, true);
        msg(`نوبت ثبت شد. کد پیگیری ${r.code} | ${r.doctor} | ${r.day} ${fa(r.j)} | ساعت حضور ${fa(r.time)}. تأیید به ایمیل شما ارسال شد و منشی با شما تماس می‌گیرد.`, true);
        S.time = null; await refresh(); if (S.date) pickDay(S.date); loadMine();
    } catch (e){ msg(e.message); if (S.date) pickDay(S.date); }
    btn.disabled = false;
}
async function loadMine(){
    try {
        const {list} = await api("my", {token:S.user.token}, true);
        $("#mine").innerHTML = list.length ? list.map(n => `<div class="mine-row"><span>${esc(n.doctor)} | ${esc(n.day)} ${fa(n.j)} | ${fa(n.time)} | ${esc(n.code)}</span>
            <button type="button" data-c="${esc(n.code)}">لغو</button></div>`).join("") : "<small>نوبت فعالی ندارید.</small>";
        $("#mine").querySelectorAll("button").forEach(b => b.onclick = async () => {
            if (!confirm("نوبت لغو شود؟")) return;
            try { await api("cancel", {token:S.user.token, code:b.dataset.c}, true); await refresh(); loadMine(); if (S.date) pickDay(S.date); } catch (e){ msg(e.message); }
        });
    } catch (e){}
}

/* ---- ورود ---- */
function showAuth(){
    const on = !!S.user;
    $("#authBox").hidden = on; $("#steps").hidden = !on;
    if (on){ $("#hello").textContent = "ورود با " + S.user.email; loadMine(); }
}
function logout(render = true){ S.user = null; localStorage.removeItem("mh_user"); if (render) showAuth(); else showAuth(); }
async function sendCode(){
    const email = $("#fEmail").value.trim(), name = $("#fName").value.trim(), mob = $("#fMobile").value.trim();
    if (name.length < 3) return authMsg("نام و نام خانوادگی را وارد کنید.");
    if (!/^(09|۰۹)[\d۰-۹]{9}$/.test(mob)) return authMsg("شمارهٔ موبایل را به شکل 09123456789 وارد کنید.");
    try { await api("code", {email}, true); S.email = email; $("#codeRow").hidden = false; authMsg("کد به ایمیل شما ارسال شد (پوشهٔ اسپم را هم ببینید).", true); }
    catch (e){ authMsg(e.message); }
}
async function verify(){
    try {
        const r = await api("verify", {email:S.email, code:$("#fCode").value, name:$("#fName").value, mobile:$("#fMobile").value}, true);
        S.user = {token:r.token, name:r.name, email:r.email}; localStorage.setItem("mh_user", JSON.stringify(S.user));
        authMsg(""); showAuth();
    } catch (e){ authMsg(e.message); }
}

/* ---- شروع ---- */
async function refresh(){ const d = await api("init"); S.doctors = d.doctors; S.days = d.days; renderDocs(); renderDays(); return d; }
document.addEventListener("DOMContentLoaded", async () => {
    $("#sendCode").onclick = sendCode; $("#verify").onclick = verify;
    $("#confirm").onclick = confirmBooking; $("#logout").onclick = () => logout();
    showAuth();
    try { await refresh(); renderDoctors(); }
    catch (e){ $("#doctorList").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
});

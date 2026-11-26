(() => {
  const $ = s => document.querySelector(s);
  $("#heroSearch")?.addEventListener("click", () => $("#navSearch")?.click());
  const tabs = [...document.querySelectorAll(".tabbar [data-tab]")], docs = $("#doctors");
  const sync = () => { const k = docs && docs.getBoundingClientRect().top < innerHeight * .5 ? "doctors" : "home"; tabs.forEach(t => t.classList.toggle("on", t.dataset.tab === k)); };
  addEventListener("scroll", sync, { passive: true }); sync();
})();

/* جاستیفای متن معرفی با کشیده (ـ) به‌جای باز کردن فاصلهٔ بین کلمات */
(() => {
  const paras = [...document.querySelectorAll(".intro-text p")];
  if (!paras.length) return;
  const DUAL = new Set("بپتثجچحخسشصضطظعغفقکگلمنهیئيك");
  const LET = /[\u0622-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC]/;
  const MAXK = 3;
  const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const slot = w => {                       // بهترین جای کشیده در کلمه (نزدیک به وسط)
    const c = [];
    for (let i = 0; i < w.length - 1; i++) if (DUAL.has(w[i]) && LET.test(w[i + 1])) c.push(i);
    return c.length ? c[Math.floor((c.length - 1) / 2)] : -1;
  };
  function run(p) {
    if (!p.offsetParent) return;
    if (!p.dataset.orig) p.dataset.orig = p.textContent.replace(/\s+/g, " ").trim();
    const words = p.dataset.orig.split(" ");
    p.innerHTML = words.map(w => `<span class="kw">${esc(w)}</span>`).join(" ");
    const sp = [...p.children];
    const probe = sp[0].cloneNode(); probe.textContent = "ـ".repeat(20); p.appendChild(probe);
    const tw = probe.getBoundingClientRect().width / 20; probe.remove();
    if (!(tw > 0)) return;
    const pr = p.getBoundingClientRect(), W = p.clientWidth;
    const lines = [];
    sp.forEach((s, i) => {
      const r = s.getBoundingClientRect(), key = Math.round(r.top);
      const L = lines[lines.length - 1];
      if (L && Math.abs(L.key - key) < 4) { L.i.push(i); L.left = Math.min(L.left, r.left); }
      else lines.push({ key, i: [i], left: r.left });
    });
    lines.slice(0, -1).forEach(L => {
      let n = Math.floor((W - (pr.right - L.left) - 0.5) / tw);
      if (n <= 0) return;
      const cand = L.i.map(i => ({ i, at: slot(words[i]), k: 0, len: words[i].length })).filter(x => x.at >= 0)
        .sort((a, b) => b.len - a.len);
      while (n > 0 && cand.some(x => x.k < MAXK)) {
        for (const x of cand) { if (n <= 0) break; if (x.k < MAXK) { x.k++; n--; } }
      }
      cand.forEach(x => {
        const w = words[x.i];
        sp[x.i].textContent = w.slice(0, x.at + 1) + "ـ".repeat(x.k) + w.slice(x.at + 1);
      });
    });
  }
  const all = () => paras.forEach(run);
  let t; const later = () => { clearTimeout(t); t = setTimeout(all, 120); };
  all();
  document.fonts && document.fonts.ready.then(all);
  addEventListener("load", all);
  addEventListener("resize", later);
  addEventListener("orientationchange", later);
})();

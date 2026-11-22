(() => {
  const $ = s => document.querySelector(s);
  $("#heroSearch")?.addEventListener("click", () => $("#navSearch")?.click());
  const tabs = [...document.querySelectorAll(".tabbar [data-tab]")], docs = $("#doctors");
  const sync = () => { const k = docs && docs.getBoundingClientRect().top < innerHeight * .5 ? "doctors" : "home"; tabs.forEach(t => t.classList.toggle("on", t.dataset.tab === k)); };
  addEventListener("scroll", sync, { passive: true }); sync();
})();

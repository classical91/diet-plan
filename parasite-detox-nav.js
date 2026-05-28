(function () {
  const SECTIONS = [
    { path: "/parasite-detox", label: "Overview" },
    { path: "/parasite-detox/effects", label: "Effects" },
    { path: "/parasite-detox/types", label: "Types" },
    { path: "/parasite-detox/herbs", label: "Herbs" },
    { path: "/parasite-detox/ingredient-stack", label: "Ingredient Stack" },
    { path: "/parasite-detox/eggs", label: "Egg Strategy" },
    { path: "/parasite-detox/protocol-builder", label: "Protocol Builder" },
    { path: "/parasite-detox/detox-library", label: "Detox Library" },
    { path: "/parasite-detox/blend-builder", label: "Blend Builder" },
    { path: "/parasite-detox/safe-plan", label: "Safe Plan" },
    { path: "/parasite-detox/tracker", label: "Tracker" },
    { path: "/parasite-detox/red-flags", label: "Red Flags" }
  ];

  const here = window.location.pathname.replace(/\/+$/, "") || "/parasite-detox";

  const links = SECTIONS.map((s) => {
    const active = s.path === here;
    return `<a href="${s.path}" class="${active ? "active" : ""}"${active ? ' aria-current="page"' : ""}>${s.label}</a>`;
  }).join("");

  const html = `
    <div class="brand"><span class="brand-mark">🌿</span> Parasite / Herb Desk</div>
    <div class="nav-links">${links}</div>`;

  function mount() {
    const el = document.getElementById("pd-subnav");
    if (!el) return;
    el.classList.add("nav");
    el.innerHTML = html;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();

(function () {
  const NAV_HTML = `
    <div class="nav-inner">
      <a href="/" class="nav-logo">NutriMind</a>
      <div class="nav-items" id="navItems">
        <a href="/" class="nav-item" data-path="/">Diet Plan</a>
        <div class="nav-item has-dropdown" data-group="nutrition">
          <span>Nutrition <span class="nav-chevron">▾</span></span>
          <div class="nav-dropdown">
            <a href="/nutrition" class="nav-dropdown-item" data-path="/nutrition">Checklist</a>
            <a href="/nutrition#s-reminders" class="nav-dropdown-item">Reminders</a>
            <a href="/benefits" class="nav-dropdown-item" data-path="/benefits">Benefits</a>
            <a href="/deficiencies" class="nav-dropdown-item" data-path="/deficiencies">Deficiencies</a>
            <a href="/overview" class="nav-dropdown-item" data-path="/overview">Overview</a>
          </div>
        </div>
        <div class="nav-item has-dropdown" data-group="reference">
          <span>Reference <span class="nav-chevron">▾</span></span>
          <div class="nav-dropdown">
            <a href="/howto" class="nav-dropdown-item" data-path="/howto">How-To</a>
            <a href="/diets" class="nav-dropdown-item" data-path="/diets">Diet Types</a>
            <a href="/allergies" class="nav-dropdown-item" data-path="/allergies">Allergies</a>
            <a href="/foodtypes" class="nav-dropdown-item" data-path="/foodtypes">Food Categories</a>
            <a href="/adaptogens" class="nav-dropdown-item" data-path="/adaptogens">Adaptogens</a>
            <a href="/seasonal-rotation" class="nav-dropdown-item" data-path="/seasonal-rotation">Seasonal Rotation</a>
          </div>
        </div>
        <a href="https://workout-tracker-production-0ec7.up.railway.app" class="nav-item" target="_blank" rel="noreferrer">Workout</a>
      </div>
      <button class="nav-mobile-btn" type="button" aria-label="Toggle menu">&#9776;</button>
    </div>
  `;

  function mount() {
    let nav = document.querySelector("nav.top-nav");
    if (!nav) {
      nav = document.createElement("nav");
      nav.className = "top-nav";
      nav.setAttribute("aria-label", "Primary");
      document.body.insertBefore(nav, document.body.firstChild);
    }
    nav.innerHTML = NAV_HTML;

    const path = window.location.pathname.replace(/\/$/, "") || "/";
    const activeLink = nav.querySelector(`[data-path="${path}"]`);
    if (activeLink) {
      activeLink.classList.add("active");
      const parentGroup = activeLink.closest(".nav-item.has-dropdown");
      if (parentGroup) parentGroup.classList.add("has-active");
    }

    const toggleBtn = nav.querySelector(".nav-mobile-btn");
    const items = nav.querySelector("#navItems");
    if (toggleBtn && items) {
      toggleBtn.addEventListener("click", () => items.classList.toggle("open"));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();

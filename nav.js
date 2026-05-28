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
            <a href="/overview" class="nav-dropdown-item" data-path="/overview">Vitamins &amp; Minerals</a>
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
            <a href="/parasite-detox" class="nav-dropdown-item" data-path="/parasite-detox">Parasite Detox</a>
            <a href="/seasonal-rotation" class="nav-dropdown-item" data-path="/seasonal-rotation">Seasonal Rotation</a>
          </div>
        </div>
        <a href="https://workout-tracker-production-0ec7.up.railway.app" class="nav-item" target="_blank" rel="noreferrer">Workout</a>
      </div>
      <div class="nav-search" id="navSearch">
        <input type="search" class="nav-search-input" id="navSearchInput"
               placeholder="Search…" autocomplete="off"
               aria-label="Search the site" />
        <div class="nav-search-results" id="navSearchResults" role="listbox" hidden></div>
      </div>
      <button class="nav-mobile-btn" type="button" aria-label="Toggle menu">&#9776;</button>
    </div>
  `;

  // Item-level search entries are prebuilt into /search-index.json by
  // scripts/build-search-index.mjs (run `npm run build:search`). Each entry is
  // either a single card item — deep-linking to e.g. /benefits/pumpkin-seeds or
  // /deficiencies#i-vitamin-d so the result opens that exact item — or a whole
  // content page. If the manifest can't load we fall back to a flat page list
  // so search still navigates somewhere useful.
  const FALLBACK_PAGES = [
    { path: "/nutrition", title: "Nutrition Checklist" },
    { path: "/benefits", title: "Food Benefits" },
    { path: "/deficiencies", title: "Deficiencies" },
    { path: "/overview", title: "Vitamins & Minerals" },
    { path: "/howto", title: "How-To" },
    { path: "/diets", title: "Diet Types" },
    { path: "/allergies", title: "Allergies" },
    { path: "/foodtypes", title: "Food Categories" },
    { path: "/adaptogens", title: "Adaptogens" },
    { path: "/parasite-detox", title: "Parasite Detox" },
    { path: "/seasonal-rotation", title: "Seasonal Rotation" }
  ];

  let searchIndex = null;
  let searchIndexPromise = null;

  function toEntry(e) {
    const title = e.title || "";
    const text = e.text || "";
    return {
      path: e.path,
      title,
      context: e.context || "",
      text,
      // Matching considers title + body; snippet alignment needs body-only.
      textLower: text.toLowerCase(),
      lower: (title + " " + text).toLowerCase()
    };
  }

  function buildIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    if (searchIndexPromise) return searchIndexPromise;
    searchIndexPromise = fetch("/search-index.json", { credentials: "same-origin" })
      .then((res) => { if (!res.ok) throw new Error("index " + res.status); return res.json(); })
      .then((data) => { searchIndex = (data.entries || []).map(toEntry); return searchIndex; })
      .catch(() => { searchIndex = FALLBACK_PAGES.map(toEntry); return searchIndex; });
    return searchIndexPromise;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function makeSnippet(text, lower, query) {
    const idx = lower.indexOf(query);
    if (idx === -1) {
      // Match was in the title only — show the start of the body for context.
      const head = text.slice(0, 120);
      return escapeHtml(head) + (text.length > 120 ? " …" : "");
    }
    const radius = 60;
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + query.length + radius);
    const before = (start > 0 ? "… " : "") + text.slice(start, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length, end) + (end < text.length ? " …" : "");
    return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
  }

  function countMatches(lower, query) {
    if (!query) return 0;
    let count = 0;
    let i = 0;
    while ((i = lower.indexOf(query, i)) !== -1) { count++; i += query.length; }
    return count;
  }

  function renderResults(resultsEl, query, entries) {
    const q = query.trim().toLowerCase();
    if (!q) { resultsEl.hidden = true; resultsEl.innerHTML = ""; return; }
    if (!entries) {
      resultsEl.hidden = false;
      resultsEl.innerHTML = `<div class="nav-search-empty">Loading…</div>`;
      return;
    }
    const matches = entries
      .map((e) => ({ entry: e, hits: countMatches(e.lower, q) }))
      .filter((m) => m.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 8);

    if (matches.length === 0) {
      resultsEl.hidden = false;
      resultsEl.innerHTML = `<div class="nav-search-empty">No matches for "${escapeHtml(query)}"</div>`;
      return;
    }

    resultsEl.hidden = false;
    resultsEl.innerHTML = matches.map(({ entry, hits }) => `
      <a class="nav-search-result" href="${entry.path}" role="option">
        <div class="nav-search-result-title">
          ${escapeHtml(entry.title)}
          ${entry.context ? `<span class="nav-search-result-context">${escapeHtml(entry.context)}</span>` : ""}
          <span class="nav-search-result-hits">${hits} match${hits === 1 ? "" : "es"}</span>
        </div>
        <div class="nav-search-result-snippet">${makeSnippet(entry.text, entry.textLower, q)}</div>
      </a>
    `).join("");
  }

  function wireSearch(nav) {
    const input = nav.querySelector("#navSearchInput");
    const results = nav.querySelector("#navSearchResults");
    const wrap = nav.querySelector("#navSearch");
    if (!input || !results || !wrap) return;

    let lastQuery = "";

    const triggerRender = () => renderResults(results, input.value, searchIndex);

    input.addEventListener("focus", () => {
      buildIndex().then(() => {
        if (document.activeElement === input) triggerRender();
      });
    });

    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (q === lastQuery) return;
      lastQuery = q;
      if (!searchIndex) {
        renderResults(results, q, null);
        buildIndex().then(() => {
          if (input.value.trim() === q) renderResults(results, q, searchIndex);
        });
      } else {
        triggerRender();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { input.value = ""; results.hidden = true; input.blur(); }
      if (e.key === "Enter") {
        const first = results.querySelector(".nav-search-result");
        if (first) window.location.href = first.getAttribute("href");
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) { results.hidden = true; }
    });
  }

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

    wireSearch(nav);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();

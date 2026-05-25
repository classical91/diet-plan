const SEASONAL_REFERENCE_HREF = "/seasonal-rotation";
const SEASONAL_REFERENCE_LABEL = "Seasonal Rotation";

function findReferenceDropdown() {
  return Array.from(document.querySelectorAll(".nav-item.has-dropdown")).find((item) => {
    const label = item.querySelector("span")?.textContent ?? "";
    return label.toLowerCase().includes("reference");
  })?.querySelector(".nav-dropdown");
}

function ensureSeasonalReferenceLink() {
  const dropdown = findReferenceDropdown();
  if (!dropdown || dropdown.querySelector(`a[href="${SEASONAL_REFERENCE_HREF}"]`)) return;

  const link = document.createElement("a");
  link.href = SEASONAL_REFERENCE_HREF;
  link.className = "nav-dropdown-item";
  link.textContent = SEASONAL_REFERENCE_LABEL;
  dropdown.appendChild(link);
}

const observer = new MutationObserver(() => ensureSeasonalReferenceLink());
observer.observe(document.body, { childList: true, subtree: true });

ensureSeasonalReferenceLink();

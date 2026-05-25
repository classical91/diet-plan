const REFERENCE_LINKS = [
  { href: "/adaptogens", label: "Adaptogens" },
  { href: "/seasonal-rotation", label: "Seasonal Rotation" },
];

function findReferenceDropdown() {
  return Array.from(document.querySelectorAll(".nav-item.has-dropdown")).find((item) => {
    const label = item.querySelector("span")?.textContent ?? "";
    return label.toLowerCase().includes("reference");
  })?.querySelector(".nav-dropdown");
}

function ensureReferenceLinks() {
  const dropdown = findReferenceDropdown();
  if (!dropdown) return;

  for (const item of REFERENCE_LINKS) {
    if (dropdown.querySelector(`a[href="${item.href}"]`)) continue;

    const link = document.createElement("a");
    link.href = item.href;
    link.className = "nav-dropdown-item";
    link.textContent = item.label;
    dropdown.appendChild(link);
  }
}

const observer = new MutationObserver(() => ensureReferenceLinks());
observer.observe(document.body, { childList: true, subtree: true });

ensureReferenceLinks();

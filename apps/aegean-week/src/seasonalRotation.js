const SEASONAL_ROTATION_ID = "seasonal-rotation-panel";

const seasonalRotationStyles = `
  #${SEASONAL_ROTATION_ID} .seasonal-intro {
    color: #7a7063;
    font-size: 0.92rem;
    line-height: 1.6;
    margin: 14px 0 0;
  }

  #${SEASONAL_ROTATION_ID} .seasonal-grid {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }

  #${SEASONAL_ROTATION_ID} .season-card {
    border: 1px solid #2e2a24;
    border-radius: 14px;
    background: #201d19;
    padding: 13px 14px;
  }

  #${SEASONAL_ROTATION_ID} .season-card strong {
    color: #f0ebe3;
    display: block;
    font-size: 0.96rem;
    margin-bottom: 6px;
  }

  #${SEASONAL_ROTATION_ID} .season-card p {
    color: #7a7063;
    font-size: 0.86rem;
    line-height: 1.5;
    margin: 0 0 9px;
  }

  #${SEASONAL_ROTATION_ID} .season-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  #${SEASONAL_ROTATION_ID} .season-tags span {
    background: rgba(200,146,42,0.1);
    color: #c8922a;
    border: 1px solid rgba(200,146,42,0.18);
    border-radius: 999px;
    padding: 4px 9px;
    font-size: 0.76rem;
  }

  #${SEASONAL_ROTATION_ID} .seasonal-note {
    border-top: 1px solid #2e2a24;
    color: #7a7063;
    font-size: 0.8rem;
    line-height: 1.5;
    margin: 14px 0 0;
    padding-top: 12px;
  }
`;

function injectSeasonalRotationStyles() {
  if (document.getElementById("seasonal-rotation-styles")) return;

  const style = document.createElement("style");
  style.id = "seasonal-rotation-styles";
  style.textContent = seasonalRotationStyles;
  document.head.appendChild(style);
}

function createSeasonalRotationPanel() {
  const section = document.createElement("section");
  section.id = SEASONAL_ROTATION_ID;
  section.className = "inspector-panel seasonal-rotation-panel";
  section.innerHTML = `
    <div class="section-heading compact">
      <div>
        <p class="label-line">Ayurvedic rhythm</p>
        <h2>Seasonal Rotation</h2>
      </div>
    </div>

    <p class="seasonal-intro">
      In Ayurveda, it is not only teas that rotate seasonally. Teas are one expression of a bigger rhythm: herbs, foods, spices, drinks, and daily routines can shift with the season so the body gets what it needs.
    </p>

    <div class="seasonal-grid" aria-label="Seasonal rotation examples">
      <article class="season-card">
        <strong>Spring — lighter and cleansing</strong>
        <p>Support freshness, digestion, and a lighter feeling after heavier months.</p>
        <div class="season-tags">
          <span>ginger tea</span>
          <span>nettle</span>
          <span>dandelion</span>
          <span>burdock</span>
        </div>
      </article>

      <article class="season-card">
        <strong>Summer — cooling and calming</strong>
        <p>Favor cooling foods and drinks when the body is already warm.</p>
        <div class="season-tags">
          <span>mint tea</span>
          <span>hibiscus</span>
          <span>cucumber</span>
          <span>watermelon</span>
        </div>
      </article>

      <article class="season-card">
        <strong>Fall/Winter — warming and grounding</strong>
        <p>Bring in warmth, steadiness, soups, stews, and grounding spices.</p>
        <div class="season-tags">
          <span>turmeric</span>
          <span>ginger</span>
          <span>cinnamon</span>
          <span>cloves</span>
        </div>
      </article>
    </div>

    <p class="seasonal-note">
      Simple rule: season changes → body needs change → rotate teas, herbs, foods, and routines.
    </p>
  `;
  return section;
}

function mountSeasonalRotationPanel() {
  injectSeasonalRotationStyles();

  const inspector = document.querySelector(".my-inspector");
  if (!inspector || document.getElementById(SEASONAL_ROTATION_ID)) return;

  const groceryPanel = inspector.querySelector(".grocery-panel");
  const seasonalPanel = createSeasonalRotationPanel();
  inspector.insertBefore(seasonalPanel, groceryPanel ?? null);
}

const observer = new MutationObserver(() => mountSeasonalRotationPanel());
observer.observe(document.body, { childList: true, subtree: true });

mountSeasonalRotationPanel();

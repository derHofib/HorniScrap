import http from 'node:http';
import { URL } from 'node:url';
import { fetchHornbachArticle } from './fetcher.mjs';
import { searchHornbachArticles } from './search.mjs';
import { compareStoreAvailability } from './multi-store.mjs';
import { HORNBACH_STORES, findNearestStores } from './stores.mjs';

const PORT = process.env.PORT || 8050;

// In-Memory-Cache (TTL: 15 Minuten)
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { timestamp: Date.now(), data });
}

// Integrierte HTML-Oberfläche mit Suchleiste, GPS-Ortung, Umkreisvergleich & 1-Klick-Reservierung
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HorniScrap — HORNBACH Suche, GPS-Standort & Gangplätze</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #f97316;
      --accent-hover: #ea580c;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --primary: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1rem;
    }
    .container {
      width: 100%;
      max-width: 1120px;
    }
    header {
      margin-bottom: 2rem;
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: rgba(249, 115, 22, 0.15);
      color: var(--accent);
      border: 1px solid rgba(249, 115, 22, 0.3);
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }
    h1 {
      font-size: 2.25rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.03em;
      margin-bottom: 0.5rem;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 1rem;
    }

    /* Suchleiste */
    .search-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 1.5rem;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.4);
      margin-bottom: 2rem;
    }
    .input-row {
      display: grid;
      grid-template-columns: 1fr 280px auto;
      gap: 0.75rem;
      align-items: center;
    }
    @media (max-width: 820px) {
      .input-row { grid-template-columns: 1fr; }
    }
    .store-select-wrap {
      display: flex;
      gap: 0.4rem;
    }
    .gps-btn {
      padding: 0.85rem;
      background: #334155;
      color: #38bdf8;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      cursor: pointer;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
      transition: background 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .gps-btn:hover {
      background: #475569;
      border-color: #38bdf8;
    }
    .gps-badge {
      display: none;
      margin-top: 0.5rem;
      padding: 0.3rem 0.6rem;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38bdf8;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    input, select {
      width: 100%;
      padding: 0.85rem 1rem;
      background: #0b1120;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus, select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
    }
    .examples {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 0.75rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .chip {
      background: #334155;
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
      cursor: pointer;
      color: #cbd5e1;
      border: none;
      transition: background 0.15s, color 0.15s;
    }
    .chip:hover {
      background: var(--accent);
      color: #fff;
    }
    button.submit-btn {
      padding: 0.85rem 1.5rem;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      white-space: nowrap;
      transition: background 0.2s, transform 0.1s;
    }
    button.submit-btn:hover { background: var(--accent-hover); }
    button.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Spinner */
    .spinner {
      display: none;
      width: 18px;
      height: 18px;
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Results Header */
    .results-header {
      display: none;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding: 0 0.5rem;
    }
    .results-count {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    /* Grid of Product Cards */
    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .product-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.15s, border-color 0.15s;
    }
    .product-card:hover {
      border-color: #475569;
      transform: translateY(-2px);
    }
    .card-top {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .card-thumb {
      width: 80px;
      height: 80px;
      object-fit: contain;
      background: #fff;
      border-radius: 8px;
      padding: 0.4rem;
      flex-shrink: 0;
    }
    .card-meta {
      flex: 1;
      min-width: 0;
    }
    .card-brand {
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .card-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
      line-height: 1.35;
      margin: 0.2rem 0 0.4rem 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-sku {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .card-rating {
      font-size: 0.8rem;
      color: #fbbf24;
      margin-top: 0.2rem;
    }
    .card-bottom {
      border-top: 1px solid var(--card-border);
      padding-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .card-price-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .card-price {
      font-size: 1.4rem;
      font-weight: 800;
      color: #fff;
    }
    .card-unit {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 500;
    }
    .badges-row {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .status-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .badge-online {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
    }
    .badge-store {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #60a5fa;
    }
    .check-btn {
      width: 100%;
      padding: 0.6rem;
      background: #334155;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      transition: background 0.15s;
    }
    .check-btn:hover { background: var(--accent); }

    /* Detail Modal */
    .detail-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(4px);
      z-index: 50;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .detail-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      width: 100%;
      max-width: 720px;
      max-height: 92vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.7);
      position: relative;
    }
    .close-modal {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: #334155;
      color: #fff;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1.2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .close-modal:hover { background: var(--danger); }
    .aisle-highlight {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.8rem;
      background: rgba(249, 115, 22, 0.15);
      border: 1px solid rgba(249, 115, 22, 0.4);
      color: var(--accent);
      border-radius: 6px;
      font-weight: 800;
      font-size: 1rem;
      margin-top: 0.3rem;
    }
    .error-box {
      display: none;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 1rem 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }

    /* Multi-Store Vergleichs-Sektion */
    .multi-store-box {
      background: #0b1120;
      border-top: 1px solid var(--card-border);
      padding: 1.25rem 1.5rem;
    }
    .multi-store-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .multi-store-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .multi-store-btn {
      padding: 0.4rem 0.8rem;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .multi-store-btn:hover { background: #2563eb; }
    .store-compare-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .store-compare-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.6rem 0.8rem;
      background: #1e293b;
      border: 1px solid var(--card-border);
      border-radius: 6px;
      font-size: 0.85rem;
    }
    .res-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 700;
      font-size: 0.8rem;
      padding: 0.25rem 0.6rem;
      border: 1px solid rgba(249, 115, 22, 0.4);
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      transition: background 0.15s, color 0.15s;
    }
    .res-link:hover {
      background: var(--accent);
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="badge">FieldVibe Smart-Locator</span>
      <h1>HORNBACH Suche, GPS-Standort & Gangplätze</h1>
      <p class="subtitle">Echtzeit-Verfügbarkeiten, automatische Filialerkennung per GPS & 1-Klick-Reservierung</p>
    </header>

    <div class="search-card">
      <form id="searchForm">
        <div class="input-row">
          <div>
            <input type="text" id="searchInput" placeholder="Suchbegriff (z. B. FI Schalter), SKU (6072187) oder EAN-Barcode..." required autofocus>
          </div>
          <div>
            <div class="store-select-wrap">
              <select id="storeSelect">
                <option value="609" selected>609 — Berlin-Mariendorf</option>
                <option value="616">616 — Berlin-Neukölln</option>
                <option value="608">608 — Velten</option>
                <option value="617">617 — Berlin-Bohnsdorf</option>
                <option value="611">611 — Potsdam-Marquardt</option>
                <option value="710">710 — München-Fröttmaning</option>
                <option value="510">510 — Frankfurt-Niedereschbach</option>
              </select>
              <button type="button" class="gps-btn" id="gpsBtn" onclick="locateNearestStore()" title="Nächste Filiale per Smartphone-GPS ermitteln">
                📍 GPS
              </button>
            </div>
            <div class="gps-badge" id="gpsBadge"></div>
          </div>
          <div>
            <button type="submit" class="submit-btn" id="submitBtn">
              <span class="spinner" id="spinner"></span>
              <span id="btnText">Suchen</span>
            </button>
          </div>
        </div>
        <div class="examples">
          <span>Direkt-Klicks:</span>
          <button type="button" class="chip" onclick="triggerSearch('FI Schalter 16A')">FI Schalter 16A</button>
          <button type="button" class="chip" onclick="triggerSearch('NYM-J 5x2.5')">NYM-J 5x2,5</button>
          <button type="button" class="chip" onclick="triggerSearch('WAGO Klemmen')">WAGO Klemmen</button>
          <button type="button" class="chip" onclick="triggerSearch('6072187')">Art.-Nr. 6072187</button>
          <button type="button" class="chip" onclick="triggerSearch('3250611068143')">EAN 3250611068143</button>
        </div>
      </form>
    </div>

    <div class="error-box" id="errorBox"></div>

    <div class="results-header" id="resultsHeader">
      <div class="results-count" id="resultsCount">0 Treffer gefunden</div>
      <div style="font-size: 0.85rem; color: var(--text-muted);">⚡ Blitzschnell über Browser-Pool</div>
    </div>

    <div class="results-grid" id="resultsGrid"></div>
  </div>

  <!-- Detail Modal -->
  <div class="detail-overlay" id="detailOverlay" onclick="if(event.target===this)closeDetail()">
    <div class="detail-card">
      <button class="close-modal" onclick="closeDetail()">&times;</button>
      <div style="padding: 1.5rem; border-bottom: 1px solid var(--card-border); display: flex; gap: 1rem;">
        <img id="detailImg" src="" style="width: 100px; height: 100px; object-fit: contain; background: #fff; border-radius: 8px; padding: 0.3rem;">
        <div style="flex: 1;">
          <div id="detailBrand" style="color: var(--accent); font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">MARKE</div>
          <h2 id="detailTitle" style="font-size: 1.15rem; font-weight: 700; margin: 0.2rem 0 0.5rem 0;">Titel</h2>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--text-muted);" id="detailSku">SKU: </div>
        </div>
      </div>
      <div style="padding: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Einkaufspreis</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #fff; margin-top: 0.25rem;"><span id="detailPrice">0.00</span> € <span style="font-size: 0.9rem; color: var(--text-muted);" id="detailUnit">/ ST</span></div>
          <div id="detailTier" style="margin-top: 0.5rem;"></div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Gewählte Filiale</div>
          <div style="font-size: 1rem; font-weight: 700; color: #fff; margin-top: 0.25rem;" id="detailStoreName">Markt</div>
          <div id="detailStock" style="font-weight: 700; margin-top: 0.25rem;">Bestand...</div>
          <div class="aisle-highlight" id="detailAisle">📍 Gang 20</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.4rem;" id="detailPickup"></div>
        </div>
      </div>

      <!-- Umkreisvergleich Sektion -->
      <div class="multi-store-box">
        <div class="multi-store-header">
          <div class="multi-store-title">📍 Filialen im Umkreis vergleichen</div>
          <button class="multi-store-btn" id="runCompareBtn" onclick="runUmkreisVergleich()">
            ⚡ Umkreis prüfen
          </button>
        </div>
        <div id="compareLoading" style="display: none; font-size: 0.85rem; color: var(--text-muted); padding: 0.5rem 0;">
          Frage Filialen im Umkreis parallel ab (~2-3s)...
        </div>
        <div class="store-compare-list" id="compareList"></div>
      </div>

      <div style="padding: 1rem 1.5rem; background: #0f172a; border-top: 1px solid var(--card-border); display: flex; gap: 0.75rem;">
        <a id="resDirectLink" href="#" target="_blank" class="submit-btn" style="flex: 1; text-decoration: none; font-size: 0.9rem; background: #334155;">
          🛒 Direkt bei Hornbach reservieren ↗
        </a>
        <button style="flex: 1; padding: 0.75rem; background: var(--accent); color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;" onclick="alert('In FieldVibe als Materialbedarf übernommen!')">
          + In FieldVibe-Vorgang übernehmen
        </button>
      </div>
    </div>
  </div>

  <script>
    const form = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const storeSelect = document.getElementById('storeSelect');
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('spinner');
    const btnText = document.getElementById('btnText');
    const resultsGrid = document.getElementById('resultsGrid');
    const resultsHeader = document.getElementById('resultsHeader');
    const resultsCount = document.getElementById('resultsCount');
    const errorBox = document.getElementById('errorBox');
    const gpsBtn = document.getElementById('gpsBtn');
    const gpsBadge = document.getElementById('gpsBadge');

    let currentDetailArticle = null;
    let userCoords = null;
    let nearbyStoresList = [];

    // GPS-Standort des Geräts ermitteln
    function locateNearestStore() {
      if (!navigator.geolocation) {
        alert('Geolocation wird von diesem Browser/Gerät nicht unterstützt.');
        return;
      }

      gpsBtn.disabled = true;
      gpsBtn.textContent = 'Ortung...';

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          userCoords = { lat, lng };

          try {
            const res = await fetch(\`/api/stores/nearest?lat=\${lat}&lng=\${lng}&limit=8\`);
            const data = await res.json();

            if (data.nearest && data.nearest.length > 0) {
              nearbyStoresList = data.nearest;

              // Dropdown aktualisieren & mit Entfernungen befüllen
              storeSelect.innerHTML = '';
              data.nearest.forEach((st, idx) => {
                const opt = document.createElement('option');
                opt.value = st.id;
                opt.textContent = \`\${st.id} — \${st.name} (\${st.distanceKm} km)\`;
                if (idx === 0) opt.selected = true;
                storeSelect.appendChild(opt);
              });

              const nearest = data.nearest[0];
              gpsBadge.textContent = \`🎯 Nächster Markt: \${nearest.name} (\${nearest.distanceKm} km entfernt)\`;
              gpsBadge.style.display = 'inline-block';
            }
          } catch (err) {
            alert('Fehler bei der Filialsuche: ' + err.message);
          } finally {
            gpsBtn.disabled = false;
            gpsBtn.textContent = '📍 GPS';
          }
        },
        (err) => {
          gpsBtn.disabled = false;
          gpsBtn.textContent = '📍 GPS';
          alert('Standortzugriff nicht möglich: ' + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }

    function triggerSearch(term) {
      searchInput.value = term;
      form.dispatchEvent(new Event('submit'));
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = searchInput.value.trim();
      const storeId = storeSelect.value;
      if (!query) return;

      submitBtn.disabled = true;
      spinner.style.display = 'inline-block';
      btnText.textContent = 'Suche...';
      errorBox.style.display = 'none';
      resultsGrid.innerHTML = '';
      resultsHeader.style.display = 'none';

      try {
        const res = await fetch(\`/api/search?q=\${encodeURIComponent(query)}&storeId=\${encodeURIComponent(storeId)}\`);
        const data = await res.json();

        if (!res.ok || data.error) throw new Error(data.error || 'Fehler bei der Suche');

        if (data.isSingleProduct && data.results.length === 1) {
          renderCards(data.results, true);
          openDetail(data.results[0]);
        } else {
          renderCards(data.results, false);
        }
      } catch (err) {
        errorBox.textContent = '❌ ' + err.message;
        errorBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = 'Suchen';
      }
    });

    function renderCards(items, isSingle) {
      resultsGrid.innerHTML = '';
      resultsHeader.style.display = 'flex';
      resultsCount.textContent = \`\${items.length} Treffer bei HORNBACH\`;

      if (items.length === 0) {
        resultsGrid.innerHTML = '<div style="color: var(--text-muted); padding: 2rem;">Keine passenden Artikel gefunden.</div>';
        return;
      }

      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = \`
          <div>
            <div class="card-top">
              <img src="\${item.imageUrl || 'https://via.placeholder.com/80'}" class="card-thumb" alt="">
              <div class="card-meta">
                <div class="card-brand">\${item.brand || 'HORNBACH'}</div>
                <div class="card-title" title="\${item.title}">\${item.title}</div>
                <div class="card-sku">Art.-Nr. \${item.sku}</div>
                \${item.rating ? \`<div class="card-rating">★ \${item.rating.averageRating} (\${item.rating.reviewCount})</div>\` : ''}
              </div>
            </div>
            <div class="badges-row">
              \${item.canOrderOnline ? '<span class="status-badge badge-online">🟢 Online lieferbar</span>' : ''}
              \${item.canReserveInStore ? '<span class="status-badge badge-store">🏢 Im Markt</span>' : ''}
            </div>
          </div>
          <div class="card-bottom">
            <div class="card-price-row">
              <div class="card-price">\${item.price.toFixed(2)} €</div>
              <div class="card-unit">/ \${item.unit}</div>
            </div>
            <button class="check-btn" onclick='checkArticleDetail("\${item.sku}")'>
              📍 Bestand & Gang prüfen
            </button>
          </div>
        \`;
        resultsGrid.appendChild(card);
      });
    }

    async function checkArticleDetail(sku) {
      const storeId = storeSelect.value;
      submitBtn.disabled = true;
      btnText.textContent = 'Prüfe...';
      try {
        const res = await fetch(\`/api/article?query=\${encodeURIComponent(sku)}&storeId=\${encodeURIComponent(storeId)}\`);
        const article = await res.json();
        if (article.error) throw new Error(article.error);
        openDetail(article);
      } catch (err) {
        alert('Fehler beim Laden: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        btnText.textContent = 'Suchen';
      }
    }

    function openDetail(a) {
      currentDetailArticle = a;
      document.getElementById('compareList').innerHTML = '';
      document.getElementById('compareLoading').style.display = 'none';

      document.getElementById('detailImg').src = a.imageUrl || 'https://via.placeholder.com/100';
      document.getElementById('detailBrand').textContent = a.brand || 'HORNBACH';
      document.getElementById('detailTitle').textContent = a.title;
      document.getElementById('detailSku').textContent = 'Art.-Nr.: ' + a.sku + (a.ean ? ' • EAN: ' + a.ean : '');
      document.getElementById('detailPrice').textContent = a.price.toFixed(2);
      document.getElementById('detailUnit').textContent = '/ ' + a.unit;

      const tierDiv = document.getElementById('detailTier');
      tierDiv.innerHTML = '';
      if (a.tierPrices && a.tierPrices.length > 0) {
        const tp = a.tierPrices[0];
        tierDiv.innerHTML = \`<span style="background: rgba(16, 185, 129, 0.15); color: var(--success); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 700;">ab \${tp.minAmount} \${tp.unit} nur \${tp.price.toFixed(2)} €</span>\`;
      }

      if (a.store) {
        document.getElementById('detailStoreName').textContent = a.store.name || ('Markt ' + a.store.storeId);
        const stockEl = document.getElementById('detailStock');
        stockEl.textContent = a.store.inStock
          ? ('🟢 ' + (a.store.stockCount !== null ? a.store.stockCount + ' Stück vorrätig' : 'Im Markt vorrätig'))
          : '🔴 Nicht vorrätig';
        stockEl.style.color = a.store.inStock ? 'var(--success)' : 'var(--danger)';

        const aisleEl = document.getElementById('detailAisle');
        if (a.store.aisle) {
          aisleEl.textContent = '📍 ' + a.store.aisle;
          aisleEl.style.display = 'inline-flex';
        } else {
          aisleEl.style.display = 'none';
        }

        document.getElementById('detailPickup').textContent = a.store.pickupTimeText || '';
      }

      const resLink = document.getElementById('resDirectLink');
      resLink.href = a.url || ('https://www.hornbach.de/p/' + a.sku + '/');

      document.getElementById('detailOverlay').style.display = 'flex';
    }

    async function runUmkreisVergleich() {
      if (!currentDetailArticle) return;
      const compareLoading = document.getElementById('compareLoading');
      const compareList = document.getElementById('compareList');
      const compareBtn = document.getElementById('runCompareBtn');

      compareLoading.style.display = 'block';
      compareBtn.disabled = true;
      compareList.innerHTML = '';

      // Falls GPS aktiv war, nutze die echten nächstgelegenen Filialen!
      let storesParam = 'berlin';
      if (nearbyStoresList.length >= 2) {
        storesParam = nearbyStoresList.slice(0, 4).map(s => s.id).join(',');
      }

      try {
        const res = await fetch(\`/api/article/multi-store?query=\${encodeURIComponent(currentDetailArticle.sku)}&stores=\${encodeURIComponent(storesParam)}\`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        data.stores.forEach(st => {
          const row = document.createElement('div');
          row.className = 'store-compare-row';
          row.innerHTML = \`
            <div>
              <div style="font-weight: 700; color: #fff;">\${st.name || ('Markt ' + st.storeId)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">
                \${st.aisle ? '📍 ' + st.aisle : 'Regal n.v.'} • \${st.pickupTimeText || 'Lieferzeit n.v.'}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-weight: 700; color: \${st.inStock ? 'var(--success)' : 'var(--danger)'};">
                \${st.inStock ? '🟢 ' + st.stockCount + ' Stk.' : '🔴 Ausverkauft'}
              </span>
              \${st.reservationUrl ? \`<a href="\${st.reservationUrl}" target="_blank" class="res-link">Reservieren ↗</a>\` : ''}
            </div>
          \`;
          compareList.appendChild(row);
        });
      } catch (err) {
        compareList.innerHTML = \`<div style="color: var(--danger); font-size: 0.85rem;">Fehler: \${err.message}</div>\`;
      } finally {
        compareLoading.style.display = 'none';
        compareBtn.disabled = false;
      }
    }

    function closeDetail() {
      document.getElementById('detailOverlay').style.display = 'none';
    }
  </script>
</body>
</html>
`;

// HTTP Server
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Healthcheck
  if (reqUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }

  // 2. GPS-Nächste Filialen: GET /api/stores/nearest?lat=52.52&lng=13.41&limit=5
  if (reqUrl.pathname === '/api/stores/nearest') {
    const latStr = reqUrl.searchParams.get('lat');
    const lngStr = reqUrl.searchParams.get('lng');
    const limit = parseInt(reqUrl.searchParams.get('limit') || '5', 10);

    if (!latStr || !lngStr) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Parameter lat und lng erforderlich' }));
      return;
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ungültige Koordinaten' }));
      return;
    }

    const nearest = findNearestStores(lat, lng, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        deviceCoords: { lat, lng },
        count: nearest.length,
        nearest,
      })
    );
    return;
  }

  // 3. Alle Filialen: GET /api/stores
  if (reqUrl.pathname === '/api/stores') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: HORNBACH_STORES.length, stores: HORNBACH_STORES }));
    return;
  }

  // 4. Multi-Store Umkreisvergleich: GET /api/article/multi-store?query=...&stores=berlin
  if (reqUrl.pathname === '/api/article/multi-store') {
    const query = reqUrl.searchParams.get('query') || reqUrl.searchParams.get('sku');
    const stores = reqUrl.searchParams.get('stores') || 'berlin';

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Parameter query oder sku erforderlich' }));
      return;
    }

    const cacheKey = `multistore:${query.trim()}:${stores}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
      res.end(JSON.stringify(cached));
      return;
    }

    try {
      console.log(`[API MultiStore] Vergleiche Filialen (${stores}) für "${query}"...`);
      const result = await compareStoreAvailability({
        urlOrSku: query,
        stores,
      });

      setCache(cacheKey, result);

      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error(`[API MultiStore] Fehler bei "${query}":`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5. Volltextsuche: GET /api/search?q=<term>&storeId=<storeId>
  if (reqUrl.pathname === '/api/search') {
    const q = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('query');
    const storeId = reqUrl.searchParams.get('storeId') || null;

    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Suchbegriff (q) erforderlich' }));
      return;
    }

    const cacheKey = `search:${q.trim().toLowerCase()}:${storeId || 'default'}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
      res.end(JSON.stringify(cached));
      return;
    }

    try {
      console.log(`[API Search] Suche HORNBACH nach: "${q}" (Markt: ${storeId || 'Default'})...`);
      const results = await searchHornbachArticles({
        searchTerm: q,
        storeId,
      });

      setCache(cacheKey, results);

      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
      res.end(JSON.stringify(results));
    } catch (err) {
      console.error(`[API Search] Fehler bei Suche nach "${q}":`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 6. Einzelartikel-Abfrage: GET /api/article?query=<skuOrUrl>&storeId=<storeId>
  if (reqUrl.pathname === '/api/article') {
    const query = reqUrl.searchParams.get('query') || reqUrl.searchParams.get('sku');
    const storeId = reqUrl.searchParams.get('storeId') || null;

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Parameter query oder sku erforderlich' }));
      return;
    }

    const cacheKey = `article:${query.trim()}:${storeId || 'default'}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
      res.end(JSON.stringify(cached));
      return;
    }

    try {
      console.log(`[API Article] Frage HORNBACH ab: "${query}" (Markt: ${storeId || 'Default'})...`);
      const result = await fetchHornbachArticle({
        urlOrSku: query,
        storeId,
      });

      setCache(cacheKey, result);

      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error(`[API Article] Fehler beim Abruf von "${query}":`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 7. Web-UI
  if (reqUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`
🚀 HorniScrap Server läuft mit GPS-Ortung & Umkreissuche!
👉 Oberfläche: http://localhost:${PORT}
📍 GPS-Endpunkt: http://localhost:${PORT}/api/stores/nearest?lat=<LAT>&lng=<LNG>
📡 API-Umkreissuche: http://localhost:${PORT}/api/article/multi-store?query=<SKU>&stores=berlin
📡 API-Suche: http://localhost:${PORT}/api/search?q=<BEGRIFF>&storeId=<STORE>
📡 API-Artikel: http://localhost:${PORT}/api/article?sku=<SKU>&storeId=<STORE>
`);
});

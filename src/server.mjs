import http from 'node:http';
import { URL } from 'node:url';
import { fetchHornbachArticle } from './fetcher.mjs';

const PORT = process.env.PORT || 8050;

// Einfacher In-Memory-Cache (TTL: 15 Minuten), um Hornbach nicht unnötig zu belasten
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

// Integrierte HTML-Oberfläche (Modern, Responsive, im Stil von FieldVibe)
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HorniScrap — FieldVibe Material-Checker</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #f97316; /* Hornbach Orange */
      --accent-hover: #ea580c;
      --success: #10b981;
      --danger: #ef4444;
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
      max-width: 800px;
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
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .search-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      margin-bottom: 2rem;
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #cbd5e1;
    }
    .input-row {
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 1rem;
    }
    @media (max-width: 640px) {
      .input-row { grid-template-columns: 1fr; }
    }
    input, select {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus, select:focus {
      border-color: var(--accent);
    }
    .examples {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .chip {
      background: #334155;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      cursor: pointer;
      color: #cbd5e1;
      border: none;
      transition: background 0.15s;
    }
    .chip:hover {
      background: var(--accent);
      color: #fff;
    }
    button.submit-btn {
      width: 100%;
      padding: 0.85rem;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.2s, transform 0.1s;
    }
    button.submit-btn:hover {
      background: var(--accent-hover);
    }
    button.submit-btn:active {
      transform: scale(0.99);
    }
    button.submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    /* Loading Spinner */
    .spinner {
      display: none;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Result Card */
    .result-card {
      display: none;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .product-header {
      padding: 1.5rem;
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 1.5rem;
      border-bottom: 1px solid var(--card-border);
      background: rgba(255,255,255,0.02);
    }
    @media (max-width: 550px) {
      .product-header { grid-template-columns: 1fr; }
    }
    .product-img {
      width: 100%;
      height: 140px;
      object-fit: contain;
      background: #fff;
      border-radius: 8px;
      padding: 0.5rem;
    }
    .product-details {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .product-brand {
      color: var(--accent);
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .product-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      margin: 0.25rem 0 0.75rem 0;
      line-height: 1.3;
    }
    .meta-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .meta-tag {
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      padding: 0.2rem 0.5rem;
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 4px;
      color: #94a3b8;
    }

    /* Grid for Inventory & Price */
    .product-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid var(--card-border);
    }
    @media (max-width: 640px) {
      .product-grid { grid-template-columns: 1fr; }
    }
    .grid-col {
      padding: 1.5rem;
    }
    .grid-col:first-child {
      border-right: 1px solid var(--card-border);
    }
    @media (max-width: 640px) {
      .grid-col:first-child { border-right: none; border-bottom: 1px solid var(--card-border); }
    }
    .section-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    .price-tag {
      font-size: 2rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.02em;
    }
    .price-unit {
      font-size: 1rem;
      color: var(--text-muted);
      font-weight: 500;
    }
    .tier-prices {
      margin-top: 0.75rem;
      font-size: 0.85rem;
      color: #cbd5e1;
    }
    .tier-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
      border-radius: 4px;
      font-weight: 600;
      margin-top: 0.25rem;
    }

    /* Store Info Box */
    .store-box {
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1rem;
    }
    .store-header {
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 0.5rem;
    }
    .store-stock {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--success);
      margin-bottom: 0.5rem;
    }
    .aisle-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      background: rgba(249, 115, 22, 0.15);
      border: 1px solid rgba(249, 115, 22, 0.4);
      color: var(--accent);
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.9rem;
      margin-top: 0.5rem;
    }
    .delivery-info {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    /* Raw JSON details */
    details {
      padding: 1rem 1.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);
      cursor: pointer;
    }
    summary {
      font-weight: 600;
      outline: none;
    }
    pre {
      margin-top: 0.75rem;
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 1rem;
      color: #38bdf8;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      overflow-x: auto;
      max-height: 250px;
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
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="badge">FieldVibe Integration Prototype</span>
      <h1>HorniScrap Material-Checker</h1>
      <p class="subtitle">Echtzeit-Verfügbarkeit, Preise & Regalstandorte von HORNBACH abfragen</p>
    </header>

    <div class="search-card">
      <form id="checkForm">
        <div class="form-group">
          <div class="input-row">
            <div>
              <label for="query">Artikelnummer (SKU) oder HORNBACH-URL</label>
              <input type="text" id="query" placeholder="z. B. 6072187 oder Hornbach-Link" required>
            </div>
            <div>
              <label for="storeId">HORNBACH Filiale</label>
              <select id="storeId">
                <option value="609" selected>609 — Berlin-Mariendorf</option>
                <option value="616">616 — Berlin-Neukölln</option>
                <option value="608">608 — Velten</option>
                <option value="617">617 — Berlin-Bohnsdorf</option>
                <option value="611">611 — Potsdam-Marquardt</option>
                <option value="710">710 — München-Fröttmaning</option>
                <option value="510">510 — Frankfurt-Niedereschbach</option>
              </select>
            </div>
          </div>
          <div class="examples">
            <span>Schnell-Beispiele:</span>
            <button type="button" class="chip" onclick="fillExample('6072187', '609')">FI-Schalter 16A (Mariendorf)</button>
            <button type="button" class="chip" onclick="fillExample('6072187', '616')">FI-Schalter 16A (Neukölln)</button>
            <button type="button" class="chip" onclick="fillExample('5101035', '609')">Kabel NYM-J 5x2,5</button>
          </div>
        </div>

        <button type="submit" class="submit-btn" id="submitBtn">
          <span class="spinner" id="spinner"></span>
          <span id="btnText">Verfügbarkeit & Preis prüfen</span>
        </button>
      </form>
    </div>

    <div class="error-box" id="errorBox"></div>

    <div class="result-card" id="resultCard">
      <div class="product-header">
        <img src="" alt="" class="product-img" id="productImg">
        <div class="product-details">
          <div class="product-brand" id="productBrand">Hager</div>
          <h2 class="product-title" id="productTitle">Produktname</h2>
          <div class="meta-tags">
            <span class="meta-tag" id="metaSku">SKU: -</span>
            <span class="meta-tag" id="metaEan">EAN: -</span>
            <span class="meta-tag" id="metaOnline">Online: -</span>
          </div>
        </div>
      </div>

      <div class="product-grid">
        <div class="grid-col">
          <div class="section-title">Einkaufspreis</div>
          <div class="price-tag">
            <span id="priceValue">0.00</span> €
            <span class="price-unit" id="priceUnit">/ ST</span>
          </div>
          <div class="tier-prices" id="tierPriceContainer"></div>
        </div>

        <div class="grid-col">
          <div class="section-title">Vor-Ort-Bestand & Regalplatz</div>
          <div class="store-box" id="storeBox">
            <div class="store-header" id="storeName">Markt</div>
            <div class="store-stock" id="storeStock">🟢 Bestand wird ermittelt...</div>
            <div class="aisle-badge" id="aisleBadge">📍 Gang 20</div>
            <div class="delivery-info" id="deliveryInfo">Abholzeit</div>
          </div>
        </div>
      </div>

      <details>
        <summary>Rohdaten ansehen (JSON für FieldVibe REST-API)</summary>
        <pre><code id="jsonOutput">{}</code></pre>
      </details>
    </div>
  </div>

  <script>
    function fillExample(sku, store) {
      document.getElementById('query').value = sku;
      if (store) document.getElementById('storeId').value = store;
      document.getElementById('checkForm').dispatchEvent(new Event('submit'));
    }

    const form = document.getElementById('checkForm');
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('spinner');
    const btnText = document.getElementById('btnText');
    const resultCard = document.getElementById('resultCard');
    const errorBox = document.getElementById('errorBox');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = document.getElementById('query').value.trim();
      const storeId = document.getElementById('storeId').value;

      if (!query) return;

      submitBtn.disabled = true;
      spinner.style.display = 'inline-block';
      btnText.textContent = 'HORNBACH wird abgefragt (~10s)...';
      errorBox.style.display = 'none';
      resultCard.style.display = 'none';

      try {
        const res = await fetch(\`/api/article?query=\${encodeURIComponent(query)}&storeId=\${encodeURIComponent(storeId)}\`);
        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || 'Fehler beim Abruf');
        }

        renderArticle(data);
      } catch (err) {
        errorBox.textContent = '❌ ' + err.message;
        errorBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = 'Verfügbarkeit & Preis prüfen';
      }
    });

    function renderArticle(a) {
      document.getElementById('productImg').src = a.imageUrl || 'https://via.placeholder.com/140';
      document.getElementById('productBrand').textContent = a.brand || 'HORNBACH';
      document.getElementById('productTitle').textContent = a.title;
      document.getElementById('metaSku').textContent = 'SKU: ' + a.sku;
      document.getElementById('metaEan').textContent = 'EAN: ' + (a.ean || 'k.A.');
      document.getElementById('metaOnline').textContent = a.online.canOrder ? 'Online: Lieferbar (' + (a.online.deliveryTimeText || '') + ')' : 'Online: Nicht lieferbar';

      document.getElementById('priceValue').textContent = a.price.toFixed(2);
      document.getElementById('priceUnit').textContent = '/ ' + a.unit;

      const tierContainer = document.getElementById('tierPriceContainer');
      tierContainer.innerHTML = '';
      if (a.tierPrices && a.tierPrices.length > 0) {
        const tp = a.tierPrices[0];
        tierContainer.innerHTML = \`<div class="tier-badge">Mengenrabatt: ab \${tp.minAmount} \${tp.unit} nur \${tp.price.toFixed(2)} €</div>\`;
      }

      if (a.store) {
        document.getElementById('storeName').textContent = a.store.name || ('Markt ID ' + a.store.storeId);
        document.getElementById('storeStock').textContent = a.store.inStock
          ? ('🟢 ' + (a.store.stockCount !== null ? a.store.stockCount + ' Stück vorrätig' : 'Im Markt vorrätig'))
          : '🔴 Nicht im Markt vorrätig';
        document.getElementById('storeStock').style.color = a.store.inStock ? 'var(--success)' : 'var(--danger)';

        const aisleBadge = document.getElementById('aisleBadge');
        if (a.store.aisle) {
          aisleBadge.textContent = '📍 ' + a.store.aisle;
          aisleBadge.style.display = 'inline-flex';
        } else {
          aisleBadge.style.display = 'none';
        }

        document.getElementById('deliveryInfo').textContent = a.store.pickupTimeText || '';
      }

      document.getElementById('jsonOutput').textContent = JSON.stringify(a, null, 2);
      resultCard.style.display = 'block';
    }
  </script>
</body>
</html>
`;

// HTTP Server
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  // CORS Header für Anfragen von FieldVibe (z. B. Vite Dev Server http://localhost:5173)
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

  // 2. API-Endpunkt für FieldVibe
  if (reqUrl.pathname === '/api/article') {
    const query = reqUrl.searchParams.get('query') || reqUrl.searchParams.get('sku');
    const storeId = reqUrl.searchParams.get('storeId') || null;

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Parameter query oder sku erforderlich' }));
      return;
    }

    const cacheKey = `${query.trim()}:${storeId || 'default'}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
      res.end(JSON.stringify(cached));
      return;
    }

    try {
      console.log(`[API] Frage HORNBACH ab: "${query}" (Markt: ${storeId || 'Default'})...`);
      const result = await fetchHornbachArticle({
        urlOrSku: query,
        storeId,
      });

      setCache(cacheKey, result);

      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error(`[API] Fehler beim Abruf von "${query}":`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. Web-UI
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
🚀 HorniScrap Server läuft!
👉 Test-Oberfläche im Browser: http://localhost:${PORT}
📡 API-Endpunkt für FieldVibe: http://localhost:${PORT}/api/article?sku=<SKU>&storeId=<STORE>
`);
});

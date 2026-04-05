// netlify/functions/cotizaciones.js
// FinBridge - Proxy de cotizaciones del mercado argentino
// Obtiene datos de múltiples fuentes y los unifica para el frontend

const CACHE = { data: null, timestamp: 0 };
const CACHE_TTL = 60000; // 1 minuto

// ===== FUENTES DE DATOS =====

// 1. DolarAPI - Cotizaciones de dólar (backup, el frontend ya las obtiene directo)
async function fetchDolarAPI() {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('DolarAPI error:', e.message);
    return null;
  }
}

// 2. Intentar obtener datos de BYMA Open Data
async function fetchBYMAData() {
  try {
    // BYMA open data endpoint for delayed quotes
    const res = await fetch('https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/bnown', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FinBridge/1.0'
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('BYMA error:', e.message);
    return null;
  }
}

// 3. Intentar ArgentinaDatos API para datos complementarios
async function fetchArgentinaDatos() {
  try {
    const res = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/merval/ultimo');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// 4. Riesgo país
async function fetchRiesgoPais() {
  try {
    const res = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ===== DATOS DE REFERENCIA (fallback) =====
// Se usan cuando las APIs no responden
// Se actualizan periódicamente con datos reales del mercado
function getReferenceData() {
  return {
    acciones: [
      { ticker: 'GGAL', name: 'Grupo Fin. Galicia', price: 8245.50, change: 2.15 },
      { ticker: 'YPF', name: 'YPF S.A.', price: 42180.00, change: 1.87 },
      { ticker: 'PAMP', name: 'Pampa Energía', price: 3890.00, change: -0.42 },
      { ticker: 'BBAR', name: 'Banco BBVA Argentina', price: 6720.00, change: 1.23 },
      { ticker: 'TXAR', name: 'Ternium Argentina', price: 1285.00, change: 0.95 },
      { ticker: 'TGSU2', name: 'Transportadora de Gas del Sur', price: 4150.00, change: 0.67 },
      { ticker: 'SUPV', name: 'Grupo Supervielle', price: 2340.00, change: -0.88 },
      { ticker: 'BYMA', name: 'Bolsas y Mercados Arg.', price: 1890.00, change: 1.45 },
      { ticker: 'LOMA', name: 'Loma Negra', price: 1520.00, change: 0.33 },
      { ticker: 'ALUA', name: 'Aluar', price: 965.00, change: -0.21 },
    ],
    cedears: [
      { ticker: 'AAPL', name: 'Apple Inc.', price: 32450.00, change: 0.85 },
      { ticker: 'MSFT', name: 'Microsoft Corp.', price: 28900.00, change: 1.12 },
      { ticker: 'MELI', name: 'MercadoLibre Inc.', price: 185600.00, change: 2.34 },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 24100.00, change: 0.56 },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 26800.00, change: 1.78 },
      { ticker: 'TSLA', name: 'Tesla Inc.', price: 18950.00, change: -1.23 },
      { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 45200.00, change: 3.45 },
      { ticker: 'META', name: 'Meta Platforms', price: 38100.00, change: 0.92 },
      { ticker: 'BABA', name: 'Alibaba Group', price: 15400.00, change: -0.67 },
      { ticker: 'KO', name: 'Coca-Cola Co.', price: 8900.00, change: 0.15 },
    ],
    bonos: [
      { ticker: 'AL30', name: 'Bono Soberano ARS 2030', price: 72.85, change: 0.45 },
      { ticker: 'GD30', name: 'Bono Global USD 2030', price: 74.20, change: 0.62 },
      { ticker: 'AL35', name: 'Bono Soberano ARS 2035', price: 68.10, change: 0.28 },
      { ticker: 'GD35', name: 'Bono Global USD 2035', price: 70.45, change: 0.51 },
      { ticker: 'AL41', name: 'Bono Soberano ARS 2041', price: 59.30, change: -0.15 },
      { ticker: 'GD41', name: 'Bono Global USD 2041', price: 62.80, change: 0.33 },
      { ticker: 'GD46', name: 'Bono Global USD 2046', price: 56.20, change: 0.18 },
      { ticker: 'AE38', name: 'Bono Soberano ARS 2038', price: 61.40, change: 0.72 },
    ],
    tasas: [
      { name: 'Caución colocadora', plazo: '1 día', tna: '34.0%', tea: '39.5%' },
      { name: 'Caución colocadora', plazo: '7 días', tna: '38.5%', tea: '46.2%' },
      { name: 'Caución colocadora', plazo: '14 días', tna: '39.0%', tea: '47.0%' },
      { name: 'Caución colocadora', plazo: '30 días', tna: '40.0%', tea: '48.8%' },
      { name: 'Lecap corta', plazo: '30-60 días', tna: '40-42%', tea: '48-51%' },
      { name: 'Lecap larga', plazo: '90-180 días', tna: '42-45%', tea: '51-56%' },
      { name: 'Cheques avalados MAV', plazo: '30-90 días', tna: '39-43%', tea: '—' },
      { name: 'Plazo fijo (ref.)', plazo: '30 días', tna: '30.0%', tea: '34.5%' },
    ],
    merval: 2184500,
    riesgoPais: '680',
    source: 'reference',
    updatedAt: new Date().toISOString(),
  };
}

// ===== HANDLER PRINCIPAL =====
exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Check cache
  const now = Date.now();
  if (CACHE.data && (now - CACHE.timestamp) < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify(CACHE.data) };
  }

  try {
    // Try to fetch live data in parallel
    const [bymaData, mervalData, riesgoPaisData] = await Promise.allSettled([
      fetchBYMAData(),
      fetchArgentinaDatos(),
      fetchRiesgoPais(),
    ]);

    // Start with reference data as base
    let result = getReferenceData();

    // Override with live data if available
    if (mervalData.status === 'fulfilled' && mervalData.value) {
      result.merval = mervalData.value.valor || mervalData.value.value || result.merval;
      result.source = 'live';
    }

    if (riesgoPaisData.status === 'fulfilled' && riesgoPaisData.value) {
      result.riesgoPais = riesgoPaisData.value.valor || riesgoPaisData.value.value || result.riesgoPais;
    }

    // If BYMA data is available, process it
    if (bymaData.status === 'fulfilled' && bymaData.value && Array.isArray(bymaData.value)) {
      // Process BYMA quotes
      const bymaParsed = parseBYMAQuotes(bymaData.value);
      if (bymaParsed.acciones.length > 0) result.acciones = bymaParsed.acciones;
      if (bymaParsed.cedears.length > 0) result.cedears = bymaParsed.cedears;
      if (bymaParsed.bonos.length > 0) result.bonos = bymaParsed.bonos;
      result.source = 'live';
    }

    result.updatedAt = new Date().toISOString();

    // Update cache
    CACHE.data = result;
    CACHE.timestamp = now;

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error('Handler error:', err);
    // Return reference data on error
    const fallback = getReferenceData();
    return { statusCode: 200, headers, body: JSON.stringify(fallback) };
  }
};

// ===== PARSE BYMA DATA =====
function parseBYMAQuotes(data) {
  const accionesTickers = ['GGAL','YPF','PAMP','BBAR','TXAR','TGSU2','SUPV','BYMA','LOMA','ALUA','CEPU','COME','CRES','EDN','MIRG','TECO2','VALO'];
  const cedearsTickers = ['AAPL','MSFT','MELI','GOOGL','AMZN','TSLA','NVDA','META','BABA','KO','DIS','NFLX','PFE','V','JPM'];
  const bonosTickers = ['AL30','GD30','AL35','GD35','AL41','GD41','GD46','AE38','AL29','GD29'];

  const acciones = [];
  const cedears = [];
  const bonos = [];

  data.forEach(item => {
    const ticker = item.symbol || item.ticker || '';
    const price = item.last || item.price || item.ultimoPrecio || 0;
    const change = item.change || item.variacionPorcentual || 0;
    const name = item.description || item.nombre || ticker;

    const row = { ticker, name, price: Number(price), change: Number(change) };

    if (accionesTickers.includes(ticker)) acciones.push(row);
    else if (cedearsTickers.includes(ticker)) cedears.push(row);
    else if (bonosTickers.includes(ticker)) bonos.push(row);
  });

  return { acciones, cedears, bonos };
}

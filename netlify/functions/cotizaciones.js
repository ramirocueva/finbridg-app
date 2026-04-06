// netlify/functions/cotizaciones.js
// FinBridge - Cotizaciones en vivo del mercado argentino
// Fuente: yahoo-finance2 (maneja autenticación automáticamente)
// Fuentes complementarias: ArgentinaDatos (Merval, Riesgo País)

const yahooFinance = require('yahoo-finance2').default;

const CACHE = { data: null, timestamp: 0 };
const CACHE_TTL = 120000; // 2 minutos de cache

// ===== TICKERS =====
const ACCIONES = [
  { yahoo: 'GGAL.BA', ticker: 'GGAL', name: 'Grupo Fin. Galicia' },
  { yahoo: 'YPFD.BA', ticker: 'YPF', name: 'YPF S.A.' },
  { yahoo: 'PAMP.BA', ticker: 'PAMP', name: 'Pampa Energía' },
  { yahoo: 'BBAR.BA', ticker: 'BBAR', name: 'Banco BBVA Argentina' },
  { yahoo: 'TXAR.BA', ticker: 'TXAR', name: 'Ternium Argentina' },
  { yahoo: 'TGSU2.BA', ticker: 'TGSU2', name: 'Transp. Gas del Sur' },
  { yahoo: 'SUPV.BA', ticker: 'SUPV', name: 'Grupo Supervielle' },
  { yahoo: 'BYMA.BA', ticker: 'BYMA', name: 'Bolsas y Mercados Arg.' },
  { yahoo: 'LOMA.BA', ticker: 'LOMA', name: 'Loma Negra' },
  { yahoo: 'ALUA.BA', ticker: 'ALUA', name: 'Aluar' },
];

const CEDEARS = [
  { yahoo: 'AAPL.BA', ticker: 'AAPL', name: 'Apple Inc.' },
  { yahoo: 'MSFT.BA', ticker: 'MSFT', name: 'Microsoft Corp.' },
  { yahoo: 'MELI.BA', ticker: 'MELI', name: 'MercadoLibre Inc.' },
  { yahoo: 'GOOGL.BA', ticker: 'GOOGL', name: 'Alphabet Inc.' },
  { yahoo: 'AMZN.BA', ticker: 'AMZN', name: 'Amazon.com Inc.' },
  { yahoo: 'TSLA.BA', ticker: 'TSLA', name: 'Tesla Inc.' },
  { yahoo: 'NVDA.BA', ticker: 'NVDA', name: 'NVIDIA Corp.' },
  { yahoo: 'META.BA', ticker: 'META', name: 'Meta Platforms' },
  { yahoo: 'BABA.BA', ticker: 'BABA', name: 'Alibaba Group' },
  { yahoo: 'KO.BA', ticker: 'KO', name: 'Coca-Cola Co.' },
];

const BONOS = [
  { yahoo: 'AL30.BA', ticker: 'AL30', name: 'Bono Soberano ARS 2030' },
  { yahoo: 'GD30.BA', ticker: 'GD30', name: 'Bono Global USD 2030' },
  { yahoo: 'AL35.BA', ticker: 'AL35', name: 'Bono Soberano ARS 2035' },
  { yahoo: 'GD35.BA', ticker: 'GD35', name: 'Bono Global USD 2035' },
  { yahoo: 'AL41.BA', ticker: 'AL41', name: 'Bono Soberano ARS 2041' },
  { yahoo: 'GD41.BA', ticker: 'GD41', name: 'Bono Global USD 2041' },
  { yahoo: 'GD46.BA', ticker: 'GD46', name: 'Bono Global USD 2046' },
  { yahoo: 'AE38.BA', ticker: 'AE38', name: 'Bono Soberano ARS 2038' },
];

// ===== YAHOO FINANCE 2 FETCH =====
async function fetchQuotes(symbols) {
  try {
    const yahooSymbols = symbols.map(s => s.yahoo);

    // yahoo-finance2 maneja cookies/crumb automáticamente
    const results = await yahooFinance.quote(yahooSymbols);

    // quote() puede retornar un objeto si es 1 símbolo, o array si son varios
    const quotesArray = Array.isArray(results) ? results : [results];

    return symbols.map(s => {
      const q = quotesArray.find(qq => qq && qq.symbol === s.yahoo);
      if (q && q.regularMarketPrice) {
        return {
          ticker: s.ticker,
          name: s.name,
          price: q.regularMarketPrice,
          change: q.regularMarketChangePercent
            ? parseFloat(q.regularMarketChangePercent.toFixed(2))
            : 0,
        };
      }
      return null;
    }).filter(Boolean);
  } catch (e) {
    console.error('yahoo-finance2 fetch error:', e.message);
    return null;
  }
}

// ===== MERVAL INDEX =====
async function fetchMerval() {
  try {
    const result = await yahooFinance.quote('^MERV');
    if (result && result.regularMarketPrice) {
      return Math.round(result.regularMarketPrice);
    }
  } catch (e) {
    console.error('Merval yahoo error:', e.message);
  }

  // Fallback: ArgentinaDatos
  try {
    const res = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/merval/ultimo');
    if (res.ok) {
      const data = await res.json();
      return data?.valor || data?.value || null;
    }
  } catch (e) {}

  return null;
}

// ===== RIESGO PAIS =====
async function fetchRiesgoPais() {
  try {
    const res = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo');
    if (res.ok) {
      const data = await res.json();
      return data?.valor || data?.value || null;
    }
  } catch (e) {}
  return null;
}

// ===== TASAS (referencia) =====
function getTasas() {
  return [
    { name: 'Caución colocadora', plazo: '1 día', tna: '34.0%', tea: '39.5%' },
    { name: 'Caución colocadora', plazo: '7 días', tna: '38.5%', tea: '46.2%' },
    { name: 'Caución colocadora', plazo: '14 días', tna: '39.0%', tea: '47.0%' },
    { name: 'Caución colocadora', plazo: '30 días', tna: '40.0%', tea: '48.8%' },
    { name: 'Lecap corta', plazo: '30-60 días', tna: '40-42%', tea: '48-51%' },
    { name: 'Lecap larga', plazo: '90-180 días', tna: '42-45%', tea: '51-56%' },
    { name: 'Cheques avalados MAV', plazo: '30-90 días', tna: '39-43%', tea: '—' },
    { name: 'Plazo fijo (ref.)', plazo: '30 días', tna: '30.0%', tea: '34.5%' },
  ];
}

// ===== DATOS DE REFERENCIA (fallback si Yahoo no responde) =====
function getReferenceData() {
  return {
    acciones: [
      { ticker: 'GGAL', name: 'Grupo Fin. Galicia', price: 6380.00, change: -4.25 },
      { ticker: 'YPF', name: 'YPF S.A.', price: 54550.00, change: -1.75 },
      { ticker: 'PAMP', name: 'Pampa Energía', price: 4895.00, change: -1.53 },
      { ticker: 'BBAR', name: 'Banco BBVA Argentina', price: 9475.00, change: -4.66 },
      { ticker: 'TXAR', name: 'Ternium Argentina', price: 1180.00, change: -2.15 },
      { ticker: 'TGSU2', name: 'Transp. Gas del Sur', price: 5620.00, change: 3.50 },
      { ticker: 'SUPV', name: 'Grupo Supervielle', price: 2870.00, change: -3.12 },
      { ticker: 'BYMA', name: 'Bolsas y Mercados Arg.', price: 2150.00, change: -1.80 },
      { ticker: 'LOMA', name: 'Loma Negra', price: 1740.00, change: -0.95 },
      { ticker: 'ALUA', name: 'Aluar', price: 1085.00, change: -1.45 },
    ],
    cedears: [
      { ticker: 'AAPL', name: 'Apple Inc.', price: 29800.00, change: -2.35 },
      { ticker: 'MSFT', name: 'Microsoft Corp.', price: 55200.00, change: -1.80 },
      { ticker: 'MELI', name: 'MercadoLibre Inc.', price: 265000.00, change: -3.10 },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 22500.00, change: -2.45 },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 27100.00, change: -2.90 },
      { ticker: 'TSLA', name: 'Tesla Inc.', price: 35200.00, change: -4.50 },
      { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 15800.00, change: -3.85 },
      { ticker: 'META', name: 'Meta Platforms', price: 80500.00, change: -2.10 },
      { ticker: 'BABA', name: 'Alibaba Group', price: 19200.00, change: -1.75 },
      { ticker: 'KO', name: 'Coca-Cola Co.', price: 10200.00, change: -0.60 },
    ],
    bonos: [
      { ticker: 'AL30', name: 'Bono Soberano ARS 2030', price: 65.40, change: -1.85 },
      { ticker: 'GD30', name: 'Bono Global USD 2030', price: 67.10, change: -1.62 },
      { ticker: 'AL35', name: 'Bono Soberano ARS 2035', price: 58.20, change: -2.10 },
      { ticker: 'GD35', name: 'Bono Global USD 2035', price: 61.80, change: -1.75 },
      { ticker: 'AL41', name: 'Bono Soberano ARS 2041', price: 52.60, change: -2.30 },
      { ticker: 'GD41', name: 'Bono Global USD 2041', price: 56.40, change: -1.90 },
      { ticker: 'GD46', name: 'Bono Global USD 2046', price: 50.80, change: -1.55 },
      { ticker: 'AE38', name: 'Bono Soberano ARS 2038', price: 54.90, change: -2.05 },
    ],
  };
}

// ===== HANDLER PRINCIPAL =====
exports.handler = async (event) => {
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
    // Fetch everything in parallel
    const [accionesData, cedearsData, bonosData, mervalValue, riesgoPaisValue] = await Promise.allSettled([
      fetchQuotes(ACCIONES),
      fetchQuotes(CEDEARS),
      fetchQuotes(BONOS),
      fetchMerval(),
      fetchRiesgoPais(),
    ]);

    const ref = getReferenceData();
    let source = 'reference';

    // Build result: use live data if available, fallback to reference
    const acciones = (accionesData.status === 'fulfilled' && accionesData.value && accionesData.value.length > 0)
      ? accionesData.value : ref.acciones;

    const cedears = (cedearsData.status === 'fulfilled' && cedearsData.value && cedearsData.value.length > 0)
      ? cedearsData.value : ref.cedears;

    const bonos = (bonosData.status === 'fulfilled' && bonosData.value && bonosData.value.length > 0)
      ? bonosData.value : ref.bonos;

    // If any live data came through, mark as live
    if (acciones !== ref.acciones || cedears !== ref.cedears || bonos !== ref.bonos) {
      source = 'live';
    }

    const merval = (mervalValue.status === 'fulfilled' && mervalValue.value)
      ? mervalValue.value : 2865753;

    const riesgoPais = (riesgoPaisValue.status === 'fulfilled' && riesgoPaisValue.value)
      ? String(riesgoPaisValue.value) : '633';

    if (mervalValue.status === 'fulfilled' && mervalValue.value) source = 'live';

    const result = {
      acciones,
      cedears,
      bonos,
      tasas: getTasas(),
      merval,
      riesgoPais,
      source,
      updatedAt: new Date().toISOString(),
    };

    // Update cache
    CACHE.data = result;
    CACHE.timestamp = now;

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error('Handler error:', err);
    const fallback = getReferenceData();
    fallback.tasas = getTasas();
    fallback.merval = 2865753;
    fallback.riesgoPais = '633';
    fallback.source = 'reference';
    fallback.updatedAt = new Date().toISOString();
    return { statusCode: 200, headers, body: JSON.stringify(fallback) };
  }
};
